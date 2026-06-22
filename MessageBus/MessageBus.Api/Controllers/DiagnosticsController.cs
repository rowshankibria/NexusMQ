using MessageBus.Api.Models;
using MessageBus.Api.Services.Interfaces;
using Microsoft.AspNetCore.Mvc;

namespace MessageBus.Api.Controllers;

/// <summary>
/// API endpoints for diagnostics, health checks, and performance metrics
/// </summary>
[ApiController]
[Route("api/[controller]")]
[Produces("application/json")]
public class DiagnosticsController : ControllerBase
{
    private readonly IDiagnosticsService _diagnosticsService;
    private readonly ILogger<DiagnosticsController> _logger;

    public DiagnosticsController(
        IDiagnosticsService diagnosticsService,
        ILogger<DiagnosticsController> logger)
    {
        _diagnosticsService = diagnosticsService;
        _logger = logger;
    }

    /// <summary>
    /// Get overall Service Broker health status
    /// </summary>
    /// <returns>System status overview</returns>
    [HttpGet("status")]
    [ProducesResponseType(typeof(SystemStatus), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status500InternalServerError)]
    public async Task<ActionResult<SystemStatus>> GetStatus()
    {
        try
        {
            var status = await _diagnosticsService.GetSystemStatusAsync();
            return Ok(status);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Failed to get system status");
            return StatusCode(500, new { error = "Failed to retrieve system status", message = ex.Message });
        }
    }

    /// <summary>
    /// Get Service Broker health information
    /// </summary>
    /// <returns>Broker health details</returns>
    [HttpGet("broker")]
    [ProducesResponseType(typeof(ServiceBrokerHealthInfo), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status500InternalServerError)]
    public async Task<ActionResult<ServiceBrokerHealthInfo>> GetBrokerStatus()
    {
        try
        {
            var brokerInfo = await _diagnosticsService.GetBrokerStatusAsync();

            if (brokerInfo == null)
            {
                return Ok(new { message = "Service Broker information not available" });
            }

            return Ok(brokerInfo);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Failed to get broker status");
            return StatusCode(500, new { error = "Failed to retrieve broker status", message = ex.Message });
        }
    }

    /// <summary>
    /// View transmission queue items
    /// </summary>
    /// <param name="minStuckSeconds">Minimum seconds a message must be stuck to be included</param>
    /// <param name="serviceNameFilter">Filter by service name</param>
    /// <returns>Transmission queue items</returns>
    [HttpGet("transmission-queue")]
    [ProducesResponseType(typeof(TransmissionQueueResponse), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status500InternalServerError)]
    public async Task<ActionResult<TransmissionQueueResponse>> GetTransmissionQueue(
        [FromQuery] int minStuckSeconds = 0,
        [FromQuery] string? serviceNameFilter = null)
    {
        try
        {
            var items = await _diagnosticsService.GetTransmissionQueueAsync(minStuckSeconds, serviceNameFilter);
            var summary = await _diagnosticsService.GetTransmissionQueueSummaryAsync();

            return Ok(new TransmissionQueueResponse
            {
                Items = items,
                Summary = summary,
                FilterApplied = minStuckSeconds > 0 || !string.IsNullOrEmpty(serviceNameFilter)
            });
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Failed to get transmission queue");
            return StatusCode(500, new { error = "Failed to retrieve transmission queue", message = ex.Message });
        }
    }

    /// <summary>
    /// View dialog errors
    /// </summary>
    /// <param name="includeAllErrorStates">Include all error states, not just critical</param>
    /// <param name="minAgeSeconds">Minimum age in seconds for errors to include</param>
    /// <param name="serviceNameFilter">Filter by service name</param>
    /// <returns>List of dialog errors</returns>
    [HttpGet("dialog-errors")]
    [ProducesResponseType(typeof(DialogErrorsResponse), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status500InternalServerError)]
    public async Task<ActionResult<DialogErrorsResponse>> GetDialogErrors(
        [FromQuery] bool includeAllErrorStates = true,
        [FromQuery] int minAgeSeconds = 0,
        [FromQuery] string? serviceNameFilter = null)
    {
        try
        {
            var errors = await _diagnosticsService.GetDialogErrorsAsync(includeAllErrorStates, minAgeSeconds, serviceNameFilter);

            return Ok(new DialogErrorsResponse
            {
                Errors = errors,
                TotalCount = errors.Count,
                FilterApplied = minAgeSeconds > 0 || !string.IsNullOrEmpty(serviceNameFilter)
            });
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Failed to get dialog errors");
            return StatusCode(500, new { error = "Failed to retrieve dialog errors", message = ex.Message });
        }
    }

    /// <summary>
    /// Get performance metrics
    /// </summary>
    /// <param name="queueName">Filter by queue name</param>
    /// <param name="hoursBack">Number of hours to look back (default: 24)</param>
    /// <param name="aggregationMinutes">Aggregation interval in minutes (0 = raw data)</param>
    /// <param name="topN">Maximum number of metrics to return</param>
    /// <returns>Performance metrics</returns>
    [HttpGet("metrics")]
    [ProducesResponseType(typeof(MetricsResponse), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status500InternalServerError)]
    public async Task<ActionResult<MetricsResponse>> GetMetrics(
        [FromQuery] string? queueName = null,
        [FromQuery] int hoursBack = 24,
        [FromQuery] int aggregationMinutes = 0,
        [FromQuery] int topN = 1000)
    {
        try
        {
            // Validate parameters
            hoursBack = Math.Clamp(hoursBack, 1, 168); // Max 7 days
            topN = Math.Clamp(topN, 1, 10000);

            var metrics = await _diagnosticsService.GetPerformanceMetricsAsync(queueName, hoursBack, aggregationMinutes, topN);

            return Ok(new MetricsResponse
            {
                Metrics = metrics,
                HoursBack = hoursBack,
                AggregationMinutes = aggregationMinutes,
                QueueFilter = queueName
            });
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Failed to get performance metrics");
            return StatusCode(500, new { error = "Failed to retrieve metrics", message = ex.Message });
        }
    }

    /// <summary>
    /// Run a full diagnostic health check
    /// </summary>
    /// <returns>Comprehensive diagnostic results</returns>
    [HttpPost("health-check")]
    [ProducesResponseType(typeof(DiagnosticsResult), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status500InternalServerError)]
    public async Task<ActionResult<DiagnosticsResult>> RunHealthCheck()
    {
        try
        {
            _logger.LogInformation("Running full diagnostic health check");
            var result = await _diagnosticsService.RunHealthChecksAsync();
            return Ok(result);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Failed to run health check");
            return StatusCode(500, new { error = "Health check failed", message = ex.Message });
        }
    }

    /// <summary>
    /// Check for orphaned conversations
    /// </summary>
    /// <param name="thresholdHours">Threshold in hours to consider a conversation orphaned</param>
    /// <returns>List of orphaned conversations</returns>
    [HttpGet("orphaned-conversations")]
    [ProducesResponseType(typeof(List<OrphanedConversation>), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status500InternalServerError)]
    public async Task<ActionResult<List<OrphanedConversation>>> GetOrphanedConversations(
        [FromQuery] int thresholdHours = 24)
    {
        try
        {
            var orphans = await _diagnosticsService.CheckForOrphanedConversationsAsync(thresholdHours);
            return Ok(orphans);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Failed to check for orphaned conversations");
            return StatusCode(500, new { error = "Failed to check orphaned conversations", message = ex.Message });
        }
    }

    /// <summary>
    /// Validate that all services have valid queues
    /// </summary>
    /// <returns>Service validation results</returns>
    [HttpGet("validate-services")]
    [ProducesResponseType(typeof(ServiceValidationResponse), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status500InternalServerError)]
    public async Task<ActionResult<ServiceValidationResponse>> ValidateServices()
    {
        try
        {
            var results = await _diagnosticsService.ValidateServicesHaveValidQueuesAsync();

            return Ok(new ServiceValidationResponse
            {
                Results = results,
                TotalServices = results.Count,
                ValidServices = results.Count(r => r.IsValid),
                InvalidServices = results.Count(r => !r.IsValid)
            });
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Failed to validate services");
            return StatusCode(500, new { error = "Failed to validate services", message = ex.Message });
        }
    }

    /// <summary>
    /// Get a full diagnostic summary for reporting
    /// </summary>
    /// <returns>Complete diagnostic summary</returns>
    [HttpGet("summary")]
    [ProducesResponseType(typeof(DiagnosticsSummary), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status500InternalServerError)]
    public async Task<ActionResult<DiagnosticsSummary>> GetDiagnosticsSummary()
    {
        try
        {
            var summary = await _diagnosticsService.GetDiagnosticsSummaryAsync();
            return Ok(summary);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Failed to get diagnostics summary");
            return StatusCode(500, new { error = "Failed to retrieve diagnostics summary", message = ex.Message });
        }
    }
}

/// <summary>
/// Response containing transmission queue data
/// </summary>
public class TransmissionQueueResponse
{
    public List<TransmissionQueueItem> Items { get; set; } = new();
    public TransmissionQueueSummary? Summary { get; set; }
    public bool FilterApplied { get; set; }
}

/// <summary>
/// Response containing dialog errors
/// </summary>
public class DialogErrorsResponse
{
    public List<DialogError> Errors { get; set; } = new();
    public int TotalCount { get; set; }
    public bool FilterApplied { get; set; }
}

/// <summary>
/// Response containing performance metrics
/// </summary>
public class MetricsResponse
{
    public List<PerformanceMetric> Metrics { get; set; } = new();
    public int HoursBack { get; set; }
    public int AggregationMinutes { get; set; }
    public string? QueueFilter { get; set; }
}

/// <summary>
/// Response containing service validation results
/// </summary>
public class ServiceValidationResponse
{
    public List<ServiceValidationResult> Results { get; set; } = new();
    public int TotalServices { get; set; }
    public int ValidServices { get; set; }
    public int InvalidServices { get; set; }
}
