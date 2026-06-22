using MessageBus.Api.Models;
using MessageBus.Api.Services.Interfaces;
using Microsoft.AspNetCore.Mvc;

namespace MessageBus.Api.Controllers;

/// <summary>
/// API endpoints for queue management operations
/// </summary>
[ApiController]
[Route("api/[controller]")]
[Produces("application/json")]
public class QueuesController : ControllerBase
{
    private readonly IQueueService _queueService;
    private readonly IMessageService _messageService;
    private readonly ILogger<QueuesController> _logger;

    public QueuesController(
        IQueueService queueService,
        IMessageService messageService,
        ILogger<QueuesController> logger)
    {
        _queueService = queueService;
        _messageService = messageService;
        _logger = logger;
    }

    /// <summary>
    /// List all queues with statistics
    /// </summary>
    /// <param name="includeSystemQueues">Include system queues (default: false)</param>
    /// <param name="includeEmptyQueues">Include queues with no messages (default: true)</param>
    /// <returns>List of queues with statistics</returns>
    [HttpGet]
    [ProducesResponseType(typeof(List<QueueInfo>), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status500InternalServerError)]
    public async Task<ActionResult<List<QueueInfo>>> GetQueues(
        [FromQuery] bool includeSystemQueues = false,
        [FromQuery] bool includeEmptyQueues = true)
    {
        try
        {
            var queues = await _queueService.GetAllQueuesAsync(includeSystemQueues, includeEmptyQueues);
            return Ok(queues);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Failed to get queues");
            return StatusCode(500, new { error = "Failed to retrieve queues", message = ex.Message });
        }
    }

    /// <summary>
    /// Get detailed statistics for a specific queue
    /// </summary>
    /// <param name="queueName">Name of the queue</param>
    /// <returns>Queue statistics including message counts, ages, and health status</returns>
    [HttpGet("{queueName}")]
    [ProducesResponseType(typeof(QueueStatistics), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    [ProducesResponseType(StatusCodes.Status500InternalServerError)]
    public async Task<ActionResult<QueueStatistics>> GetQueueDetails(string queueName)
    {
        try
        {
            var statistics = await _queueService.GetQueueStatisticsAsync(queueName);
            if (statistics == null)
            {
                return NotFound(new { error = "Queue not found", queueName });
            }
            return Ok(statistics);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Failed to get queue details for {QueueName}", queueName);
            return StatusCode(500, new { error = "Failed to retrieve queue details", message = ex.Message });
        }
    }

    /// <summary>
    /// Get the health status for a specific queue
    /// </summary>
    /// <param name="queueName">Name of the queue</param>
    /// <returns>Queue health status with issues if any</returns>
    [HttpGet("{queueName}/health")]
    [ProducesResponseType(typeof(QueueHealthStatus), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status500InternalServerError)]
    public async Task<ActionResult<QueueHealthStatus>> GetQueueHealth(string queueName)
    {
        try
        {
            var health = await _queueService.GetQueueHealthStatusAsync(queueName);
            return Ok(health);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Failed to get queue health for {QueueName}", queueName);
            return StatusCode(500, new { error = "Failed to retrieve queue health", message = ex.Message });
        }
    }

    /// <summary>
    /// Get messages from a queue (non-destructive peek)
    /// </summary>
    /// <param name="queueName">Name of the queue</param>
    /// <param name="pageNumber">Page number (default: 1)</param>
    /// <param name="pageSize">Number of messages per page (default: 25, max: 100)</param>
    /// <param name="statusFilter">Filter by message status</param>
    /// <param name="messageTypeFilter">Filter by message type</param>
    /// <returns>Paginated list of messages</returns>
    [HttpGet("{queueName}/messages")]
    [ProducesResponseType(typeof(MessageListResponse), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status500InternalServerError)]
    public async Task<ActionResult<MessageListResponse>> GetMessages(
        string queueName,
        [FromQuery] int pageNumber = 1,
        [FromQuery] int pageSize = 25,
        [FromQuery] string? statusFilter = null,
        [FromQuery] string? messageTypeFilter = null)
    {
        try
        {
            // Validate pagination
            pageNumber = Math.Max(1, pageNumber);
            pageSize = Math.Clamp(pageSize, 1, 100);

            var messages = await _messageService.GetMessagesAsync(queueName, pageNumber, pageSize, statusFilter, messageTypeFilter);

            var response = new MessageListResponse
            {
                QueueName = queueName,
                Messages = messages,
                PageNumber = pageNumber,
                PageSize = pageSize,
                TotalCount = messages.Count // Note: This is the count of returned messages, not total
            };

            return Ok(response);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Failed to get messages from queue {QueueName}", queueName);
            return StatusCode(500, new { error = "Failed to retrieve messages", message = ex.Message });
        }
    }

    /// <summary>
    /// Pause a queue (disable receive)
    /// </summary>
    /// <param name="queueName">Name of the queue to pause</param>
    /// <returns>Operation result</returns>
    [HttpPost("{queueName}/pause")]
    [ProducesResponseType(typeof(ServiceResult), StatusCodes.Status200OK)]
    [ProducesResponseType(typeof(ServiceResult), StatusCodes.Status400BadRequest)]
    [ProducesResponseType(StatusCodes.Status500InternalServerError)]
    public async Task<ActionResult<ServiceResult>> PauseQueue(string queueName)
    {
        try
        {
            _logger.LogInformation("Pausing queue: {QueueName}", queueName);
            var result = await _queueService.PauseQueueAsync(queueName);

            if (!result.Success)
            {
                return BadRequest(result);
            }

            return Ok(result);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Failed to pause queue {QueueName}", queueName);
            return StatusCode(500, new { error = "Failed to pause queue", message = ex.Message });
        }
    }

    /// <summary>
    /// Resume a paused queue (enable receive)
    /// </summary>
    /// <param name="queueName">Name of the queue to resume</param>
    /// <returns>Operation result</returns>
    [HttpPost("{queueName}/resume")]
    [ProducesResponseType(typeof(ServiceResult), StatusCodes.Status200OK)]
    [ProducesResponseType(typeof(ServiceResult), StatusCodes.Status400BadRequest)]
    [ProducesResponseType(StatusCodes.Status500InternalServerError)]
    public async Task<ActionResult<ServiceResult>> ResumeQueue(string queueName)
    {
        try
        {
            _logger.LogInformation("Resuming queue: {QueueName}", queueName);
            var result = await _queueService.ResumeQueueAsync(queueName);

            if (!result.Success)
            {
                return BadRequest(result);
            }

            return Ok(result);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Failed to resume queue {QueueName}", queueName);
            return StatusCode(500, new { error = "Failed to resume queue", message = ex.Message });
        }
    }

    /// <summary>
    /// Purge all messages from a queue
    /// </summary>
    /// <param name="queueName">Name of the queue to purge</param>
    /// <param name="confirm">Confirmation flag (must be true to execute)</param>
    /// <returns>Operation result</returns>
    [HttpDelete("{queueName}/purge")]
    [ProducesResponseType(typeof(ServiceResult), StatusCodes.Status200OK)]
    [ProducesResponseType(typeof(ServiceResult), StatusCodes.Status400BadRequest)]
    [ProducesResponseType(StatusCodes.Status500InternalServerError)]
    public async Task<ActionResult<ServiceResult>> PurgeQueue(
        string queueName,
        [FromQuery] bool confirm = false)
    {
        try
        {
            _logger.LogWarning("Purge requested for queue: {QueueName}, confirmed: {Confirm}", queueName, confirm);

            var result = await _queueService.PurgeQueueAsync(queueName, requireConfirmation: !confirm);

            if (!result.Success)
            {
                return BadRequest(result);
            }

            return Ok(result);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Failed to purge queue {QueueName}", queueName);
            return StatusCode(500, new { error = "Failed to purge queue", message = ex.Message });
        }
    }
}

/// <summary>
/// Response wrapper for paginated message list
/// </summary>
public class MessageListResponse
{
    public string QueueName { get; set; } = string.Empty;
    public List<MessageInfo> Messages { get; set; } = new();
    public int PageNumber { get; set; }
    public int PageSize { get; set; }
    public int TotalCount { get; set; }
}
