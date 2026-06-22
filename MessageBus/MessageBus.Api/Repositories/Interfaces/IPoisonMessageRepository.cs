using MessageBus.Api.Models;

namespace MessageBus.Api.Repositories.Interfaces;

/// <summary>
/// Repository interface for poison message and dead letter queue operations
/// </summary>
public interface IPoisonMessageRepository
{
    /// <summary>
    /// Gets all poison messages from the view
    /// </summary>
    Task<List<PoisonMessageInfo>> GetPoisonMessagesAsync();

    /// <summary>
    /// Gets all messages in the dead letter queue
    /// </summary>
    Task<List<DeadLetterMessage>> GetDeadLetteredMessagesAsync(bool includeResolved = false);

    /// <summary>
    /// Retries a poison message by its ID
    /// </summary>
    Task RetryPoisonMessageAsync(long id);

    /// <summary>
    /// Moves a message to the dead letter queue
    /// </summary>
    Task MoveToDeadLetterAsync(Guid conversationHandle, string queueName, string reason);

    /// <summary>
    /// Marks a dead letter message as resolved
    /// </summary>
    Task ResolveDeadLetterMessageAsync(long id, string resolutionNotes, string resolvedBy);
}
