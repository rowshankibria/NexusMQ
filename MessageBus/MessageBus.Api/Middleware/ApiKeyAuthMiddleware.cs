using System.Text.Json;
using System.Text.RegularExpressions;
using MessageBus.Api.Models;
using MessageBus.Api.Services.Interfaces;

namespace MessageBus.Api.Middleware;

/// <summary>
/// Middleware for API key authentication using database-backed application registry
/// </summary>
public class ApiKeyAuthMiddleware
{
    private const string ApiKeyHeaderName = "X-API-Key";
    private readonly RequestDelegate _next;
    private readonly ILogger<ApiKeyAuthMiddleware> _logger;
    private readonly IConfiguration _configuration;

    // Regex to extract queue name from path
    private static readonly Regex QueueNameRegex = new(
        @"/api/(?:queues|messages)/([^/]+)",
        RegexOptions.IgnoreCase | RegexOptions.Compiled);

    public ApiKeyAuthMiddleware(
        RequestDelegate next,
        ILogger<ApiKeyAuthMiddleware> logger,
        IConfiguration configuration)
    {
        _next = next;
        _logger = logger;
        _configuration = configuration;
    }

    public async Task InvokeAsync(HttpContext context)
    {
        // Skip authentication for certain paths
        var path = context.Request.Path.Value?.ToLowerInvariant() ?? "";

        // Allow health check endpoints without API key
        if (path.Contains("/api/health/ping") ||
            path.Contains("/swagger") ||
            path.Contains("/hubs/"))
        {
            await _next(context);
            return;
        }

        // Check if API key authentication is enabled
        var apiKeySettings = _configuration.GetSection("ApiKey");
        var isEnabled = apiKeySettings.GetValue<bool>("Enabled");

        if (!isEnabled)
        {
            await _next(context);
            return;
        }

        // Get the API key from header
        if (!context.Request.Headers.TryGetValue(ApiKeyHeaderName, out var extractedApiKey))
        {
            _logger.LogWarning("API key not provided for request to {Path}", path);
            context.Response.StatusCode = 401;
            await context.Response.WriteAsJsonAsync(new
            {
                error = "Unauthorized",
                message = "API key is required. Please provide X-API-Key header."
            });
            return;
        }

        // Try database-backed authentication first
        var applicationService = context.RequestServices.GetService<IApplicationService>();
        Application? application = null;

        if (applicationService != null)
        {
            application = await applicationService.ValidateApiKeyAsync(extractedApiKey.ToString());
        }

        if (application != null)
        {
            // Database-backed authentication succeeded
            var permissions = ParseJsonArray(application.Permissions);
            var allowedQueues = ParseJsonArray(application.AllowedQueues);

            // Check permissions
            if (!HasPermission(permissions, allowedQueues, context.Request.Path, context.Request.Method))
            {
                _logger.LogWarning("Application {AppName} lacks permission for {Method} {Path}",
                    application.Name, context.Request.Method, path);
                context.Response.StatusCode = 403;
                await context.Response.WriteAsJsonAsync(new
                {
                    error = "Forbidden",
                    message = "API key does not have permission for this operation."
                });
                return;
            }

            // Add application info to context items for downstream use
            context.Items["ApiKeyName"] = application.Name;
            context.Items["ApiKeyPermissions"] = permissions;
            context.Items["ApplicationId"] = application.Id;

            _logger.LogDebug("Application authenticated: {AppName} for {Method} {Path}",
                application.Name, context.Request.Method, path);

            // Update last used timestamp (fire and forget)
            _ = Task.Run(async () =>
            {
                try
                {
                    await applicationService.UpdateLastUsedAsync(application.Id);
                }
                catch (Exception ex)
                {
                    _logger.LogWarning(ex, "Failed to update LastUsedAt for application {Id}", application.Id);
                }
            });

            await _next(context);
            return;
        }

        // Fallback to config-based authentication for backwards compatibility
        var validApiKeys = apiKeySettings.GetSection("ValidKeys").Get<List<ApiKeyConfig>>() ?? new();
        var matchedKey = validApiKeys.FirstOrDefault(k =>
            k.Key.Equals(extractedApiKey.ToString(), StringComparison.Ordinal));

        if (matchedKey == null)
        {
            _logger.LogWarning("Invalid API key provided for request to {Path}", path);
            context.Response.StatusCode = 401;
            await context.Response.WriteAsJsonAsync(new
            {
                error = "Unauthorized",
                message = "Invalid API key."
            });
            return;
        }

        // Check if key is active
        if (!matchedKey.IsActive)
        {
            _logger.LogWarning("Inactive API key used: {KeyName}", matchedKey.Name);
            context.Response.StatusCode = 401;
            await context.Response.WriteAsJsonAsync(new
            {
                error = "Unauthorized",
                message = "API key is inactive."
            });
            return;
        }

        // Check expiration
        if (matchedKey.ExpiresAt.HasValue && matchedKey.ExpiresAt.Value < DateTime.UtcNow)
        {
            _logger.LogWarning("Expired API key used: {KeyName}", matchedKey.Name);
            context.Response.StatusCode = 401;
            await context.Response.WriteAsJsonAsync(new
            {
                error = "Unauthorized",
                message = "API key has expired."
            });
            return;
        }

        // Check permissions for queue operations
        if (!HasPermission(matchedKey.Permissions, matchedKey.AllowedQueues, context.Request.Path, context.Request.Method))
        {
            _logger.LogWarning("API key {KeyName} lacks permission for {Method} {Path}",
                matchedKey.Name, context.Request.Method, path);
            context.Response.StatusCode = 403;
            await context.Response.WriteAsJsonAsync(new
            {
                error = "Forbidden",
                message = "API key does not have permission for this operation."
            });
            return;
        }

        // Add API key info to context items for downstream use
        context.Items["ApiKeyName"] = matchedKey.Name;
        context.Items["ApiKeyPermissions"] = matchedKey.Permissions;

        _logger.LogDebug("API key authenticated: {KeyName} for {Method} {Path}",
            matchedKey.Name, context.Request.Method, path);

        await _next(context);
    }

    private bool HasPermission(List<string> permissions, List<string>? allowedQueues, PathString path, string method)
    {
        // If no permissions are specified, allow all (for backwards compatibility)
        if (permissions == null || permissions.Count == 0)
        {
            return true;
        }

        var pathLower = path.Value?.ToLowerInvariant() ?? "";
        var methodLower = method.ToLowerInvariant();

        // Check queue-specific permissions
        if (allowedQueues != null && allowedQueues.Count > 0 && !allowedQueues.Contains("*"))
        {
            var queueName = ExtractQueueName(pathLower);
            if (!string.IsNullOrEmpty(queueName) && !allowedQueues.Contains(queueName))
            {
                _logger.LogDebug("Queue {QueueName} not in allowed queues list", queueName);
                return false;
            }
        }

        // Check for read permission (GET requests)
        if (methodLower == "get")
        {
            return permissions.Contains("read") || permissions.Contains("*");
        }

        // Check for write permission (POST, PUT, PATCH requests)
        if (methodLower is "post" or "put" or "patch")
        {
            // Special handling for dangerous operations
            if (pathLower.Contains("/purge") || pathLower.Contains("/bulk-purge"))
            {
                return permissions.Contains("admin") || permissions.Contains("*");
            }

            return permissions.Contains("write") ||
                   permissions.Contains("admin") ||
                   permissions.Contains("*");
        }

        // Check for delete permission (DELETE requests)
        if (methodLower == "delete")
        {
            return permissions.Contains("admin") || permissions.Contains("*");
        }

        return false;
    }

    private static string? ExtractQueueName(string path)
    {
        var match = QueueNameRegex.Match(path);
        return match.Success ? match.Groups[1].Value : null;
    }

    private static List<string> ParseJsonArray(string? json)
    {
        if (string.IsNullOrEmpty(json))
            return new List<string>();

        try
        {
            return JsonSerializer.Deserialize<List<string>>(json) ?? new List<string>();
        }
        catch
        {
            return new List<string>();
        }
    }
}

/// <summary>
/// Configuration for an API key (for backwards compatibility with appsettings.json)
/// </summary>
public class ApiKeyConfig
{
    public string Name { get; set; } = string.Empty;
    public string Key { get; set; } = string.Empty;
    public bool IsActive { get; set; } = true;
    public DateTime? ExpiresAt { get; set; }
    public List<string> Permissions { get; set; } = new();
    public List<string>? AllowedQueues { get; set; }
}

/// <summary>
/// Extension methods for API key middleware
/// </summary>
public static class ApiKeyAuthMiddlewareExtensions
{
    public static IApplicationBuilder UseApiKeyAuth(this IApplicationBuilder builder)
    {
        return builder.UseMiddleware<ApiKeyAuthMiddleware>();
    }
}
