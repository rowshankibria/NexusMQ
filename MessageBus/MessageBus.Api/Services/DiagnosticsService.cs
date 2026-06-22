using System.Diagnostics;
using MessageBus.Api.Models;
using MessageBus.Api.Repositories.Interfaces;
using MessageBus.Api.Services.Interfaces;
using Microsoft.Extensions.Logging;

namespace MessageBus.Api.Services;

/// <summary>
/// Service implementation for diagnostics and system health operations
/// </summary>
public class DiagnosticsService : IDiagnosticsService
{
    private readonly IDiagnosticsRepository _diagnosticsRepository;
    private readonly IQueueRepository _queueRepository;
    private readonly IServiceRepository _serviceRepository;
    private readonly IConversationRepository _conversationRepository;
    private readonly IPoisonMessageService _poisonMessageService;
    private readonly ILogger<DiagnosticsService> _logger;

    // Thresholds for health calculations
    private const int OrphanedConversationThresholdHours = 24;
    private const int TransmissionQueueWarningThreshold = 10;
    private const int TransmissionQueueCriticalThreshold = 100;
    private const int ErrorConversationWarningThreshold = 5;
    private const int ErrorConversationCriticalThreshold = 20;

    public DiagnosticsService(
        IDiagnosticsRepository diagnosticsRepository,
        IQueueRepository queueRepository,
        IServiceRepository serviceRepository,
        IConversationRepository conversationRepository,
        IPoisonMessageService poisonMessageService,
        ILogger<DiagnosticsService> logger)
    {
        _diagnosticsRepository = diagnosticsRepository;
        _queueRepository = queueRepository;
        _serviceRepository = serviceRepository;
        _conversationRepository = conversationRepository;
        _poisonMessageService = poisonMessageService;
        _logger = logger;
    }

    public async Task<DiagnosticsResult> RunHealthChecksAsync()
    {
        _logger.LogInformation("Starting comprehensive health checks");

        var result = new DiagnosticsResult
        {
            CheckedAt = DateTime.UtcNow
        };

        var checks = new List<DiagnosticCheck>();

        // 1. Check Service Broker Status
        checks.Add(await RunBrokerStatusCheckAsync());

        // 2. Check Queue Health
        checks.Add(await RunQueueHealthCheckAsync());

        // 3. Check Transmission Queue
        checks.Add(await RunTransmissionQueueCheckAsync());

        // 4. Check Conversations
        checks.Add(await RunConversationCheckAsync());

        // 5. Check for Orphaned Conversations
        checks.Add(await RunOrphanedConversationCheckAsync());

        // 6. Check Poison Messages
        checks.Add(await RunPoisonMessageCheckAsync());

        // 7. Validate Services
        checks.Add(await RunServiceValidationCheckAsync());

        result.Checks = checks;

        // Calculate overall status
        var criticalCount = checks.Count(c => c.Status == HealthLevel.Critical);
        var warningCount = checks.Count(c => c.Status == HealthLevel.Warning);

        result.CriticalIssues = criticalCount;
        result.Warnings = warningCount;

        if (criticalCount > 0)
        {
            result.OverallStatus = HealthLevel.Critical;
            result.StatusDescription = $"System has {criticalCount} critical issue(s)";
            result.Recommendation = "Investigate critical issues immediately";
        }
        else if (warningCount > 0)
        {
            result.OverallStatus = HealthLevel.Warning;
            result.StatusDescription = $"System has {warningCount} warning(s)";
            result.Recommendation = "Review warnings when convenient";
        }
        else
        {
            result.OverallStatus = HealthLevel.Healthy;
            result.StatusDescription = "All systems operating normally";
            result.Recommendation = "No action required";
        }

        _logger.LogInformation("Health checks completed. Status: {Status}, Critical: {Critical}, Warnings: {Warnings}",
            result.OverallStatus, criticalCount, warningCount);

        return result;
    }

    public async Task<SystemStatus> GetSystemStatusAsync()
    {
        _logger.LogDebug("Getting system status");

        var status = new SystemStatus
        {
            CheckedAt = DateTime.UtcNow
        };

        // Broker status
        var brokerInfo = await _diagnosticsRepository.GetBrokerStatusAsync();
        if (brokerInfo != null)
        {
            status.Broker = new BrokerSystemStatus
            {
                IsEnabled = brokerInfo.IsBrokerEnabled,
                DatabaseName = brokerInfo.DatabaseName,
                BrokerGuid = brokerInfo.BrokerGuid.ToString(),
                Status = brokerInfo.IsBrokerEnabled ? HealthLevel.Healthy : HealthLevel.Critical
            };
        }

        // Queue status
        var queues = await _queueRepository.GetAllQueuesAsync(includeSystemQueues: false);
        status.Queues = new QueueSystemStatus
        {
            TotalQueues = queues.Count,
            ActiveQueues = queues.Count(q => q.IsReceiveEnabled),
            PausedQueues = queues.Count(q => !q.IsReceiveEnabled),
            QueuesWithErrors = queues.Count(q => q.ErrorConversations > 0),
            TotalMessages = queues.Sum(q => q.MessageCount),
            Status = queues.Any(q => q.ErrorConversations > ErrorConversationCriticalThreshold)
                ? HealthLevel.Critical
                : queues.Any(q => q.ErrorConversations > ErrorConversationWarningThreshold)
                    ? HealthLevel.Warning
                    : HealthLevel.Healthy
        };

        // Conversation status
        var conversations = await _conversationRepository.GetConversationsAsync();
        var orphaned = await CheckForOrphanedConversationsAsync();
        status.Conversations = new ConversationSystemStatus
        {
            TotalActive = conversations.Count,
            InError = conversations.Count(c => c.State == "ER"),
            Orphaned = orphaned.Count,
            Status = orphaned.Count > 10 ? HealthLevel.Critical
                : orphaned.Count > 0 ? HealthLevel.Warning
                : HealthLevel.Healthy
        };

        // Transmission queue status
        var transmissionSummary = await _diagnosticsRepository.GetTransmissionQueueSummaryAsync();
        if (transmissionSummary != null)
        {
            status.Transmission = new TransmissionSystemStatus
            {
                TotalMessages = transmissionSummary.TotalMessages,
                StuckMessages = transmissionSummary.StuckOver5Min,
                Status = transmissionSummary.StuckOver30Min > TransmissionQueueCriticalThreshold
                    ? HealthLevel.Critical
                    : transmissionSummary.StuckOver5Min > TransmissionQueueWarningThreshold
                        ? HealthLevel.Warning
                        : HealthLevel.Healthy
            };
        }

        // Calculate overall status
        var statuses = new[] { status.Broker.Status, status.Queues.Status, status.Conversations.Status, status.Transmission.Status };
        if (statuses.Any(s => s == HealthLevel.Critical))
        {
            status.Status = HealthLevel.Critical;
            status.Description = "System requires immediate attention";
        }
        else if (statuses.Any(s => s == HealthLevel.Warning))
        {
            status.Status = HealthLevel.Warning;
            status.Description = "System has warnings";
        }
        else
        {
            status.Status = HealthLevel.Healthy;
            status.Description = "System is healthy";
        }

        return status;
    }

    public async Task<ServiceBrokerHealthInfo?> GetBrokerStatusAsync()
    {
        _logger.LogDebug("Getting broker status");
        return await _diagnosticsRepository.GetBrokerStatusAsync();
    }

    public async Task<List<TransmissionQueueItem>> GetTransmissionQueueAsync(int minStuckSeconds = 0, string? serviceNameFilter = null)
    {
        _logger.LogDebug("Getting transmission queue. MinStuckSeconds: {MinStuckSeconds}, ServiceFilter: {ServiceFilter}",
            minStuckSeconds, serviceNameFilter);
        return await _diagnosticsRepository.GetTransmissionQueueAsync(minStuckSeconds, serviceNameFilter);
    }

    public async Task<TransmissionQueueSummary?> GetTransmissionQueueSummaryAsync()
    {
        _logger.LogDebug("Getting transmission queue summary");
        return await _diagnosticsRepository.GetTransmissionQueueSummaryAsync();
    }

    public async Task<List<DialogError>> GetDialogErrorsAsync(bool includeAllErrorStates = true, int minAgeSeconds = 0, string? serviceNameFilter = null)
    {
        _logger.LogDebug("Getting dialog errors. IncludeAll: {IncludeAll}, MinAge: {MinAge}s, ServiceFilter: {ServiceFilter}",
            includeAllErrorStates, minAgeSeconds, serviceNameFilter);
        return await _diagnosticsRepository.GetDialogErrorsAsync(includeAllErrorStates, minAgeSeconds, serviceNameFilter);
    }

    public async Task<List<PerformanceMetric>> GetPerformanceMetricsAsync(string? queueName = null, int hoursBack = 24, int aggregationMinutes = 0, int topN = 1000)
    {
        _logger.LogDebug("Getting performance metrics. QueueName: {QueueName}, HoursBack: {HoursBack}",
            queueName, hoursBack);
        return await _diagnosticsRepository.GetPerformanceMetricsAsync(queueName, hoursBack, aggregationMinutes, topN);
    }

    public async Task<List<OrphanedConversation>> CheckForOrphanedConversationsAsync(int thresholdHours = 24)
    {
        _logger.LogDebug("Checking for orphaned conversations. Threshold: {ThresholdHours} hours", thresholdHours);

        var conversations = await _conversationRepository.GetConversationsAsync();
        var orphaned = new List<OrphanedConversation>();

        var thresholdTime = DateTime.UtcNow.AddHours(-thresholdHours);

        foreach (var conversation in conversations)
        {
            var age = DateTime.UtcNow - conversation.Lifetime.AddSeconds(-conversation.SecondsRemaining);
            var isOrphaned = false;
            var reason = "";

            // Check for conversations that have been active too long
            if (age.TotalHours > thresholdHours && conversation.State == "CO")
            {
                isOrphaned = true;
                reason = $"Conversation has been active for {age.TotalHours:F1} hours without completion";
            }

            // Check for conversations in error state
            if (conversation.State == "ER")
            {
                isOrphaned = true;
                reason = "Conversation is in error state";
            }

            // Check for conversations with no far service (one-sided)
            if (string.IsNullOrEmpty(conversation.FarService) && conversation.State != "SO")
            {
                isOrphaned = true;
                reason = "Conversation has no target service";
            }

            if (isOrphaned)
            {
                orphaned.Add(new OrphanedConversation
                {
                    ConversationHandle = conversation.ConversationHandle,
                    State = conversation.State,
                    LocalService = conversation.LocalService,
                    FarService = conversation.FarService,
                    Lifetime = conversation.Lifetime,
                    Age = age,
                    Reason = reason
                });
            }
        }

        _logger.LogInformation("Found {Count} orphaned conversations", orphaned.Count);
        return orphaned;
    }

    public async Task<List<ServiceValidationResult>> ValidateServicesHaveValidQueuesAsync()
    {
        _logger.LogDebug("Validating services have valid queues");

        var services = await _serviceRepository.GetAllServicesAsync();
        var queues = await _queueRepository.GetAllQueuesAsync(includeSystemQueues: true);
        var results = new List<ServiceValidationResult>();

        foreach (var service in services)
        {
            var validation = new ServiceValidationResult
            {
                ServiceName = service.ServiceName,
                QueueName = service.QueueName
            };

            var queue = queues.FirstOrDefault(q => q.QueueName == service.QueueName);

            if (queue == null)
            {
                validation.IsValid = false;
                validation.QueueExists = false;
                validation.QueueIsActive = false;
                validation.Issues.Add($"Queue '{service.QueueName}' does not exist");
            }
            else
            {
                validation.QueueExists = true;
                validation.QueueIsActive = queue.IsReceiveEnabled;

                if (!queue.IsReceiveEnabled)
                {
                    validation.Issues.Add("Queue receive is disabled");
                }

                if (!queue.IsActivationEnabled)
                {
                    validation.Issues.Add("Queue activation is disabled");
                }

                if (queue.ErrorConversations > 0)
                {
                    validation.Issues.Add($"Queue has {queue.ErrorConversations} error conversations");
                }

                validation.IsValid = validation.Issues.Count == 0;
            }

            results.Add(validation);
        }

        var invalidCount = results.Count(r => !r.IsValid);
        _logger.LogInformation("Service validation completed. {Total} services, {Invalid} with issues",
            results.Count, invalidCount);

        return results;
    }

    public async Task<DiagnosticsSummary> GetDiagnosticsSummaryAsync()
    {
        _logger.LogInformation("Generating diagnostics summary");

        var summary = new DiagnosticsSummary
        {
            GeneratedAt = DateTime.UtcNow,
            SystemStatus = await GetSystemStatusAsync(),
            HealthChecks = await RunHealthChecksAsync(),
            PoisonMessages = await _poisonMessageService.GetPoisonMessageStatsAsync(),
            OrphanedConversations = await CheckForOrphanedConversationsAsync(),
            ServiceValidations = await ValidateServicesHaveValidQueuesAsync(),
            TransmissionSummary = await _diagnosticsRepository.GetTransmissionQueueSummaryAsync()
        };

        _logger.LogInformation("Diagnostics summary generated successfully");
        return summary;
    }

    // Private helper methods for individual checks

    private async Task<DiagnosticCheck> RunBrokerStatusCheckAsync()
    {
        var stopwatch = Stopwatch.StartNew();
        var check = new DiagnosticCheck
        {
            Name = "Service Broker Status",
            Category = "Infrastructure"
        };

        try
        {
            var brokerInfo = await _diagnosticsRepository.GetBrokerStatusAsync();
            stopwatch.Stop();
            check.Duration = stopwatch.Elapsed;

            if (brokerInfo == null)
            {
                check.Status = HealthLevel.Critical;
                check.Message = "Unable to retrieve Service Broker status";
                return check;
            }

            check.Details["DatabaseName"] = brokerInfo.DatabaseName;
            check.Details["BrokerGuid"] = brokerInfo.BrokerGuid.ToString();
            check.Details["IsEnabled"] = brokerInfo.IsBrokerEnabled;

            if (!brokerInfo.IsBrokerEnabled)
            {
                check.Status = HealthLevel.Critical;
                check.Message = "Service Broker is disabled";
            }
            else
            {
                check.Status = HealthLevel.Healthy;
                check.Message = "Service Broker is enabled and running";
            }
        }
        catch (Exception ex)
        {
            stopwatch.Stop();
            check.Duration = stopwatch.Elapsed;
            check.Status = HealthLevel.Critical;
            check.Message = $"Error checking broker status: {ex.Message}";
        }

        return check;
    }

    private async Task<DiagnosticCheck> RunQueueHealthCheckAsync()
    {
        var stopwatch = Stopwatch.StartNew();
        var check = new DiagnosticCheck
        {
            Name = "Queue Health",
            Category = "Queues"
        };

        try
        {
            var queues = await _queueRepository.GetAllQueuesAsync(includeSystemQueues: false);
            stopwatch.Stop();
            check.Duration = stopwatch.Elapsed;

            var pausedQueues = queues.Where(q => !q.IsReceiveEnabled).ToList();
            var queuesWithErrors = queues.Where(q => q.ErrorConversations > 0).ToList();

            check.Details["TotalQueues"] = queues.Count;
            check.Details["PausedQueues"] = pausedQueues.Count;
            check.Details["QueuesWithErrors"] = queuesWithErrors.Count;

            if (queuesWithErrors.Any(q => q.ErrorConversations >= ErrorConversationCriticalThreshold))
            {
                check.Status = HealthLevel.Critical;
                check.Message = $"Queues with critical error counts: {string.Join(", ", queuesWithErrors.Where(q => q.ErrorConversations >= ErrorConversationCriticalThreshold).Select(q => q.QueueName))}";
            }
            else if (pausedQueues.Any() || queuesWithErrors.Any())
            {
                check.Status = HealthLevel.Warning;
                check.Message = $"{pausedQueues.Count} paused queue(s), {queuesWithErrors.Count} queue(s) with errors";
            }
            else
            {
                check.Status = HealthLevel.Healthy;
                check.Message = $"All {queues.Count} queues are healthy";
            }
        }
        catch (Exception ex)
        {
            stopwatch.Stop();
            check.Duration = stopwatch.Elapsed;
            check.Status = HealthLevel.Critical;
            check.Message = $"Error checking queue health: {ex.Message}";
        }

        return check;
    }

    private async Task<DiagnosticCheck> RunTransmissionQueueCheckAsync()
    {
        var stopwatch = Stopwatch.StartNew();
        var check = new DiagnosticCheck
        {
            Name = "Transmission Queue",
            Category = "Infrastructure"
        };

        try
        {
            var summary = await _diagnosticsRepository.GetTransmissionQueueSummaryAsync();
            stopwatch.Stop();
            check.Duration = stopwatch.Elapsed;

            if (summary == null)
            {
                check.Status = HealthLevel.Warning;
                check.Message = "Unable to retrieve transmission queue summary";
                return check;
            }

            check.Details["TotalMessages"] = summary.TotalMessages;
            check.Details["StuckOver5Min"] = summary.StuckOver5Min;
            check.Details["StuckOver30Min"] = summary.StuckOver30Min;
            check.Details["StuckOver1Hour"] = summary.StuckOver1Hour;
            check.Details["WithErrors"] = summary.WithErrors;

            if (summary.StuckOver30Min > TransmissionQueueCriticalThreshold)
            {
                check.Status = HealthLevel.Critical;
                check.Message = $"{summary.StuckOver30Min} messages stuck for over 30 minutes";
            }
            else if (summary.StuckOver5Min > TransmissionQueueWarningThreshold)
            {
                check.Status = HealthLevel.Warning;
                check.Message = $"{summary.StuckOver5Min} messages stuck for over 5 minutes";
            }
            else
            {
                check.Status = HealthLevel.Healthy;
                check.Message = $"Transmission queue healthy ({summary.TotalMessages} total messages)";
            }
        }
        catch (Exception ex)
        {
            stopwatch.Stop();
            check.Duration = stopwatch.Elapsed;
            check.Status = HealthLevel.Critical;
            check.Message = $"Error checking transmission queue: {ex.Message}";
        }

        return check;
    }

    private async Task<DiagnosticCheck> RunConversationCheckAsync()
    {
        var stopwatch = Stopwatch.StartNew();
        var check = new DiagnosticCheck
        {
            Name = "Conversation Status",
            Category = "Conversations"
        };

        try
        {
            var conversations = await _conversationRepository.GetConversationsAsync();
            stopwatch.Stop();
            check.Duration = stopwatch.Elapsed;

            var errorConversations = conversations.Where(c => c.State == "ER").ToList();

            check.Details["TotalActive"] = conversations.Count;
            check.Details["InError"] = errorConversations.Count;
            check.Details["Conversing"] = conversations.Count(c => c.State == "CO");

            if (errorConversations.Count >= ErrorConversationCriticalThreshold)
            {
                check.Status = HealthLevel.Critical;
                check.Message = $"{errorConversations.Count} conversations in error state";
            }
            else if (errorConversations.Any())
            {
                check.Status = HealthLevel.Warning;
                check.Message = $"{errorConversations.Count} conversation(s) in error state";
            }
            else
            {
                check.Status = HealthLevel.Healthy;
                check.Message = $"{conversations.Count} active conversations, none in error";
            }
        }
        catch (Exception ex)
        {
            stopwatch.Stop();
            check.Duration = stopwatch.Elapsed;
            check.Status = HealthLevel.Critical;
            check.Message = $"Error checking conversations: {ex.Message}";
        }

        return check;
    }

    private async Task<DiagnosticCheck> RunOrphanedConversationCheckAsync()
    {
        var stopwatch = Stopwatch.StartNew();
        var check = new DiagnosticCheck
        {
            Name = "Orphaned Conversations",
            Category = "Conversations"
        };

        try
        {
            var orphaned = await CheckForOrphanedConversationsAsync(OrphanedConversationThresholdHours);
            stopwatch.Stop();
            check.Duration = stopwatch.Elapsed;

            check.Details["OrphanedCount"] = orphaned.Count;
            check.Details["ThresholdHours"] = OrphanedConversationThresholdHours;

            if (orphaned.Count > 10)
            {
                check.Status = HealthLevel.Critical;
                check.Message = $"{orphaned.Count} orphaned conversations detected";
            }
            else if (orphaned.Any())
            {
                check.Status = HealthLevel.Warning;
                check.Message = $"{orphaned.Count} orphaned conversation(s) detected";
            }
            else
            {
                check.Status = HealthLevel.Healthy;
                check.Message = "No orphaned conversations detected";
            }
        }
        catch (Exception ex)
        {
            stopwatch.Stop();
            check.Duration = stopwatch.Elapsed;
            check.Status = HealthLevel.Critical;
            check.Message = $"Error checking orphaned conversations: {ex.Message}";
        }

        return check;
    }

    private async Task<DiagnosticCheck> RunPoisonMessageCheckAsync()
    {
        var stopwatch = Stopwatch.StartNew();
        var check = new DiagnosticCheck
        {
            Name = "Poison Messages",
            Category = "Messages"
        };

        try
        {
            var stats = await _poisonMessageService.GetPoisonMessageStatsAsync();
            stopwatch.Stop();
            check.Duration = stopwatch.Elapsed;

            check.Details["TotalPoisonMessages"] = stats.TotalPoisonMessages;
            check.Details["UnresolvedDeadLettered"] = stats.UnresolvedDeadLettered;

            if (stats.TotalPoisonMessages > 50 || stats.UnresolvedDeadLettered > 100)
            {
                check.Status = HealthLevel.Critical;
                check.Message = $"{stats.TotalPoisonMessages} poison messages, {stats.UnresolvedDeadLettered} unresolved dead letters";
            }
            else if (stats.TotalPoisonMessages > 0 || stats.UnresolvedDeadLettered > 0)
            {
                check.Status = HealthLevel.Warning;
                check.Message = $"{stats.TotalPoisonMessages} poison message(s), {stats.UnresolvedDeadLettered} unresolved dead letter(s)";
            }
            else
            {
                check.Status = HealthLevel.Healthy;
                check.Message = "No poison messages or unresolved dead letters";
            }
        }
        catch (Exception ex)
        {
            stopwatch.Stop();
            check.Duration = stopwatch.Elapsed;
            check.Status = HealthLevel.Critical;
            check.Message = $"Error checking poison messages: {ex.Message}";
        }

        return check;
    }

    private async Task<DiagnosticCheck> RunServiceValidationCheckAsync()
    {
        var stopwatch = Stopwatch.StartNew();
        var check = new DiagnosticCheck
        {
            Name = "Service Validation",
            Category = "Configuration"
        };

        try
        {
            var validations = await ValidateServicesHaveValidQueuesAsync();
            stopwatch.Stop();
            check.Duration = stopwatch.Elapsed;

            var invalidServices = validations.Where(v => !v.IsValid).ToList();

            check.Details["TotalServices"] = validations.Count;
            check.Details["InvalidServices"] = invalidServices.Count;

            if (invalidServices.Any(s => !s.QueueExists))
            {
                check.Status = HealthLevel.Critical;
                check.Message = $"Services with missing queues: {string.Join(", ", invalidServices.Where(s => !s.QueueExists).Select(s => s.ServiceName))}";
            }
            else if (invalidServices.Any())
            {
                check.Status = HealthLevel.Warning;
                check.Message = $"{invalidServices.Count} service(s) have configuration issues";
            }
            else
            {
                check.Status = HealthLevel.Healthy;
                check.Message = $"All {validations.Count} services have valid queues";
            }
        }
        catch (Exception ex)
        {
            stopwatch.Stop();
            check.Duration = stopwatch.Elapsed;
            check.Status = HealthLevel.Critical;
            check.Message = $"Error validating services: {ex.Message}";
        }

        return check;
    }
}
