namespace MessageBus.Api.Models;

/// <summary>
/// Represents performance metrics from usp_GetPerformanceMetrics stored procedure
/// </summary>
public class PerformanceMetric
{
    public long Id { get; set; }
    public DateTime CollectionTimestamp { get; set; }
    public string QueueName { get; set; } = string.Empty;
    public long MessageCount { get; set; }
    public decimal MessagesEnqueuedPerSecond { get; set; }
    public decimal MessagesReceivedPerSecond { get; set; }
    public decimal AvgProcessingTimeMs { get; set; }
    public int OldestMessageAgeSeconds { get; set; }
    public int ActivationCount { get; set; }
    public bool IsDisabled { get; set; }
    public bool IsPoisoned { get; set; }
}
