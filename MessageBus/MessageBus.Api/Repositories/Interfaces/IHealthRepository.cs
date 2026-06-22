using MessageBus.Api.Services.Interfaces;

namespace MessageBus.Api.Repositories.Interfaces;

/// <summary>
/// Repository interface for health check database operations
/// </summary>
public interface IHealthRepository
{
    Task<HealthCheckResult> RunHealthCheckAsync();
}
