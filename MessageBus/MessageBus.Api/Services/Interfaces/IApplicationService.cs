using MessageBus.Api.Models;

namespace MessageBus.Api.Services.Interfaces;

/// <summary>
/// Service interface for application registration business operations
/// </summary>
public interface IApplicationService
{
    /// <summary>
    /// Gets all registered applications (with masked API keys)
    /// </summary>
    Task<List<ApplicationResponse>> GetAllApplicationsAsync();

    /// <summary>
    /// Gets an application by ID (with masked API key)
    /// </summary>
    Task<ApplicationResponse?> GetApplicationByIdAsync(int id);

    /// <summary>
    /// Registers a new application and generates an API key
    /// </summary>
    Task<ServiceResult<RegisterApplicationResponse>> RegisterApplicationAsync(RegisterApplicationRequest request);

    /// <summary>
    /// Updates an existing application
    /// </summary>
    Task<ServiceResult<ApplicationResponse>> UpdateApplicationAsync(int id, UpdateApplicationRequest request);

    /// <summary>
    /// Deletes an application
    /// </summary>
    Task<ServiceResult> DeleteApplicationAsync(int id);

    /// <summary>
    /// Regenerates the API key for an application
    /// </summary>
    Task<ServiceResult<RegenerateKeyResponse>> RegenerateApiKeyAsync(int id);

    /// <summary>
    /// Validates an API key and returns the application if valid
    /// </summary>
    Task<Application?> ValidateApiKeyAsync(string apiKey);

    /// <summary>
    /// Updates the last used timestamp for an application
    /// </summary>
    Task UpdateLastUsedAsync(int id);
}
