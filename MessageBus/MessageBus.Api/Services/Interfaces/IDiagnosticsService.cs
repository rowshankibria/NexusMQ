using MessageBus.Api.Models;

namespace MessageBus.Api.Services.Interfaces;

/// <summary>
/// Service interface for diagnostics and system health operations
/// </summary>
public interface IDiagnosticsService
{
    /// <summary>
    /// Runs comprehensive health checks
    /// </summary>
    Task<DiagnosticsResult> RunHealthChecksAsync();

    /// <summary>
    /// Gets the overall system status
    /// </summary>
    Task<SystemStatus> GetSystemStatusAsync();

    /// <summary>
    /// Gets the Service Broker health information
    /// </summary>
    Task<ServiceBrokerHealthInfo?> GetBrokerStatusAsync();

    /// <summary>
    /// Gets the transmission queue status
    /// </summary>
    Task<List<TransmissionQueueItem>> GetTransmissionQueueAsync(int minStuckSeconds = 0, string? serviceNameFilter = null);

    /// <summary>
    /// Gets the transmission queue summary
    /// </summary>
    Task<TransmissionQueueSummary?> GetTransmissionQueueSummaryAsync();

    /// <summary>
    /// Gets dialog errors
    /// </summary>
    Task<List<DialogError>> GetDialogErrorsAsync(bool includeAllErrorStates = true, int minAgeSeconds = 0, string? serviceNameFilter = null);

    /// <summary>
    /// Gets performance metrics
    /// </summary>
    Task<List<PerformanceMetric>> GetPerformanceMetricsAsync(string? queueName = null, int hoursBack = 24, int aggregationMinutes = 0, int topN = 1000);

    /// <summary>
    /// Checks for orphaned conversations
    /// </summary>
    Task<List<OrphanedConversation>> CheckForOrphanedConversationsAsync(int thresholdHours = 24);

    /// <summary>
    /// Validates that all services have valid queues
    /// </summary>
    Task<List<ServiceValidationResult>> ValidateServicesHaveValidQueuesAsync();

    /// <summary>
    /// Gets a diagnostic summary for export/reporting
    /// </summary>
    Task<DiagnosticsSummary> GetDiagnosticsSummaryAsync();
}

/// <summary>
/// Comprehensive diagnostics result
/// </summary>
public class DiagnosticsResult
{
    public HealthLevel OverallStatus { get; set; }
    public string StatusDescription { get; set; } = string.Empty;
    public DateTime CheckedAt { get; set; } = DateTime.UtcNow;
    public int CriticalIssues { get; set; }
    public int Warnings { get; set; }
    public List<DiagnosticCheck> Checks { get; set; } = new();
    public string Recommendation { get; set; } = string.Empty;
}

/// <summary>
/// Individual diagnostic check result
/// </summary>
public class DiagnosticCheck
{
    public string Name { get; set; } = string.Empty;
    public string Category { get; set; } = string.Empty;
    public HealthLevel Status { get; set; }
    public string Message { get; set; } = string.Empty;
    public Dictionary<string, object> Details { get; set; } = new();
    public TimeSpan Duration { get; set; }
}

/// <summary>
/// Overall system status
/// </summary>
public class SystemStatus
{
    public HealthLevel Status { get; set; }
    public string Description { get; set; } = string.Empty;
    public DateTime CheckedAt { get; set; } = DateTime.UtcNow;
    public BrokerSystemStatus Broker { get; set; } = new();
    public QueueSystemStatus Queues { get; set; } = new();
    public ConversationSystemStatus Conversations { get; set; } = new();
    public TransmissionSystemStatus Transmission { get; set; } = new();
}

/// <summary>
/// Broker system status
/// </summary>
public class BrokerSystemStatus
{
    public bool IsEnabled { get; set; }
    public string? DatabaseName { get; set; }
    public string? BrokerGuid { get; set; }
    public HealthLevel Status { get; set; }
}

/// <summary>
/// Queue system status
/// </summary>
public class QueueSystemStatus
{
    public int TotalQueues { get; set; }
    public int ActiveQueues { get; set; }
    public int PausedQueues { get; set; }
    public int QueuesWithErrors { get; set; }
    public int TotalMessages { get; set; }
    public HealthLevel Status { get; set; }
}

/// <summary>
/// Conversation system status
/// </summary>
public class ConversationSystemStatus
{
    public int TotalActive { get; set; }
    public int InError { get; set; }
    public int Orphaned { get; set; }
    public HealthLevel Status { get; set; }
}

/// <summary>
/// Transmission queue system status
/// </summary>
public class TransmissionSystemStatus
{
    public int TotalMessages { get; set; }
    public int StuckMessages { get; set; }
    public HealthLevel Status { get; set; }
}

/// <summary>
/// Represents an orphaned conversation
/// </summary>
public class OrphanedConversation
{
    public Guid ConversationHandle { get; set; }
    public string State { get; set; } = string.Empty;
    public string LocalService { get; set; } = string.Empty;
    public string? FarService { get; set; }
    public DateTime Lifetime { get; set; }
    public TimeSpan Age { get; set; }
    public string Reason { get; set; } = string.Empty;
}

/// <summary>
/// Result of service validation
/// </summary>
public class ServiceValidationResult
{
    public string ServiceName { get; set; } = string.Empty;
    public bool IsValid { get; set; }
    public string? QueueName { get; set; }
    public bool QueueExists { get; set; }
    public bool QueueIsActive { get; set; }
    public List<string> Issues { get; set; } = new();
}

/// <summary>
/// Summary for diagnostics export/reporting
/// </summary>
public class DiagnosticsSummary
{
    public DateTime GeneratedAt { get; set; } = DateTime.UtcNow;
    public SystemStatus SystemStatus { get; set; } = new();
    public DiagnosticsResult HealthChecks { get; set; } = new();
    public PoisonMessageStats PoisonMessages { get; set; } = new();
    public List<OrphanedConversation> OrphanedConversations { get; set; } = new();
    public List<ServiceValidationResult> ServiceValidations { get; set; } = new();
    public TransmissionQueueSummary? TransmissionSummary { get; set; }
}
