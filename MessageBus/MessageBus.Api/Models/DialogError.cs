namespace MessageBus.Api.Models;

/// <summary>
/// Represents dialog error information from usp_GetDialogErrors stored procedure
/// </summary>
public class DialogError
{
    public Guid ConversationHandle { get; set; }
    public Guid ConversationId { get; set; }
    public string State { get; set; } = string.Empty;
    public string StateDesc { get; set; } = string.Empty;
    public string StateDescription { get; set; } = string.Empty;
    public string? FarService { get; set; }
    public Guid? FarBrokerInstance { get; set; }
    public bool IsInitiator { get; set; }
    public DateTime ConversationLifetime { get; set; }
    public int SecondsSinceLifetime { get; set; }
    public int? PrincipalId { get; set; }
    public DateTime? SecurityTimestamp { get; set; }
    public string? TransmissionStatus { get; set; }
    public DateTime? TransmissionEnqueueTime { get; set; }
    public int? TransmissionStuckSeconds { get; set; }
    public string? ToServiceName { get; set; }
    public string? MessageTypeName { get; set; }
    public int? PendingMessageSize { get; set; }
}
