namespace MessageBus.Api.Models;

/// <summary>
/// Represents a registered application that can access the MessageBus API
/// </summary>
public class Application
{
    public int Id { get; set; }
    public string Name { get; set; } = string.Empty;
    public string ApiKey { get; set; } = string.Empty;
    public string? Description { get; set; }
    public bool IsActive { get; set; } = true;
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    public DateTime? ExpiresAt { get; set; }
    public string Permissions { get; set; } = "[]"; // JSON array: ["read", "write", "admin", "*"]
    public string AllowedQueues { get; set; } = "[\"*\"]"; // JSON array: ["*"] or specific queue names
    public string? ContactEmail { get; set; }
    public DateTime? LastUsedAt { get; set; }
}

/// <summary>
/// Request model for registering a new application
/// </summary>
public class RegisterApplicationRequest
{
    public string Name { get; set; } = string.Empty;
    public string? Description { get; set; }
    public string? ContactEmail { get; set; }
    public DateTime? ExpiresAt { get; set; }
    public List<string> Permissions { get; set; } = new() { "read" };
    public List<string> AllowedQueues { get; set; } = new() { "*" };
}

/// <summary>
/// Request model for updating an application
/// </summary>
public class UpdateApplicationRequest
{
    public string? Name { get; set; }
    public string? Description { get; set; }
    public string? ContactEmail { get; set; }
    public bool? IsActive { get; set; }
    public DateTime? ExpiresAt { get; set; }
    public List<string>? Permissions { get; set; }
    public List<string>? AllowedQueues { get; set; }
}

/// <summary>
/// Response model for application registration (includes API key shown once)
/// </summary>
public class RegisterApplicationResponse
{
    public int Id { get; set; }
    public string Name { get; set; } = string.Empty;
    public string ApiKey { get; set; } = string.Empty; // Only returned on creation
    public string? Description { get; set; }
    public bool IsActive { get; set; }
    public DateTime CreatedAt { get; set; }
    public DateTime? ExpiresAt { get; set; }
    public List<string> Permissions { get; set; } = new();
    public List<string> AllowedQueues { get; set; } = new();
    public string? ContactEmail { get; set; }
}

/// <summary>
/// Response model for listing applications (API key masked)
/// </summary>
public class ApplicationResponse
{
    public int Id { get; set; }
    public string Name { get; set; } = string.Empty;
    public string ApiKeyMasked { get; set; } = string.Empty; // e.g., "mb-****a1b2"
    public string? Description { get; set; }
    public bool IsActive { get; set; }
    public DateTime CreatedAt { get; set; }
    public DateTime? ExpiresAt { get; set; }
    public List<string> Permissions { get; set; } = new();
    public List<string> AllowedQueues { get; set; } = new();
    public string? ContactEmail { get; set; }
    public DateTime? LastUsedAt { get; set; }
}

/// <summary>
/// Response for regenerating API key
/// </summary>
public class RegenerateKeyResponse
{
    public int Id { get; set; }
    public string Name { get; set; } = string.Empty;
    public string ApiKey { get; set; } = string.Empty; // New API key (shown once)
}
