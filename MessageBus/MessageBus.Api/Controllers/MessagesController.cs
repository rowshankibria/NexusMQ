using MessageBus.Api.Models;
using MessageBus.Api.Services.Interfaces;
using Microsoft.AspNetCore.Mvc;

namespace MessageBus.Api.Controllers;

/// <summary>
/// API endpoints for message operations
/// </summary>
[ApiController]
[Route("api/[controller]")]
[Produces("application/json")]
public class MessagesController : ControllerBase
{
    private readonly IMessageService _messageService;
    private readonly ILogger<MessagesController> _logger;

    public MessagesController(
        IMessageService messageService,
        ILogger<MessagesController> logger)
    {
        _messageService = messageService;
        _logger = logger;
    }

    /// <summary>
    /// Get details of a specific message by conversation handle
    /// </summary>
    /// <param name="conversationHandle">The conversation handle GUID</param>
    /// <param name="queueName">Optional queue name to search in</param>
    /// <returns>Message details if found</returns>
    [HttpGet("{conversationHandle:guid}")]
    [ProducesResponseType(typeof(MessageInfo), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    [ProducesResponseType(StatusCodes.Status500InternalServerError)]
    public async Task<ActionResult<MessageInfo>> GetMessageDetails(
        Guid conversationHandle,
        [FromQuery] string? queueName = null)
    {
        try
        {
            // If no queue specified, we need to search across queues
            // For now, we'll return not implemented if no queue is specified
            if (string.IsNullOrEmpty(queueName))
            {
                return BadRequest(new { error = "Queue name is required", message = "Please specify a queueName query parameter" });
            }

            var messages = await _messageService.GetMessagesAsync(queueName, 1, 1000);
            var message = messages.FirstOrDefault(m => m.ConversationHandle == conversationHandle);

            if (message == null)
            {
                return NotFound(new { error = "Message not found", conversationHandle });
            }

            return Ok(message);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Failed to get message details for {ConversationHandle}", conversationHandle);
            return StatusCode(500, new { error = "Failed to retrieve message details", message = ex.Message });
        }
    }

    /// <summary>
    /// Send a message via Service Broker
    /// </summary>
    /// <param name="request">Message send request</param>
    /// <returns>Send result with dialog handle</returns>
    [HttpPost("send")]
    [ProducesResponseType(typeof(ServiceResult<SendMessageResult>), StatusCodes.Status200OK)]
    [ProducesResponseType(typeof(ServiceResult), StatusCodes.Status400BadRequest)]
    [ProducesResponseType(StatusCodes.Status500InternalServerError)]
    public async Task<ActionResult<ServiceResult<SendMessageResult>>> SendMessage([FromBody] SendMessageRequest request)
    {
        try
        {
            // Validate request
            if (string.IsNullOrWhiteSpace(request.InitiatorService))
            {
                return BadRequest(ServiceResult.Fail("Validation failed", "InitiatorService is required"));
            }
            if (string.IsNullOrWhiteSpace(request.TargetService))
            {
                return BadRequest(ServiceResult.Fail("Validation failed", "TargetService is required"));
            }
            if (string.IsNullOrWhiteSpace(request.ContractName))
            {
                return BadRequest(ServiceResult.Fail("Validation failed", "ContractName is required"));
            }
            if (string.IsNullOrWhiteSpace(request.MessageTypeName))
            {
                return BadRequest(ServiceResult.Fail("Validation failed", "MessageTypeName is required"));
            }
            if (string.IsNullOrWhiteSpace(request.MessageBody))
            {
                return BadRequest(ServiceResult.Fail("Validation failed", "MessageBody is required"));
            }

            _logger.LogInformation("Sending message from {Initiator} to {Target} with type {MessageType}",
                request.InitiatorService, request.TargetService, request.MessageTypeName);

            var result = await _messageService.SendMessageAsync(request);

            if (!result.Success)
            {
                return BadRequest(result);
            }

            return Ok(result);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Failed to send message");
            return StatusCode(500, new { error = "Failed to send message", message = ex.Message });
        }
    }

    /// <summary>
    /// Send multiple messages for testing purposes
    /// </summary>
    /// <param name="request">Bulk send request</param>
    /// <returns>Bulk send result with success/failure counts</returns>
    [HttpPost("send-bulk")]
    [ProducesResponseType(typeof(ServiceResult<BulkSendResult>), StatusCodes.Status200OK)]
    [ProducesResponseType(typeof(ServiceResult), StatusCodes.Status400BadRequest)]
    [ProducesResponseType(StatusCodes.Status500InternalServerError)]
    public async Task<ActionResult<ServiceResult<BulkSendResult>>> SendBulkMessages([FromBody] BulkSendRequest request)
    {
        try
        {
            // Validate request
            if (request.Message == null)
            {
                return BadRequest(ServiceResult.Fail("Validation failed", "Message is required"));
            }
            if (request.Count < 1)
            {
                return BadRequest(ServiceResult.Fail("Validation failed", "Count must be at least 1"));
            }
            if (request.Count > 1000)
            {
                return BadRequest(ServiceResult.Fail("Validation failed", "Count cannot exceed 1000"));
            }

            _logger.LogInformation("Bulk sending {Count} messages from {Initiator} to {Target}",
                request.Count, request.Message.InitiatorService, request.Message.TargetService);

            var result = await _messageService.BulkSendAsync(request.Message, request.Count);

            if (!result.Success)
            {
                return BadRequest(result);
            }

            return Ok(result);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Failed to bulk send messages");
            return StatusCode(500, new { error = "Failed to bulk send messages", message = ex.Message });
        }
    }

    /// <summary>
    /// Validate that a message type exists for a contract
    /// </summary>
    /// <param name="contractName">Contract name</param>
    /// <param name="messageTypeName">Message type name</param>
    /// <returns>Validation result</returns>
    [HttpGet("validate/message-type")]
    [ProducesResponseType(typeof(ServiceResult), StatusCodes.Status200OK)]
    [ProducesResponseType(typeof(ServiceResult), StatusCodes.Status400BadRequest)]
    public async Task<ActionResult<ServiceResult>> ValidateMessageType(
        [FromQuery] string contractName,
        [FromQuery] string messageTypeName)
    {
        try
        {
            var result = await _messageService.ValidateMessageTypeAsync(contractName, messageTypeName);
            return Ok(result);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Failed to validate message type {MessageType} for contract {Contract}",
                messageTypeName, contractName);
            return StatusCode(500, new { error = "Validation failed", message = ex.Message });
        }
    }

    /// <summary>
    /// Validate that a service exists
    /// </summary>
    /// <param name="serviceName">Service name</param>
    /// <returns>Validation result</returns>
    [HttpGet("validate/service")]
    [ProducesResponseType(typeof(ServiceResult), StatusCodes.Status200OK)]
    [ProducesResponseType(typeof(ServiceResult), StatusCodes.Status400BadRequest)]
    public async Task<ActionResult<ServiceResult>> ValidateService([FromQuery] string serviceName)
    {
        try
        {
            var result = await _messageService.ValidateServiceAsync(serviceName);
            return Ok(result);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Failed to validate service {ServiceName}", serviceName);
            return StatusCode(500, new { error = "Validation failed", message = ex.Message });
        }
    }
}

/// <summary>
/// Request for bulk message sending
/// </summary>
public class BulkSendRequest
{
    /// <summary>
    /// The message template to send
    /// </summary>
    public SendMessageRequest Message { get; set; } = new();

    /// <summary>
    /// Number of messages to send (1-1000)
    /// </summary>
    public int Count { get; set; } = 1;
}
