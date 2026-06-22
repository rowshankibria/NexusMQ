namespace MessageBus.Api.Models;

/// <summary>
/// Represents a conversation trace item from usp_GetConversationTrace stored procedure
/// </summary>
public class ConversationTraceItem
{
    public string ResultSetType { get; set; } = string.Empty;
    public long AuditId { get; set; }
    public DateTime OperationTimestamp { get; set; }
    public string Operation { get; set; } = string.Empty;
    public string? QueueName { get; set; }
    public string? ServiceName { get; set; }
    public string? MessageTypeName { get; set; }
    public long? MessageSequenceNumber { get; set; }
    public string? MessageBodyPreview { get; set; }
    public int? MessageSizeBytes { get; set; }
    public string? ApplicationName { get; set; }
    public string? UserName { get; set; }
    public string? HostName { get; set; }
    public long SequenceNumber { get; set; }
}
