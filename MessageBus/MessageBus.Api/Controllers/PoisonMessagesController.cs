using MessageBus.Api.Models;
using MessageBus.Api.Services.Interfaces;
using Microsoft.AspNetCore.Mvc;

namespace MessageBus.Api.Controllers;

/// <summary>
/// API endpoints for poison message and dead-letter queue management
/// </summary>
[ApiController]
[Route("api/poison-messages")]
[Produces("application/json")]
public class PoisonMessagesController : ControllerBase
{
    private readonly IPoisonMessageService _poisonMessageService;
    private readonly ILogger<PoisonMessagesController> _logger;

    public PoisonMessagesController(
        IPoisonMessageService poisonMessageService,
        ILogger<PoisonMessagesController> logger)
    {
        _poisonMessageService = poisonMessageService;
        _logger = logger;
    }

    /// <summary>
    /// List all poison messages
    /// </summary>
    /// <returns>List of poison messages</returns>
    [HttpGet]
    [ProducesResponseType(typeof(PoisonMessageListResponse), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status500InternalServerError)]
    public async Task<ActionResult<PoisonMessageListResponse>> GetPoisonMessages()
    {
        try
        {
            var messages = await _poisonMessageService.GetPoisonMessagesAsync();
            var stats = await _poisonMessageService.GetPoisonMessageStatsAsync();

            return Ok(new PoisonMessageListResponse
            {
                Messages = messages,
                Statistics = stats
            });
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Failed to get poison messages");
            return StatusCode(500, new { error = "Failed to retrieve poison messages", message = ex.Message });
        }
    }

    /// <summary>
    /// List dead-lettered messages
    /// </summary>
    /// <param name="includeResolved">Include resolved dead letter messages</param>
    /// <returns>List of dead-lettered messages</returns>
    [HttpGet("dead-letter")]
    [ProducesResponseType(typeof(List<DeadLetterMessage>), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status500InternalServerError)]
    public async Task<ActionResult<List<DeadLetterMessage>>> GetDeadLetteredMessages(
        [FromQuery] bool includeResolved = false)
    {
        try
        {
            var messages = await _poisonMessageService.GetDeadLetteredMessagesAsync(includeResolved);
            return Ok(messages);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Failed to get dead-lettered messages");
            return StatusCode(500, new { error = "Failed to retrieve dead-lettered messages", message = ex.Message });
        }
    }

    /// <summary>
    /// Get poison message statistics
    /// </summary>
    /// <returns>Statistics about poison messages</returns>
    [HttpGet("stats")]
    [ProducesResponseType(typeof(PoisonMessageStats), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status500InternalServerError)]
    public async Task<ActionResult<PoisonMessageStats>> GetStatistics()
    {
        try
        {
            var stats = await _poisonMessageService.GetPoisonMessageStatsAsync();
            return Ok(stats);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Failed to get poison message statistics");
            return StatusCode(500, new { error = "Failed to retrieve statistics", message = ex.Message });
        }
    }

    /// <summary>
    /// Retry a poison message
    /// </summary>
    /// <param name="id">Poison message ID</param>
    /// <returns>Operation result</returns>
    [HttpPost("{id:long}/retry")]
    [ProducesResponseType(typeof(ServiceResult), StatusCodes.Status200OK)]
    [ProducesResponseType(typeof(ServiceResult), StatusCodes.Status400BadRequest)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    [ProducesResponseType(StatusCodes.Status500InternalServerError)]
    public async Task<ActionResult<ServiceResult>> RetryPoisonMessage(long id)
    {
        try
        {
            _logger.LogInformation("Retrying poison message: {Id}", id);
            var result = await _poisonMessageService.RetryPoisonMessageAsync(id);

            if (!result.Success)
            {
                if (result.Message.Contains("not found", StringComparison.OrdinalIgnoreCase))
                {
                    return NotFound(result);
                }
                return BadRequest(result);
            }

            return Ok(result);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Failed to retry poison message {Id}", id);
            return StatusCode(500, new { error = "Failed to retry poison message", message = ex.Message });
        }
    }

    /// <summary>
    /// Purge a poison message to dead-letter queue
    /// </summary>
    /// <param name="id">Poison message ID</param>
    /// <param name="request">Purge request with reason</param>
    /// <returns>Operation result</returns>
    [HttpPost("{id:long}/purge")]
    [ProducesResponseType(typeof(ServiceResult), StatusCodes.Status200OK)]
    [ProducesResponseType(typeof(ServiceResult), StatusCodes.Status400BadRequest)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    [ProducesResponseType(StatusCodes.Status500InternalServerError)]
    public async Task<ActionResult<ServiceResult>> PurgePoisonMessage(
        long id,
        [FromBody] PurgeRequest? request = null)
    {
        try
        {
            var reason = request?.Reason ?? "Manually purged via API";

            _logger.LogWarning("Purging poison message {Id} to dead-letter. Reason: {Reason}", id, reason);
            var result = await _poisonMessageService.PurgePoisonMessageAsync(id, reason);

            if (!result.Success)
            {
                if (result.Message.Contains("not found", StringComparison.OrdinalIgnoreCase))
                {
                    return NotFound(result);
                }
                return BadRequest(result);
            }

            return Ok(result);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Failed to purge poison message {Id}", id);
            return StatusCode(500, new { error = "Failed to purge poison message", message = ex.Message });
        }
    }

    /// <summary>
    /// Bulk retry multiple poison messages
    /// </summary>
    /// <param name="request">Bulk retry request with IDs</param>
    /// <returns>Bulk operation result</returns>
    [HttpPost("bulk-retry")]
    [ProducesResponseType(typeof(ServiceResult<BulkOperationResult>), StatusCodes.Status200OK)]
    [ProducesResponseType(typeof(ServiceResult), StatusCodes.Status400BadRequest)]
    [ProducesResponseType(StatusCodes.Status500InternalServerError)]
    public async Task<ActionResult<ServiceResult<BulkOperationResult>>> BulkRetry([FromBody] BulkRetryRequest request)
    {
        try
        {
            if (request.Ids == null || !request.Ids.Any())
            {
                return BadRequest(ServiceResult.Fail("Validation failed", "At least one ID is required"));
            }

            _logger.LogInformation("Bulk retrying {Count} poison messages", request.Ids.Count);
            var result = await _poisonMessageService.BulkRetryPoisonMessagesAsync(request.Ids);

            if (!result.Success)
            {
                return BadRequest(result);
            }

            return Ok(result);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Failed to bulk retry poison messages");
            return StatusCode(500, new { error = "Failed to bulk retry", message = ex.Message });
        }
    }

    /// <summary>
    /// Bulk purge multiple poison messages to dead-letter queue
    /// </summary>
    /// <param name="request">Bulk purge request with IDs and reason</param>
    /// <returns>Bulk operation result</returns>
    [HttpPost("bulk-purge")]
    [ProducesResponseType(typeof(ServiceResult<BulkOperationResult>), StatusCodes.Status200OK)]
    [ProducesResponseType(typeof(ServiceResult), StatusCodes.Status400BadRequest)]
    [ProducesResponseType(StatusCodes.Status500InternalServerError)]
    public async Task<ActionResult<ServiceResult<BulkOperationResult>>> BulkPurge([FromBody] BulkPurgeRequest request)
    {
        try
        {
            if (request.Ids == null || !request.Ids.Any())
            {
                return BadRequest(ServiceResult.Fail("Validation failed", "At least one ID is required"));
            }

            var reason = request.Reason ?? "Bulk purged via API";

            _logger.LogWarning("Bulk purging {Count} poison messages. Reason: {Reason}", request.Ids.Count, reason);
            var result = await _poisonMessageService.BulkPurgePoisonMessagesAsync(request.Ids, reason);

            if (!result.Success)
            {
                return BadRequest(result);
            }

            return Ok(result);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Failed to bulk purge poison messages");
            return StatusCode(500, new { error = "Failed to bulk purge", message = ex.Message });
        }
    }

    /// <summary>
    /// Resolve a dead-letter message (mark as handled)
    /// </summary>
    /// <param name="id">Dead-letter message ID</param>
    /// <param name="request">Resolution request with notes</param>
    /// <returns>Operation result</returns>
    [HttpPost("dead-letter/{id:long}/resolve")]
    [ProducesResponseType(typeof(ServiceResult), StatusCodes.Status200OK)]
    [ProducesResponseType(typeof(ServiceResult), StatusCodes.Status400BadRequest)]
    [ProducesResponseType(StatusCodes.Status500InternalServerError)]
    public async Task<ActionResult<ServiceResult>> ResolveDeadLetter(
        long id,
        [FromBody] ResolveRequest request)
    {
        try
        {
            if (string.IsNullOrWhiteSpace(request.ResolvedBy))
            {
                return BadRequest(ServiceResult.Fail("Validation failed", "ResolvedBy is required"));
            }

            _logger.LogInformation("Resolving dead-letter message {Id} by {ResolvedBy}", id, request.ResolvedBy);
            var result = await _poisonMessageService.ResolveDeadLetterMessageAsync(
                id,
                request.ResolutionNotes ?? "",
                request.ResolvedBy);

            if (!result.Success)
            {
                return BadRequest(result);
            }

            return Ok(result);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Failed to resolve dead-letter message {Id}", id);
            return StatusCode(500, new { error = "Failed to resolve dead-letter message", message = ex.Message });
        }
    }
}

/// <summary>
/// Response containing poison messages with statistics
/// </summary>
public class PoisonMessageListResponse
{
    public List<PoisonMessageInfo> Messages { get; set; } = new();
    public PoisonMessageStats Statistics { get; set; } = new();
}

/// <summary>
/// Request for purging a poison message
/// </summary>
public class PurgeRequest
{
    public string? Reason { get; set; }
}

/// <summary>
/// Request for bulk retry operation
/// </summary>
public class BulkRetryRequest
{
    public List<long> Ids { get; set; } = new();
}

/// <summary>
/// Request for bulk purge operation
/// </summary>
public class BulkPurgeRequest
{
    public List<long> Ids { get; set; } = new();
    public string? Reason { get; set; }
}

/// <summary>
/// Request for resolving a dead-letter message
/// </summary>
public class ResolveRequest
{
    public string? ResolutionNotes { get; set; }
    public string ResolvedBy { get; set; } = string.Empty;
}
