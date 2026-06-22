using System.Security.Cryptography;
using System.Text.Json;
using MessageBus.Api.Models;
using MessageBus.Api.Repositories.Interfaces;
using MessageBus.Api.Services.Interfaces;

namespace MessageBus.Api.Services;

/// <summary>
/// Service implementation for application registration business operations
/// </summary>
public class ApplicationService : IApplicationService
{
    private readonly IApplicationRepository _repository;
    private readonly ILogger<ApplicationService> _logger;

    public ApplicationService(IApplicationRepository repository, ILogger<ApplicationService> logger)
    {
        _repository = repository;
        _logger = logger;
    }

    public async Task<List<ApplicationResponse>> GetAllApplicationsAsync()
    {
        var applications = await _repository.GetAllAsync();
        return applications.Select(MapToResponse).ToList();
    }

    public async Task<ApplicationResponse?> GetApplicationByIdAsync(int id)
    {
        var application = await _repository.GetByIdAsync(id);
        return application != null ? MapToResponse(application) : null;
    }

    public async Task<ServiceResult<RegisterApplicationResponse>> RegisterApplicationAsync(RegisterApplicationRequest request)
    {
        // Validate request
        if (string.IsNullOrWhiteSpace(request.Name))
        {
            return ServiceResult<RegisterApplicationResponse>.Fail("Application name is required");
        }

        // Check if name already exists
        var existing = await _repository.GetByNameAsync(request.Name);
        if (existing != null)
        {
            return ServiceResult<RegisterApplicationResponse>.Fail($"An application with name '{request.Name}' already exists");
        }

        // Generate unique API key
        var apiKey = await GenerateUniqueApiKeyAsync();

        var application = new Application
        {
            Name = request.Name,
            ApiKey = apiKey,
            Description = request.Description,
            ContactEmail = request.ContactEmail,
            ExpiresAt = request.ExpiresAt,
            Permissions = JsonSerializer.Serialize(request.Permissions),
            AllowedQueues = JsonSerializer.Serialize(request.AllowedQueues),
            IsActive = true,
            CreatedAt = DateTime.UtcNow
        };

        var created = await _repository.CreateAsync(application);
        _logger.LogInformation("Registered new application: {Name} (ID: {Id})", created.Name, created.Id);

        var response = new RegisterApplicationResponse
        {
            Id = created.Id,
            Name = created.Name,
            ApiKey = created.ApiKey, // Full key shown only on creation
            Description = created.Description,
            IsActive = created.IsActive,
            CreatedAt = created.CreatedAt,
            ExpiresAt = created.ExpiresAt,
            Permissions = request.Permissions,
            AllowedQueues = request.AllowedQueues,
            ContactEmail = created.ContactEmail
        };

        return ServiceResult<RegisterApplicationResponse>.Ok(response, "Application registered successfully");
    }

    public async Task<ServiceResult<ApplicationResponse>> UpdateApplicationAsync(int id, UpdateApplicationRequest request)
    {
        var application = await _repository.GetByIdAsync(id);
        if (application == null)
        {
            return ServiceResult<ApplicationResponse>.Fail("Application not found");
        }

        // Check for name conflict if name is being updated
        if (!string.IsNullOrWhiteSpace(request.Name) && request.Name != application.Name)
        {
            var existing = await _repository.GetByNameAsync(request.Name);
            if (existing != null)
            {
                return ServiceResult<ApplicationResponse>.Fail($"An application with name '{request.Name}' already exists");
            }
            application.Name = request.Name;
        }

        // Update fields if provided
        if (request.Description != null)
            application.Description = request.Description;
        if (request.ContactEmail != null)
            application.ContactEmail = request.ContactEmail;
        if (request.IsActive.HasValue)
            application.IsActive = request.IsActive.Value;
        if (request.ExpiresAt.HasValue)
            application.ExpiresAt = request.ExpiresAt.Value;
        if (request.Permissions != null)
            application.Permissions = JsonSerializer.Serialize(request.Permissions);
        if (request.AllowedQueues != null)
            application.AllowedQueues = JsonSerializer.Serialize(request.AllowedQueues);

        var updated = await _repository.UpdateAsync(application);
        _logger.LogInformation("Updated application: {Name} (ID: {Id})", updated.Name, updated.Id);

        return ServiceResult<ApplicationResponse>.Ok(MapToResponse(updated), "Application updated successfully");
    }

    public async Task<ServiceResult> DeleteApplicationAsync(int id)
    {
        var application = await _repository.GetByIdAsync(id);
        if (application == null)
        {
            return ServiceResult.Fail("Application not found");
        }

        await _repository.DeleteAsync(id);
        _logger.LogInformation("Deleted application: {Name} (ID: {Id})", application.Name, id);

        return ServiceResult.Ok("Application deleted successfully");
    }

    public async Task<ServiceResult<RegenerateKeyResponse>> RegenerateApiKeyAsync(int id)
    {
        var application = await _repository.GetByIdAsync(id);
        if (application == null)
        {
            return ServiceResult<RegenerateKeyResponse>.Fail("Application not found");
        }

        var newApiKey = await GenerateUniqueApiKeyAsync();
        application.ApiKey = newApiKey;

        await _repository.UpdateAsync(application);
        _logger.LogInformation("Regenerated API key for application: {Name} (ID: {Id})", application.Name, id);

        var response = new RegenerateKeyResponse
        {
            Id = application.Id,
            Name = application.Name,
            ApiKey = newApiKey // New key shown once
        };

        return ServiceResult<RegenerateKeyResponse>.Ok(response, "API key regenerated successfully");
    }

    public async Task<Application?> ValidateApiKeyAsync(string apiKey)
    {
        if (string.IsNullOrWhiteSpace(apiKey))
            return null;

        var application = await _repository.GetByApiKeyAsync(apiKey);
        if (application == null)
            return null;

        // Check if active
        if (!application.IsActive)
            return null;

        // Check expiration
        if (application.ExpiresAt.HasValue && application.ExpiresAt.Value < DateTime.UtcNow)
            return null;

        return application;
    }

    public async Task UpdateLastUsedAsync(int id)
    {
        await _repository.UpdateLastUsedAsync(id);
    }

    private ApplicationResponse MapToResponse(Application application)
    {
        return new ApplicationResponse
        {
            Id = application.Id,
            Name = application.Name,
            ApiKeyMasked = MaskApiKey(application.ApiKey),
            Description = application.Description,
            IsActive = application.IsActive,
            CreatedAt = application.CreatedAt,
            ExpiresAt = application.ExpiresAt,
            Permissions = ParseJsonArray(application.Permissions),
            AllowedQueues = ParseJsonArray(application.AllowedQueues),
            ContactEmail = application.ContactEmail,
            LastUsedAt = application.LastUsedAt
        };
    }

    private static string MaskApiKey(string apiKey)
    {
        if (string.IsNullOrEmpty(apiKey) || apiKey.Length < 8)
            return "****";

        // Show first 3 chars and last 4 chars
        return $"{apiKey[..3]}****{apiKey[^4..]}";
    }

    private static List<string> ParseJsonArray(string json)
    {
        try
        {
            return JsonSerializer.Deserialize<List<string>>(json) ?? new List<string>();
        }
        catch
        {
            return new List<string>();
        }
    }

    private async Task<string> GenerateUniqueApiKeyAsync()
    {
        string apiKey;
        bool exists;

        do
        {
            apiKey = GenerateApiKey();
            exists = await _repository.ApiKeyExistsAsync(apiKey);
        } while (exists);

        return apiKey;
    }

    private static string GenerateApiKey()
    {
        // Generate a secure random API key with prefix "mb-"
        var bytes = new byte[24];
        using var rng = RandomNumberGenerator.Create();
        rng.GetBytes(bytes);
        var base64 = Convert.ToBase64String(bytes)
            .Replace("+", "")
            .Replace("/", "")
            .Replace("=", "");
        return $"mb-{base64[..32]}";
    }
}
