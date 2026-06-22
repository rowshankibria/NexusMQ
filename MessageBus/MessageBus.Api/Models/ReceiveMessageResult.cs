namespace MessageBus.Api.Models;

/// <summary>
/// Represents the result of usp_ReceiveMessage stored procedure
/// </summary>
public class ReceiveMessageResult
{
    public bool MessageReceived { get; set; }
    public Guid? ConversationHandle { get; set; }
    public Guid? ConversationId { get; set; }
    public Guid? ConversationGroupId { get; set; }
    public string? MessageTypeName { get; set; }
    public long? MessageSequenceNumber { get; set; }
    public string? ServiceName { get; set; }
    public string? ContractName { get; set; }
    public int? MessageSizeBytes { get; set; }
    public string? MessageBody { get; set; }
}
