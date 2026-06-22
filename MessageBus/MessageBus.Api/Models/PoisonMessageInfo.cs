namespace MessageBus.Api.Models;

/// <summary>
/// Represents poison message information from vw_PoisonMessages view
/// </summary>
public class PoisonMessageInfo
{
    public long Id { get; set; }
    public Guid ConversationHandle { get; set; }
    public string SourceQueueName { get; set; } = string.Empty;
    public string MessageTypeName { get; set; } = string.Empty;
    public string? ErrorMessage { get; set; }
    public int RetryCount { get; set; }
    public int MaxRetries { get; set; }
    public DateTime MovedToDeadLetterAt { get; set; }
    public DateTime? LastRetryAt { get; set; }
    public string Status { get; set; } = string.Empty;
}
