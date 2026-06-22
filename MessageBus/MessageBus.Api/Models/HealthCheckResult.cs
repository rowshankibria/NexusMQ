namespace MessageBus.Api.Models;

/// <summary>
/// Represents the overall health check result from usp_RunHealthCheck stored procedure
/// </summary>
public class HealthCheckResult
{
    public string OverallHealthStatus { get; set; } = string.Empty;
    public int CriticalIssues { get; set; }
    public int Warnings { get; set; }
    public DateTime CheckTimestamp { get; set; }
    public int OrphanedThresholdHours { get; set; }
    public int OldMessageThresholdMinutes { get; set; }
    public string Recommendation { get; set; } = string.Empty;
}
