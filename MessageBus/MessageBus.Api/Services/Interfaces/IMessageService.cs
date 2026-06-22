using MessageBus.Api.Models;

namespace MessageBus.Api.Services.Interfaces;

/// <summary>
/// Service interface for message-related business operations
/// </summary>
public interface IMessageService
{
    /// <summary>
    /// Gets messages from a queue with optional filtering
    /// </summary>
    Task<List<MessageInfo>> GetMessagesAsync(string queueName, int pageNumber = 1, int pageSize = 25, string? statusFilter = null, string? messageTypeFilter = null);

    /// <summary>
    /// Sends a message with validation
    /// </summary>
    Task<ServiceResult<SendMessageResult>> SendMessageAsync(SendMessageRequest request);

    /// <summary>
    /// Sends multiple copies of a message for testing purposes
    /// </summary>
    Task<ServiceResult<BulkSendResult>> BulkSendAsync(SendMessageRequest request, int count);

    /// <summary>
    /// Validates that a message type exists in a contract
    /// </summary>
    Task<ServiceResult> ValidateMessageTypeAsync(string contractName, string messageTypeName);

    /// <summary>
    /// Validates that a target service exists
    /// </summary>
    Task<ServiceResult> ValidateServiceAsync(string serviceName);

    /// <summary>
    /// Receives a message from a queue
    /// </summary>
    Task<ServiceResult<ReceiveMessageResult>> ReceiveMessageAsync(string queueName, int timeoutMs = 5000, string? applicationName = null);
}

/// <summary>
/// Request object for sending a message
/// </summary>
public class SendMessageRequest
{
    public string InitiatorService { get; set; } = string.Empty;
    public string TargetService { get; set; } = string.Empty;
    public string ContractName { get; set; } = string.Empty;
    public string MessageTypeName { get; set; } = string.Empty;
    public string MessageBody { get; set; } = string.Empty;
    public int Priority { get; set; } = 5;
    public Guid? DialogHandle { get; set; }
    public Guid? ConversationGroup { get; set; }
    public int DialogLifetimeSeconds { get; set; } = 3600;
    public bool UseExistingDialog { get; set; }
    public string? ApplicationName { get; set; }
}

/// <summary>
/// Result of a bulk send operation
/// </summary>
public class BulkSendResult
{
    public int Requested { get; set; }
    public int Succeeded { get; set; }
    public int Failed { get; set; }
    public List<SendMessageResult> Results { get; set; } = new();
    public List<string> Errors { get; set; } = new();
    public TimeSpan Duration { get; set; }
}
