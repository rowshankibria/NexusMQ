namespace MessageBus.Api.Models;

/// <summary>
/// Represents message information from usp_PeekMessages stored procedure
/// </summary>
public class MessageInfo
{
    public Guid ConversationHandle { get; set; }
    public Guid? ConversationId { get; set; }
    public Guid ConversationGroupId { get; set; }
    public long MessageSequenceNumber { get; set; }
    public string MessageTypeName { get; set; } = string.Empty;
    public string Status { get; set; } = string.Empty;
    public int Priority { get; set; }
    public long QueuingOrder { get; set; }
    public string ServiceName { get; set; } = string.Empty;
    public string ContractName { get; set; } = string.Empty;
    public string? Validation { get; set; }
    public int MessageSizeBytes { get; set; }
    public string? MessageBodyPreview { get; set; }
    public string? FarService { get; set; }
    public string? ConversationState { get; set; }
    public DateTime? ConversationLifetime { get; set; }
}
