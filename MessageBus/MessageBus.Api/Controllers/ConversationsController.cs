using MessageBus.Api.Models;
using MessageBus.Api.Services.Interfaces;
using Microsoft.AspNetCore.Mvc;
using System.Text;

namespace MessageBus.Api.Controllers;

/// <summary>
/// API endpoints for conversation tracking and tracing
/// </summary>
[ApiController]
[Route("api/[controller]")]
[Produces("application/json")]
public class ConversationsController : ControllerBase
{
    private readonly IConversationService _conversationService;
    private readonly ILogger<ConversationsController> _logger;

    public ConversationsController(
        IConversationService conversationService,
        ILogger<ConversationsController> logger)
    {
        _conversationService = conversationService;
        _logger = logger;
    }

    /// <summary>
    /// List conversations with optional filtering by state
    /// </summary>
    /// <param name="state">Filter by conversation state (e.g., CO, SO, ER)</param>
    /// <param name="service">Filter by service name</param>
    /// <returns>List of conversations</returns>
    [HttpGet]
    [ProducesResponseType(typeof(ConversationListResponse), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status500InternalServerError)]
    public async Task<ActionResult<ConversationListResponse>> GetConversations(
        [FromQuery] string? state = null,
        [FromQuery] string? service = null)
    {
        try
        {
            var conversations = await _conversationService.GetConversationsAsync(state, service);
            var stats = await _conversationService.GetConversationStatsAsync();

            return Ok(new ConversationListResponse
            {
                Conversations = conversations,
                Statistics = stats,
                FilterApplied = !string.IsNullOrEmpty(state) || !string.IsNullOrEmpty(service)
            });
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Failed to get conversations");
            return StatusCode(500, new { error = "Failed to retrieve conversations", message = ex.Message });
        }
    }

    /// <summary>
    /// Get statistics about conversations
    /// </summary>
    /// <returns>Conversation statistics</returns>
    [HttpGet("stats")]
    [ProducesResponseType(typeof(ConversationStats), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status500InternalServerError)]
    public async Task<ActionResult<ConversationStats>> GetStatistics()
    {
        try
        {
            var stats = await _conversationService.GetConversationStatsAsync();
            return Ok(stats);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Failed to get conversation statistics");
            return StatusCode(500, new { error = "Failed to retrieve statistics", message = ex.Message });
        }
    }

    /// <summary>
    /// Get full conversation trace including timeline
    /// </summary>
    /// <param name="conversationHandle">Conversation handle GUID</param>
    /// <param name="includeDeadLetterHistory">Include dead letter history</param>
    /// <param name="includeTransmissionQueue">Include transmission queue info</param>
    /// <returns>Conversation detail with trace</returns>
    [HttpGet("{conversationHandle:guid}")]
    [ProducesResponseType(typeof(ConversationDetail), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    [ProducesResponseType(StatusCodes.Status500InternalServerError)]
    public async Task<ActionResult<ConversationDetail>> GetConversationDetail(
        Guid conversationHandle,
        [FromQuery] bool includeDeadLetterHistory = true,
        [FromQuery] bool includeTransmissionQueue = true)
    {
        try
        {
            var result = await _conversationService.GetConversationDetailAsync(
                conversationHandle,
                includeDeadLetterHistory,
                includeTransmissionQueue);

            if (!result.Success)
            {
                if (result.Message.Contains("not found", StringComparison.OrdinalIgnoreCase))
                {
                    return NotFound(new { error = "Conversation not found", conversationHandle });
                }
                return BadRequest(result);
            }

            return Ok(result.Result);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Failed to get conversation detail for {ConversationHandle}", conversationHandle);
            return StatusCode(500, new { error = "Failed to retrieve conversation detail", message = ex.Message });
        }
    }

    /// <summary>
    /// Get conversation trace items
    /// </summary>
    /// <param name="conversationHandle">Conversation handle GUID</param>
    /// <returns>List of trace items</returns>
    [HttpGet("{conversationHandle:guid}/trace")]
    [ProducesResponseType(typeof(List<ConversationTraceItem>), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status500InternalServerError)]
    public async Task<ActionResult<List<ConversationTraceItem>>> GetConversationTrace(Guid conversationHandle)
    {
        try
        {
            var trace = await _conversationService.GetConversationTraceAsync(conversationHandle);
            return Ok(trace);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Failed to get conversation trace for {ConversationHandle}", conversationHandle);
            return StatusCode(500, new { error = "Failed to retrieve conversation trace", message = ex.Message });
        }
    }

    /// <summary>
    /// Get conversation timeline for visualization
    /// </summary>
    /// <param name="conversationHandle">Conversation handle GUID</param>
    /// <returns>Timeline data structure</returns>
    [HttpGet("{conversationHandle:guid}/timeline")]
    [ProducesResponseType(typeof(ConversationTimeline), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status500InternalServerError)]
    public async Task<ActionResult<ConversationTimeline>> GetConversationTimeline(Guid conversationHandle)
    {
        try
        {
            var timeline = await _conversationService.BuildTimelineAsync(conversationHandle);
            return Ok(timeline);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Failed to build conversation timeline for {ConversationHandle}", conversationHandle);
            return StatusCode(500, new { error = "Failed to build timeline", message = ex.Message });
        }
    }

    /// <summary>
    /// Export conversation in specified format
    /// </summary>
    /// <param name="conversationHandle">Conversation handle GUID</param>
    /// <param name="format">Export format: json or csv</param>
    /// <returns>Exported data file</returns>
    [HttpGet("{conversationHandle:guid}/export")]
    [ProducesResponseType(typeof(FileContentResult), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    [ProducesResponseType(StatusCodes.Status500InternalServerError)]
    public async Task<IActionResult> ExportConversation(
        Guid conversationHandle,
        [FromQuery] string format = "json")
    {
        try
        {
            ServiceResult<string> result;
            string contentType;
            string fileExtension;

            switch (format.ToLowerInvariant())
            {
                case "json":
                    result = await _conversationService.ExportAsJsonAsync(conversationHandle);
                    contentType = "application/json";
                    fileExtension = "json";
                    break;

                case "csv":
                    result = await _conversationService.ExportAsCsvAsync(conversationHandle);
                    contentType = "text/csv";
                    fileExtension = "csv";
                    break;

                default:
                    return BadRequest(new { error = "Invalid format", message = "Supported formats: json, csv" });
            }

            if (!result.Success)
            {
                if (result.Message.Contains("not found", StringComparison.OrdinalIgnoreCase))
                {
                    return NotFound(new { error = "Conversation not found", conversationHandle });
                }
                return BadRequest(result);
            }

            var fileName = $"conversation_{conversationHandle:N}_{DateTime.UtcNow:yyyyMMddHHmmss}.{fileExtension}";
            var bytes = Encoding.UTF8.GetBytes(result.Result ?? "");

            return File(bytes, contentType, fileName);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Failed to export conversation {ConversationHandle}", conversationHandle);
            return StatusCode(500, new { error = "Failed to export conversation", message = ex.Message });
        }
    }

    /// <summary>
    /// End a conversation
    /// </summary>
    /// <param name="conversationHandle">Conversation handle GUID</param>
    /// <param name="withCleanup">Perform cleanup of related data</param>
    /// <returns>Operation result</returns>
    [HttpPost("{conversationHandle:guid}/end")]
    [ProducesResponseType(typeof(ServiceResult), StatusCodes.Status200OK)]
    [ProducesResponseType(typeof(ServiceResult), StatusCodes.Status400BadRequest)]
    [ProducesResponseType(StatusCodes.Status500InternalServerError)]
    public async Task<ActionResult<ServiceResult>> EndConversation(
        Guid conversationHandle,
        [FromQuery] bool withCleanup = false)
    {
        try
        {
            _logger.LogInformation("Ending conversation {ConversationHandle}, cleanup: {WithCleanup}",
                conversationHandle, withCleanup);

            var result = await _conversationService.EndConversationAsync(conversationHandle, withCleanup);

            if (!result.Success)
            {
                return BadRequest(result);
            }

            return Ok(result);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Failed to end conversation {ConversationHandle}", conversationHandle);
            return StatusCode(500, new { error = "Failed to end conversation", message = ex.Message });
        }
    }
}

/// <summary>
/// Response containing conversations with statistics
/// </summary>
public class ConversationListResponse
{
    public List<ConversationInfo> Conversations { get; set; } = new();
    public ConversationStats Statistics { get; set; } = new();
    public bool FilterApplied { get; set; }
}
