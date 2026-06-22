using MessageBus.Api.Models;

namespace MessageBus.Api.Repositories.Interfaces;

/// <summary>
/// Repository interface for application registration operations
/// </summary>
public interface IApplicationRepository
{
    /// <summary>
    /// Gets all registered applications
    /// </summary>
    Task<List<Application>> GetAllAsync();

    /// <summary>
    /// Gets an application by ID
    /// </summary>
    Task<Application?> GetByIdAsync(int id);

    /// <summary>
    /// Gets an application by its API key (for authentication)
    /// </summary>
    Task<Application?> GetByApiKeyAsync(string apiKey);

    /// <summary>
    /// Gets an application by name
    /// </summary>
    Task<Application?> GetByNameAsync(string name);

    /// <summary>
    /// Creates a new application
    /// </summary>
    Task<Application> CreateAsync(Application application);

    /// <summary>
    /// Updates an existing application
    /// </summary>
    Task<Application> UpdateAsync(Application application);

    /// <summary>
    /// Deletes an application
    /// </summary>
    Task DeleteAsync(int id);

    /// <summary>
    /// Updates the LastUsedAt timestamp for an application
    /// </summary>
    Task UpdateLastUsedAsync(int id);

    /// <summary>
    /// Checks if an API key already exists
    /// </summary>
    Task<bool> ApiKeyExistsAsync(string apiKey);
}
