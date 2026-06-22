using MessageBus.Api.Models;

namespace MessageBus.Api.Repositories.Interfaces;

/// <summary>
/// Repository interface for diagnostics and health check operations
/// </summary>
public interface IDiagnosticsRepository
{
    /// <summary>
    /// Gets the overall Service Broker health status
    /// </summary>
    Task<ServiceBrokerHealthInfo?> GetBrokerStatusAsync();

    /// <summary>
    /// Gets the transmission queue status with optional filtering
    /// </summary>
    Task<List<TransmissionQueueItem>> GetTransmissionQueueAsync(int minStuckSeconds = 0, string? serviceNameFilter = null);

    /// <summary>
    /// Gets the transmission queue summary
    /// </summary>
    Task<TransmissionQueueSummary?> GetTransmissionQueueSummaryAsync();

    /// <summary>
    /// Gets dialog errors with optional filtering
    /// </summary>
    Task<List<DialogError>> GetDialogErrorsAsync(bool includeAllErrorStates = true, int minAgeSeconds = 0, string? serviceNameFilter = null);

    /// <summary>
    /// Gets performance metrics with optional filtering and aggregation
    /// </summary>
    Task<List<PerformanceMetric>> GetPerformanceMetricsAsync(string? queueName = null, int hoursBack = 24, int aggregationMinutes = 0, int topN = 1000);

    /// <summary>
    /// Runs a comprehensive health check
    /// </summary>
    Task<HealthCheckResult?> RunHealthCheckAsync(int orphanedConversationHours = 24, int oldMessageMinutes = 60);
}
