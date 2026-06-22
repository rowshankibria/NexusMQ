using MessageBus.Api.Repositories.Interfaces;
using MessageBus.Api.Services.Interfaces;
using Microsoft.Extensions.Logging;

namespace MessageBus.Api.Services;

/// <summary>
/// Service implementation for alert management and notifications
/// </summary>
public class AlertService : IAlertService
{
    private readonly IQueueRepository _queueRepository;
    private readonly IDiagnosticsRepository _diagnosticsRepository;
    private readonly IPoisonMessageRepository _poisonMessageRepository;
    private readonly IConversationRepository _conversationRepository;
    private readonly ILogger<AlertService> _logger;

    // In-memory storage for alert rules and active alerts (would be database-backed in production)
    private static readonly List<AlertRule> _alertRules = new();
    private static readonly List<ActiveAlert> _activeAlerts = new();
    private static readonly List<AlertHistoryItem> _alertHistory = new();
    private static int _nextRuleId = 1;
    private static int _nextAlertId = 1;

    public AlertService(
        IQueueRepository queueRepository,
        IDiagnosticsRepository diagnosticsRepository,
        IPoisonMessageRepository poisonMessageRepository,
        IConversationRepository conversationRepository,
        ILogger<AlertService> logger)
    {
        _queueRepository = queueRepository;
        _diagnosticsRepository = diagnosticsRepository;
        _poisonMessageRepository = poisonMessageRepository;
        _conversationRepository = conversationRepository;
        _logger = logger;

        // Initialize with default alert rules if none exist
        if (!_alertRules.Any())
        {
            InitializeDefaultAlertRules();
        }
    }

    public Task<List<AlertRule>> GetAlertRulesAsync()
    {
        _logger.LogDebug("Getting all alert rules");
        return Task.FromResult(_alertRules.ToList());
    }

    public Task<List<ActiveAlert>> GetActiveAlertsAsync()
    {
        _logger.LogDebug("Getting active alerts");
        return Task.FromResult(_activeAlerts.ToList());
    }

    public async Task<List<AlertEvaluation>> EvaluateAlertsAsync()
    {
        _logger.LogInformation("Evaluating alert rules");

        var evaluations = new List<AlertEvaluation>();
        var enabledRules = _alertRules.Where(r => r.IsEnabled).ToList();

        foreach (var rule in enabledRules)
        {
            try
            {
                var evaluation = await EvaluateRuleAsync(rule);
                evaluations.Add(evaluation);

                // Handle triggered alerts
                if (evaluation.IsTriggered)
                {
                    await HandleTriggeredAlertAsync(rule, evaluation);
                }
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error evaluating alert rule: {RuleName}", rule.Name);
                evaluations.Add(new AlertEvaluation
                {
                    Rule = rule,
                    IsTriggered = false,
                    Message = $"Error during evaluation: {ex.Message}"
                });
            }
        }

        // Clean up resolved alerts
        await CleanupResolvedAlertsAsync(evaluations);

        _logger.LogInformation("Alert evaluation completed. {Triggered} triggered out of {Total} rules",
            evaluations.Count(e => e.IsTriggered), enabledRules.Count);

        return evaluations;
    }

    public Task<ServiceResult<AlertRule>> CreateAlertRuleAsync(CreateAlertRuleRequest request)
    {
        _logger.LogInformation("Creating alert rule: {RuleName}", request.Name);

        if (string.IsNullOrWhiteSpace(request.Name))
        {
            return Task.FromResult(ServiceResult<AlertRule>.Fail("Rule name is required"));
        }

        if (_alertRules.Any(r => r.Name.Equals(request.Name, StringComparison.OrdinalIgnoreCase)))
        {
            return Task.FromResult(ServiceResult<AlertRule>.Fail($"Alert rule '{request.Name}' already exists"));
        }

        var rule = new AlertRule
        {
            Id = _nextRuleId++,
            Name = request.Name,
            Description = request.Description,
            MetricType = request.MetricType,
            QueueFilter = request.QueueFilter,
            ServiceFilter = request.ServiceFilter,
            Condition = request.Condition,
            Threshold = request.Threshold,
            WarningThreshold = request.WarningThreshold,
            EvaluationWindowMinutes = request.EvaluationWindowMinutes,
            CooldownMinutes = request.CooldownMinutes,
            Severity = request.Severity,
            IsEnabled = true,
            NotificationChannels = request.NotificationChannels,
            CreatedAt = DateTime.UtcNow
        };

        _alertRules.Add(rule);

        _logger.LogInformation("Alert rule created: {RuleName} (ID: {RuleId})", rule.Name, rule.Id);
        return Task.FromResult(ServiceResult<AlertRule>.Ok(rule, "Alert rule created successfully"));
    }

    public Task<ServiceResult<AlertRule>> UpdateAlertRuleAsync(int ruleId, UpdateAlertRuleRequest request)
    {
        _logger.LogInformation("Updating alert rule: {RuleId}", ruleId);

        var rule = _alertRules.FirstOrDefault(r => r.Id == ruleId);
        if (rule == null)
        {
            return Task.FromResult(ServiceResult<AlertRule>.Fail($"Alert rule with ID {ruleId} not found"));
        }

        if (request.Name != null) rule.Name = request.Name;
        if (request.Description != null) rule.Description = request.Description;
        if (request.Condition.HasValue) rule.Condition = request.Condition.Value;
        if (request.Threshold.HasValue) rule.Threshold = request.Threshold.Value;
        if (request.WarningThreshold.HasValue) rule.WarningThreshold = request.WarningThreshold;
        if (request.EvaluationWindowMinutes.HasValue) rule.EvaluationWindowMinutes = request.EvaluationWindowMinutes.Value;
        if (request.CooldownMinutes.HasValue) rule.CooldownMinutes = request.CooldownMinutes.Value;
        if (request.Severity.HasValue) rule.Severity = request.Severity.Value;
        if (request.NotificationChannels != null) rule.NotificationChannels = request.NotificationChannels;

        rule.LastModifiedAt = DateTime.UtcNow;

        _logger.LogInformation("Alert rule updated: {RuleName}", rule.Name);
        return Task.FromResult(ServiceResult<AlertRule>.Ok(rule, "Alert rule updated successfully"));
    }

    public Task<ServiceResult> DeleteAlertRuleAsync(int ruleId)
    {
        _logger.LogInformation("Deleting alert rule: {RuleId}", ruleId);

        var rule = _alertRules.FirstOrDefault(r => r.Id == ruleId);
        if (rule == null)
        {
            return Task.FromResult(ServiceResult.Fail($"Alert rule with ID {ruleId} not found"));
        }

        _alertRules.Remove(rule);

        // Remove any active alerts for this rule
        _activeAlerts.RemoveAll(a => a.RuleId == ruleId);

        _logger.LogInformation("Alert rule deleted: {RuleName}", rule.Name);
        return Task.FromResult(ServiceResult.Ok("Alert rule deleted successfully"));
    }

    public Task<ServiceResult> SetAlertRuleEnabledAsync(int ruleId, bool enabled)
    {
        _logger.LogInformation("Setting alert rule {RuleId} enabled: {Enabled}", ruleId, enabled);

        var rule = _alertRules.FirstOrDefault(r => r.Id == ruleId);
        if (rule == null)
        {
            return Task.FromResult(ServiceResult.Fail($"Alert rule with ID {ruleId} not found"));
        }

        rule.IsEnabled = enabled;
        rule.LastModifiedAt = DateTime.UtcNow;

        var status = enabled ? "enabled" : "disabled";
        _logger.LogInformation("Alert rule {RuleName} {Status}", rule.Name, status);
        return Task.FromResult(ServiceResult.Ok($"Alert rule {status} successfully"));
    }

    public Task<ServiceResult> AcknowledgeAlertAsync(int alertId, string acknowledgedBy, string? notes = null)
    {
        _logger.LogInformation("Acknowledging alert {AlertId} by {AcknowledgedBy}", alertId, acknowledgedBy);

        var alert = _activeAlerts.FirstOrDefault(a => a.Id == alertId);
        if (alert == null)
        {
            return Task.FromResult(ServiceResult.Fail($"Alert with ID {alertId} not found"));
        }

        alert.IsAcknowledged = true;
        alert.AcknowledgedBy = acknowledgedBy;
        alert.AcknowledgedAt = DateTime.UtcNow;
        alert.AcknowledgeNotes = notes;

        _logger.LogInformation("Alert {AlertId} acknowledged by {AcknowledgedBy}", alertId, acknowledgedBy);
        return Task.FromResult(ServiceResult.Ok("Alert acknowledged successfully"));
    }

    public async Task<ServiceResult> TriggerNotificationAsync(ActiveAlert alert)
    {
        _logger.LogInformation("Triggering notification for alert: {RuleName}", alert.RuleName);

        var rule = _alertRules.FirstOrDefault(r => r.Id == alert.RuleId);
        if (rule == null)
        {
            return ServiceResult.Fail("Alert rule not found");
        }

        foreach (var channel in rule.NotificationChannels.Where(c => c.IsEnabled))
        {
            try
            {
                await SendNotificationAsync(channel, alert);
                _logger.LogInformation("Notification sent via {ChannelType} to {Target}",
                    channel.Type, channel.Target);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Failed to send notification via {ChannelType}", channel.Type);
            }
        }

        return ServiceResult.Ok("Notifications triggered");
    }

    public Task<List<AlertHistoryItem>> GetAlertHistoryAsync(int days = 7)
    {
        _logger.LogDebug("Getting alert history for last {Days} days", days);

        var cutoff = DateTime.UtcNow.AddDays(-days);
        var history = _alertHistory
            .Where(h => h.TriggeredAt >= cutoff)
            .OrderByDescending(h => h.TriggeredAt)
            .ToList();

        return Task.FromResult(history);
    }

    // Private helper methods

    private void InitializeDefaultAlertRules()
    {
        _logger.LogInformation("Initializing default alert rules");

        var defaultRules = new List<CreateAlertRuleRequest>
        {
            new()
            {
                Name = "High Queue Depth",
                Description = "Alert when any queue exceeds message count threshold",
                MetricType = AlertMetricType.QueueDepth,
                Condition = AlertCondition.GreaterThan,
                Threshold = 1000,
                WarningThreshold = 500,
                Severity = AlertSeverity.Critical,
                NotificationChannels = new List<NotificationChannel>
                {
                    new() { Type = NotificationChannelType.Console, Target = "stdout", IsEnabled = true }
                }
            },
            new()
            {
                Name = "Stuck Transmission Queue",
                Description = "Alert when messages are stuck in transmission queue",
                MetricType = AlertMetricType.TransmissionQueueStuckCount,
                Condition = AlertCondition.GreaterThan,
                Threshold = 50,
                WarningThreshold = 10,
                Severity = AlertSeverity.Warning
            },
            new()
            {
                Name = "Poison Message Accumulation",
                Description = "Alert when poison messages exceed threshold",
                MetricType = AlertMetricType.PoisonMessageCount,
                Condition = AlertCondition.GreaterThan,
                Threshold = 20,
                WarningThreshold = 5,
                Severity = AlertSeverity.Warning
            },
            new()
            {
                Name = "Dialog Errors",
                Description = "Alert on conversation errors",
                MetricType = AlertMetricType.DialogErrorCount,
                Condition = AlertCondition.GreaterThan,
                Threshold = 10,
                WarningThreshold = 3,
                Severity = AlertSeverity.Warning
            }
        };

        foreach (var request in defaultRules)
        {
            _ = CreateAlertRuleAsync(request).Result;
        }
    }

    private async Task<AlertEvaluation> EvaluateRuleAsync(AlertRule rule)
    {
        var evaluation = new AlertEvaluation
        {
            Rule = rule,
            EvaluatedAt = DateTime.UtcNow
        };

        // Check cooldown
        if (rule.LastTriggeredAt.HasValue)
        {
            var cooldownEnd = rule.LastTriggeredAt.Value.AddMinutes(rule.CooldownMinutes);
            if (DateTime.UtcNow < cooldownEnd)
            {
                evaluation.Message = $"In cooldown until {cooldownEnd:HH:mm:ss}";
                return evaluation;
            }
        }

        // Get the current metric value
        var metricResult = await GetMetricValueAsync(rule);
        evaluation.CurrentValue = metricResult.Value;
        evaluation.AffectedResource = metricResult.Resource;

        // Evaluate condition
        evaluation.IsTriggered = EvaluateCondition(evaluation.CurrentValue, rule.Condition, rule.Threshold);

        if (rule.WarningThreshold.HasValue && !evaluation.IsTriggered)
        {
            evaluation.IsWarning = EvaluateCondition(evaluation.CurrentValue, rule.Condition, rule.WarningThreshold.Value);
        }

        if (evaluation.IsTriggered)
        {
            evaluation.Message = $"{rule.MetricType} value ({evaluation.CurrentValue}) {rule.Condition} threshold ({rule.Threshold})";
        }
        else if (evaluation.IsWarning)
        {
            evaluation.Message = $"{rule.MetricType} value ({evaluation.CurrentValue}) {rule.Condition} warning threshold ({rule.WarningThreshold})";
        }
        else
        {
            evaluation.Message = $"{rule.MetricType} value ({evaluation.CurrentValue}) is within acceptable range";
        }

        return evaluation;
    }

    private async Task<(decimal Value, string? Resource)> GetMetricValueAsync(AlertRule rule)
    {
        switch (rule.MetricType)
        {
            case AlertMetricType.QueueDepth:
                var queues = await _queueRepository.GetAllQueuesAsync();
                var filteredQueues = string.IsNullOrEmpty(rule.QueueFilter)
                    ? queues
                    : queues.Where(q => q.QueueName.Contains(rule.QueueFilter, StringComparison.OrdinalIgnoreCase)).ToList();
                var maxQueue = filteredQueues.OrderByDescending(q => q.MessageCount).FirstOrDefault();
                return (maxQueue?.MessageCount ?? 0, maxQueue?.QueueName);

            case AlertMetricType.QueueOldestMessageAge:
                var queueStats = await _queueRepository.GetAllQueuesAsync();
                var oldestQueue = queueStats
                    .Where(q => q.OldestMessageAgeSeconds.HasValue)
                    .OrderByDescending(q => q.OldestMessageAgeSeconds)
                    .FirstOrDefault();
                return (oldestQueue?.OldestMessageAgeSeconds ?? 0, oldestQueue?.QueueName);

            case AlertMetricType.TransmissionQueueDepth:
                var txSummary = await _diagnosticsRepository.GetTransmissionQueueSummaryAsync();
                return (txSummary?.TotalMessages ?? 0, null);

            case AlertMetricType.TransmissionQueueStuckCount:
                var txStuck = await _diagnosticsRepository.GetTransmissionQueueSummaryAsync();
                return (txStuck?.StuckOver5Min ?? 0, null);

            case AlertMetricType.PoisonMessageCount:
                var poisonMessages = await _poisonMessageRepository.GetPoisonMessagesAsync();
                return (poisonMessages.Count, null);

            case AlertMetricType.DeadLetterCount:
                var deadLetters = await _poisonMessageRepository.GetDeadLetteredMessagesAsync(includeResolved: false);
                return (deadLetters.Count, null);

            case AlertMetricType.ConversationErrorCount:
                var conversations = await _conversationRepository.GetConversationsAsync();
                var errorCount = conversations.Count(c => c.State == "ER");
                return (errorCount, null);

            case AlertMetricType.DialogErrorCount:
                var dialogErrors = await _diagnosticsRepository.GetDialogErrorsAsync();
                return (dialogErrors.Count, null);

            default:
                return (0, null);
        }
    }

    private static bool EvaluateCondition(decimal value, AlertCondition condition, decimal threshold)
    {
        return condition switch
        {
            AlertCondition.GreaterThan => value > threshold,
            AlertCondition.GreaterThanOrEqual => value >= threshold,
            AlertCondition.LessThan => value < threshold,
            AlertCondition.LessThanOrEqual => value <= threshold,
            AlertCondition.Equals => value == threshold,
            AlertCondition.NotEquals => value != threshold,
            _ => false
        };
    }

    private async Task HandleTriggeredAlertAsync(AlertRule rule, AlertEvaluation evaluation)
    {
        // Check if alert already exists
        var existingAlert = _activeAlerts.FirstOrDefault(a => a.RuleId == rule.Id);
        if (existingAlert != null)
        {
            // Update existing alert
            existingAlert.CurrentValue = evaluation.CurrentValue;
            return;
        }

        // Create new alert
        var alert = new ActiveAlert
        {
            Id = _nextAlertId++,
            RuleId = rule.Id,
            RuleName = rule.Name,
            Severity = rule.Severity,
            Message = evaluation.Message,
            CurrentValue = evaluation.CurrentValue,
            Threshold = rule.Threshold,
            AffectedQueue = evaluation.AffectedResource,
            TriggeredAt = DateTime.UtcNow
        };

        _activeAlerts.Add(alert);
        rule.LastTriggeredAt = DateTime.UtcNow;

        // Add to history
        _alertHistory.Add(new AlertHistoryItem
        {
            Id = alert.Id,
            RuleId = rule.Id,
            RuleName = rule.Name,
            Severity = rule.Severity,
            Message = evaluation.Message,
            Value = evaluation.CurrentValue,
            Threshold = rule.Threshold,
            TriggeredAt = DateTime.UtcNow
        });

        _logger.LogWarning("Alert triggered: {RuleName} - {Message}", rule.Name, evaluation.Message);

        // Trigger notifications
        await TriggerNotificationAsync(alert);
    }

    private Task CleanupResolvedAlertsAsync(List<AlertEvaluation> evaluations)
    {
        var triggeredRuleIds = evaluations.Where(e => e.IsTriggered).Select(e => e.Rule.Id).ToHashSet();

        var resolvedAlerts = _activeAlerts.Where(a => !triggeredRuleIds.Contains(a.RuleId)).ToList();

        foreach (var alert in resolvedAlerts)
        {
            // Update history with resolution time
            var historyItem = _alertHistory.FirstOrDefault(h => h.Id == alert.Id && !h.ResolvedAt.HasValue);
            if (historyItem != null)
            {
                historyItem.ResolvedAt = DateTime.UtcNow;
                historyItem.Duration = historyItem.ResolvedAt - historyItem.TriggeredAt;
                historyItem.WasAcknowledged = alert.IsAcknowledged;
                historyItem.AcknowledgedBy = alert.AcknowledgedBy;
            }

            _activeAlerts.Remove(alert);
            _logger.LogInformation("Alert resolved: {RuleName}", alert.RuleName);
        }

        return Task.CompletedTask;
    }

    private Task SendNotificationAsync(NotificationChannel channel, ActiveAlert alert)
    {
        // Placeholder notification implementations
        switch (channel.Type)
        {
            case NotificationChannelType.Console:
                _logger.LogWarning("[ALERT] {Severity}: {RuleName} - {Message}",
                    alert.Severity, alert.RuleName, alert.Message);
                break;

            case NotificationChannelType.Email:
                // TODO: Implement email notification
                _logger.LogInformation("Would send email to {Target}: {Message}",
                    channel.Target, alert.Message);
                break;

            case NotificationChannelType.Webhook:
                // TODO: Implement webhook notification
                _logger.LogInformation("Would POST to webhook {Target}: {Message}",
                    channel.Target, alert.Message);
                break;

            case NotificationChannelType.Slack:
                // TODO: Implement Slack notification
                _logger.LogInformation("Would send Slack message to {Target}: {Message}",
                    channel.Target, alert.Message);
                break;

            case NotificationChannelType.Teams:
                // TODO: Implement Teams notification
                _logger.LogInformation("Would send Teams message to {Target}: {Message}",
                    channel.Target, alert.Message);
                break;
        }

        return Task.CompletedTask;
    }
}
