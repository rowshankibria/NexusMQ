using MessageBus.Api.Models;

namespace MessageBus.Api.Services.Interfaces;

/// <summary>
/// Service interface for poison message and dead letter queue operations
/// </summary>
public interface IPoisonMessageService
{
    /// <summary>
    /// Gets all poison messages
    /// </summary>
    Task<List<PoisonMessageInfo>> GetPoisonMessagesAsync();

    /// <summary>
    /// Gets all dead lettered messages
    /// </summary>
    Task<List<DeadLetterMessage>> GetDeadLetteredMessagesAsync(bool includeResolved = false);

    /// <summary>
    /// Retries a poison message (re-enables queue, moves message back)
    /// </summary>
    Task<ServiceResult> RetryPoisonMessageAsync(long id);

    /// <summary>
    /// Retries multiple poison messages
    /// </summary>
    Task<ServiceResult<BulkOperationResult>> BulkRetryPoisonMessagesAsync(IEnumerable<long> ids);

    /// <summary>
    /// Moves a message to the dead letter queue
    /// </summary>
    Task<ServiceResult> MoveToDeadLetterAsync(Guid conversationHandle, string queueName, string reason);

    /// <summary>
    /// Purges a poison message to dead letter
    /// </summary>
    Task<ServiceResult> PurgePoisonMessageAsync(long id, string reason);

    /// <summary>
    /// Purges multiple poison messages to dead letter
    /// </summary>
    Task<ServiceResult<BulkOperationResult>> BulkPurgePoisonMessagesAsync(IEnumerable<long> ids, string reason);

    /// <summary>
    /// Resolves a dead letter message
    /// </summary>
    Task<ServiceResult> ResolveDeadLetterMessageAsync(long id, string resolutionNotes, string resolvedBy);

    /// <summary>
    /// Gets poison message statistics
    /// </summary>
    Task<PoisonMessageStats> GetPoisonMessageStatsAsync();
}

/// <summary>
/// Result of a bulk operation
/// </summary>
public class BulkOperationResult
{
    public int Requested { get; set; }
    public int Succeeded { get; set; }
    public int Failed { get; set; }
    public List<BulkOperationItemResult> Results { get; set; } = new();
    public TimeSpan Duration { get; set; }
}

/// <summary>
/// Result of a single item in a bulk operation
/// </summary>
public class BulkOperationItemResult
{
    public long Id { get; set; }
    public bool Success { get; set; }
    public string? Error { get; set; }
}

/// <summary>
/// Statistics for poison messages
/// </summary>
public class PoisonMessageStats
{
    public int TotalPoisonMessages { get; set; }
    public int TotalDeadLettered { get; set; }
    public int UnresolvedDeadLettered { get; set; }
    public int ResolvedDeadLettered { get; set; }
    public Dictionary<string, int> ByQueue { get; set; } = new();
    public Dictionary<string, int> ByErrorType { get; set; } = new();
    public DateTime? OldestPoisonMessage { get; set; }
}
