using MessageBus.Api.Models;

namespace MessageBus.Api.Repositories.Interfaces;

/// <summary>
/// Repository interface for Service Broker service-related operations
/// </summary>
public interface IServiceRepository
{
    /// <summary>
    /// Gets all services defined in the database
    /// </summary>
    Task<List<ServiceInfo>> GetAllServicesAsync();

    /// <summary>
    /// Gets contracts associated with a specific service
    /// </summary>
    Task<List<ContractInfo>> GetContractsForServiceAsync(string serviceName);

    /// <summary>
    /// Gets all message types defined in the database
    /// </summary>
    Task<List<MessageTypeInfo>> GetMessageTypesAsync();
}
