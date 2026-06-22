namespace MessageBus.Api.Models;

/// <summary>
/// Represents service information from sys.services query
/// </summary>
public class ServiceInfo
{
    public string ServiceName { get; set; } = string.Empty;
    public int ServiceId { get; set; }
    public int? ServiceQueueId { get; set; }
    public string? QueueName { get; set; }
    public int? PrincipalId { get; set; }
}
