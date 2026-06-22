namespace MessageBus.Api.Models;

/// <summary>
/// Represents detailed queue statistics from usp_GetQueueStatistics stored procedure
/// </summary>
public class QueueStatistics
{
    // Queue Identity
    public string QueueName { get; set; } = string.Empty;
    public int QueueObjectId { get; set; }

    // Message Counts
    public int TotalMessages { get; set; }
    public int ReadyMessages { get; set; }
    public int ReceivedMessages { get; set; }

    // Age Statistics
    public int? OldestMessageAgeSeconds { get; set; }
    public int? AvgMessageAgeSeconds { get; set; }

    // Queue Configuration
    public bool IsReceiveEnabled { get; set; }
    public bool IsEnqueueEnabled { get; set; }
    public bool IsRetentionEnabled { get; set; }
    public bool IsPoisonMessageHandlingEnabled { get; set; }

    // Activation Configuration
    public bool IsActivationEnabled { get; set; }
    public string? ActivationProcedure { get; set; }
    public int MaxQueueReaders { get; set; }

    // Conversation Statistics
    public int ActiveConversations { get; set; }
    public int ErrorConversations { get; set; }

    // System-wide Statistics
    public int SystemPoisonMessageCount { get; set; }
    public int TransmissionQueueCount { get; set; }

    // Queue Metadata
    public DateTime QueueCreatedDate { get; set; }
    public DateTime QueueModifiedDate { get; set; }

    // Health Indicators
    public string HealthStatus { get; set; } = string.Empty;
}
