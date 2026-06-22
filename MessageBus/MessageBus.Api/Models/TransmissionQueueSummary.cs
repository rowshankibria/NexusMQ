namespace MessageBus.Api.Models;

/// <summary>
/// Represents transmission queue summary from usp_GetTransmissionQueueStatus
/// </summary>
public class TransmissionQueueSummary
{
    public int TotalMessages { get; set; }
    public int StuckOver5Min { get; set; }
    public int StuckOver30Min { get; set; }
    public int StuckOver1Hour { get; set; }
    public int WithErrors { get; set; }
    public DateTime? OldestMessageTime { get; set; }
    public int? OldestMessageAgeSeconds { get; set; }
}
