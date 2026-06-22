namespace MessageBus.Api.Models;

/// <summary>
/// Represents active conversation information from vw_ActiveConversations view
/// </summary>
public class ConversationInfo
{
    public Guid ConversationHandle { get; set; }
    public Guid ConversationId { get; set; }
    public string State { get; set; } = string.Empty;
    public string? FarService { get; set; }
    public Guid? FarBrokerInstance { get; set; }
    public string LocalService { get; set; } = string.Empty;
    public bool IsInitiator { get; set; }
    public long SendSequence { get; set; }
    public long ReceiveSequence { get; set; }
    public DateTime Lifetime { get; set; }
    public int SecondsRemaining { get; set; }
}
