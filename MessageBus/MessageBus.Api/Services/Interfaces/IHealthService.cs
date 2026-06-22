namespace MessageBus.Api.Services.Interfaces;

/// <summary>
/// Service interface for health check operations
/// </summary>
public interface IHealthService
{
    Task<HealthCheckResult> RunHealthCheckAsync();
}

public class HealthCheckResult
{
    public string OverallStatus { get; set; } = string.Empty;
    public int CriticalIssues { get; set; }
    public int Warnings { get; set; }
    public DateTime CheckTimestamp { get; set; }
    public string Recommendation { get; set; } = string.Empty;
    public BrokerStatus? BrokerStatus { get; set; }
    public List<QueueHealth> QueueHealth { get; set; } = new();
}

public class BrokerStatus
{
    public string DatabaseName { get; set; } = string.Empty;
    public string BrokerGuid { get; set; } = string.Empty;
    public string Status { get; set; } = string.Empty;
    public string StatusLevel { get; set; } = string.Empty;
    public string ServerName { get; set; } = string.Empty;
}

public class QueueHealth
{
    public string QueueName { get; set; } = string.Empty;
    public bool IsReceiveEnabled { get; set; }
    public bool IsActivationEnabled { get; set; }
    public string ReceiveStatus { get; set; } = string.Empty;
    public string StatusLevel { get; set; } = string.Empty;
    public long ApproxMessageCount { get; set; }
}
