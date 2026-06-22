namespace MessageBus.Api.Models;

/// <summary>
/// Represents contract information for a service
/// </summary>
public class ContractInfo
{
    public string ContractName { get; set; } = string.Empty;
    public int ContractId { get; set; }
    public string? MessageTypeName { get; set; }
    public bool IsSentByInitiator { get; set; }
    public bool IsSentByTarget { get; set; }
}
