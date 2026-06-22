namespace MessageBus.Api.Models;

/// <summary>
/// Represents a message from the DeadLetterQueue table
/// </summary>
public class DeadLetterMessage
{
    public long Id { get; set; }
    public Guid ConversationHandle { get; set; }
    public Guid? ConversationId { get; set; }
    public string SourceQueueName { get; set; } = string.Empty;
    public string? ServiceName { get; set; }
    public string MessageTypeName { get; set; } = string.Empty;
    public byte[]? MessageBody { get; set; }
    public string? MessageBodyText { get; set; }
    public string? ErrorMessage { get; set; }
    public int? ErrorNumber { get; set; }
    public int RetryCount { get; set; }
    public int MaxRetries { get; set; }
    public DateTime? OriginalEnqueueTime { get; set; }
    public DateTime MovedToDeadLetterAt { get; set; }
    public DateTime? LastRetryAt { get; set; }
    public DateTime? ResolvedAt { get; set; }
    public string? ResolutionNotes { get; set; }
    public string? ResolvedBy { get; set; }
}
