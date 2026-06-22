using MessageBus.Api.Models;
using MessageBus.Api.Repositories.Interfaces;
using MessageBus.Api.Services.Interfaces;
using Microsoft.AspNetCore.Mvc;

namespace MessageBus.Api.Controllers;

/// <summary>
/// API endpoints for Service Broker service metadata
/// </summary>
[ApiController]
[Route("api/[controller]")]
[Produces("application/json")]
public class ServicesController : ControllerBase
{
    private readonly IServiceRepository _serviceRepository;
    private readonly IQueueService _queueService;
    private readonly ILogger<ServicesController> _logger;

    public ServicesController(
        IServiceRepository serviceRepository,
        IQueueService queueService,
        ILogger<ServicesController> logger)
    {
        _serviceRepository = serviceRepository;
        _queueService = queueService;
        _logger = logger;
    }

    /// <summary>
    /// List all Service Broker services
    /// </summary>
    /// <returns>List of services</returns>
    [HttpGet]
    [ProducesResponseType(typeof(List<ServiceInfo>), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status500InternalServerError)]
    public async Task<ActionResult<List<ServiceInfo>>> GetServices()
    {
        try
        {
            var services = await _serviceRepository.GetAllServicesAsync();
            return Ok(services);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Failed to get services");
            return StatusCode(500, new { error = "Failed to retrieve services", message = ex.Message });
        }
    }

    /// <summary>
    /// Get details for a specific service including associated queues
    /// </summary>
    /// <param name="serviceName">Name of the service</param>
    /// <returns>Service details with queue information</returns>
    [HttpGet("{serviceName}")]
    [ProducesResponseType(typeof(ServiceDetailResponse), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    [ProducesResponseType(StatusCodes.Status500InternalServerError)]
    public async Task<ActionResult<ServiceDetailResponse>> GetServiceDetails(string serviceName)
    {
        try
        {
            var services = await _serviceRepository.GetAllServicesAsync();
            var service = services.FirstOrDefault(s =>
                s.ServiceName.Equals(serviceName, StringComparison.OrdinalIgnoreCase));

            if (service == null)
            {
                return NotFound(new { error = "Service not found", serviceName });
            }

            // Get contracts for this service
            var contracts = await _serviceRepository.GetContractsForServiceAsync(serviceName);

            // Get queue statistics if service has a queue
            QueueStatistics? queueStats = null;
            if (!string.IsNullOrEmpty(service.QueueName))
            {
                queueStats = await _queueService.GetQueueStatisticsAsync(service.QueueName);
            }

            return Ok(new ServiceDetailResponse
            {
                Service = service,
                Contracts = contracts,
                QueueStatistics = queueStats
            });
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Failed to get service details for {ServiceName}", serviceName);
            return StatusCode(500, new { error = "Failed to retrieve service details", message = ex.Message });
        }
    }

    /// <summary>
    /// Get contracts associated with a service
    /// </summary>
    /// <param name="serviceName">Name of the service</param>
    /// <returns>List of contracts</returns>
    [HttpGet("{serviceName}/contracts")]
    [ProducesResponseType(typeof(List<ContractInfo>), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status500InternalServerError)]
    public async Task<ActionResult<List<ContractInfo>>> GetContractsForService(string serviceName)
    {
        try
        {
            var contracts = await _serviceRepository.GetContractsForServiceAsync(serviceName);
            return Ok(contracts);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Failed to get contracts for service {ServiceName}", serviceName);
            return StatusCode(500, new { error = "Failed to retrieve contracts", message = ex.Message });
        }
    }

    /// <summary>
    /// List all message types defined in the database
    /// </summary>
    /// <returns>List of message types</returns>
    [HttpGet("message-types")]
    [ProducesResponseType(typeof(List<MessageTypeInfo>), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status500InternalServerError)]
    public async Task<ActionResult<List<MessageTypeInfo>>> GetMessageTypes()
    {
        try
        {
            var messageTypes = await _serviceRepository.GetMessageTypesAsync();
            return Ok(messageTypes);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Failed to get message types");
            return StatusCode(500, new { error = "Failed to retrieve message types", message = ex.Message });
        }
    }

    /// <summary>
    /// Get a summary of all services with their queues and message counts
    /// </summary>
    /// <returns>Service summary list</returns>
    [HttpGet("summary")]
    [ProducesResponseType(typeof(List<ServiceSummary>), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status500InternalServerError)]
    public async Task<ActionResult<List<ServiceSummary>>> GetServicesSummary()
    {
        try
        {
            var services = await _serviceRepository.GetAllServicesAsync();
            var queues = await _queueService.GetAllQueuesAsync(includeSystemQueues: true, includeEmptyQueues: true);

            var summaries = services.Select(s =>
            {
                var queue = queues.FirstOrDefault(q =>
                    q.QueueName.Equals(s.QueueName, StringComparison.OrdinalIgnoreCase));

                return new ServiceSummary
                {
                    ServiceName = s.ServiceName,
                    ServiceId = s.ServiceId,
                    QueueName = s.QueueName,
                    QueueExists = queue != null,
                    MessageCount = queue?.MessageCount ?? 0,
                    QueueStatus = queue?.Status ?? "Unknown"
                };
            }).ToList();

            return Ok(summaries);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Failed to get services summary");
            return StatusCode(500, new { error = "Failed to retrieve services summary", message = ex.Message });
        }
    }
}

/// <summary>
/// Detailed service response including queue info
/// </summary>
public class ServiceDetailResponse
{
    public ServiceInfo Service { get; set; } = new();
    public List<ContractInfo> Contracts { get; set; } = new();
    public QueueStatistics? QueueStatistics { get; set; }
}

/// <summary>
/// Summary of a service with queue status
/// </summary>
public class ServiceSummary
{
    public string ServiceName { get; set; } = string.Empty;
    public int ServiceId { get; set; }
    public string? QueueName { get; set; }
    public bool QueueExists { get; set; }
    public int MessageCount { get; set; }
    public string QueueStatus { get; set; } = string.Empty;
}
