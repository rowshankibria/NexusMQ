namespace MessageBus.Api.Models;

/// <summary>
/// Represents message type information from sys.service_message_types query
/// </summary>
public class MessageTypeInfo
{
    public string MessageTypeName { get; set; } = string.Empty;
    public int MessageTypeId { get; set; }
    public string? Validation { get; set; }
    public string? ValidationDesc { get; set; }
}
