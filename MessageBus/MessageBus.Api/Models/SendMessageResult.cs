namespace MessageBus.Api.Models;

/// <summary>
/// Represents the result of usp_SendMessage stored procedure
/// </summary>
public class SendMessageResult
{
    public Guid DialogHandle { get; set; }
    public Guid? ConversationId { get; set; }
    public bool NewDialogCreated { get; set; }
    public int MessageSizeBytes { get; set; }
    public string Status { get; set; } = string.Empty;
}
