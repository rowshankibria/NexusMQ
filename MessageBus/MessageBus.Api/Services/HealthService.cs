using MessageBus.Api.Repositories.Interfaces;
using MessageBus.Api.Services.Interfaces;

namespace MessageBus.Api.Services;

/// <summary>
/// Service for health check operations
/// </summary>
public class HealthService : IHealthService
{
    private readonly IHealthRepository _healthRepository;
    private readonly ILogger<HealthService> _logger;

    public HealthService(IHealthRepository healthRepository, ILogger<HealthService> logger)
    {
        _healthRepository = healthRepository;
        _logger = logger;
    }

    public async Task<HealthCheckResult> RunHealthCheckAsync()
    {
        _logger.LogInformation("Running health check...");
        var result = await _healthRepository.RunHealthCheckAsync();
        _logger.LogInformation("Health check completed with status: {Status}", result.OverallStatus);
        return result;
    }
}
