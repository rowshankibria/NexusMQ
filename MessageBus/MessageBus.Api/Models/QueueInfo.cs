namespace MessageBus.Api.Models;

/// <summary>
/// Represents queue information from usp_GetAllQueuesWithStats stored procedure
/// </summary>
public class QueueInfo
{
    public string QueueName { get; set; } = string.Empty;
    public string SchemaName { get; set; } = string.Empty;
    public string ServiceName { get; set; } = string.Empty;
    public bool IsActivationEnabled { get; set; }
    public bool IsReceiveEnabled { get; set; }
    public int MaxReaders { get; set; }
    public int MessageCount { get; set; }
    public int ReadyCount { get; set; }
    public int ReceivedCount { get; set; }
    public int? OldestMessageAgeSeconds { get; set; }
    public string? OldestMessageAgeFormatted { get; set; }
    public int ActiveConversations { get; set; }
    public int ErrorConversations { get; set; }
    public string Status { get; set; } = string.Empty;
    public string? ActivationProcedure { get; set; }
    public bool IsEnqueueEnabled { get; set; }
    public bool IsRetentionEnabled { get; set; }
    public bool IsPoisonMessageHandlingEnabled { get; set; }
    public DateTime CreateDate { get; set; }
    public DateTime ModifyDate { get; set; }
}
