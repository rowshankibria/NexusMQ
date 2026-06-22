namespace MessageBus.Api.Models;

/// <summary>
/// Represents transmission queue item from usp_GetTransmissionQueueStatus stored procedure
/// </summary>
public class TransmissionQueueItem
{
    public Guid ConversationHandle { get; set; }
    public Guid? ConversationId { get; set; }
    public string ToServiceName { get; set; } = string.Empty;
    public Guid? ToBrokerInstance { get; set; }
    public string FromServiceName { get; set; } = string.Empty;
    public string ServiceContractName { get; set; } = string.Empty;
    public string MessageTypeName { get; set; } = string.Empty;
    public DateTime EnqueueTime { get; set; }
    public int StuckSeconds { get; set; }
    public int StuckMinutes { get; set; }
    public string? TransmissionStatus { get; set; }
    public string StatusCategory { get; set; } = string.Empty;
    public int Priority { get; set; }
    public long MessageSequenceNumber { get; set; }
    public byte[]? MessageBody { get; set; }
    public int MessageBodySize { get; set; }
    public bool IsConversationError { get; set; }
    public bool IsEndOfDialog { get; set; }
}
