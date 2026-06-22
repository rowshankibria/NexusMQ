namespace MessageBus.Api.Models;

/// <summary>
/// Represents Service Broker database status from usp_RunHealthCheck
/// </summary>
public class BrokerStatus
{
    public string DatabaseName { get; set; } = string.Empty;
    public string BrokerGuid { get; set; } = string.Empty;
    public string BrokerStatusText { get; set; } = string.Empty;
    public string StatusLevel { get; set; } = string.Empty;
    public bool IsTrustworthy { get; set; }
    public bool HonorsBrokerPriority { get; set; }
    public string ServerName { get; set; } = string.Empty;
    public string SqlVersion { get; set; } = string.Empty;
}
