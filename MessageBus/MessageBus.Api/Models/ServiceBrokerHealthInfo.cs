namespace MessageBus.Api.Models;

/// <summary>
/// Represents Service Broker health information from vw_ServiceBrokerHealth view
/// </summary>
public class ServiceBrokerHealthInfo
{
    public string DatabaseName { get; set; } = string.Empty;
    public bool IsBrokerEnabled { get; set; }
    public Guid BrokerGuid { get; set; }
    public int TotalQueues { get; set; }
    public int DisabledQueues { get; set; }
    public int TotalServices { get; set; }
    public int OpenConversations { get; set; }
    public int ErrorConversations { get; set; }
    public int TransmissionQueueDepth { get; set; }
}
