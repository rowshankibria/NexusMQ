using MessageBus.Api.Models;

namespace MessageBus.Api.Repositories.Interfaces;

/// <summary>
/// Repository interface for message-related operations
/// </summary>
public interface IMessageRepository
{
    /// <summary>
    /// Peeks at messages in a queue without removing them
    /// </summary>
    Task<List<MessageInfo>> GetMessagesAsync(string queueName, int pageNumber = 1, int pageSize = 25, string? statusFilter = null, string? messageTypeFilter = null);

    /// <summary>
    /// Sends a message through Service Broker
    /// </summary>
    Task<SendMessageResult> SendMessageAsync(
        string initiatorService,
        string targetService,
        string contractName,
        string messageTypeName,
        string messageBody,
        int priority = 5,
        Guid? dialogHandle = null,
        Guid? conversationGroup = null,
        int dialogLifetimeSeconds = 3600,
        bool useExistingDialog = false,
        string? applicationName = null);

    /// <summary>
    /// Receives a single message from a queue
    /// </summary>
    Task<ReceiveMessageResult> ReceiveMessageAsync(string queueName, int timeoutMs = 5000, string? applicationName = null);
}
