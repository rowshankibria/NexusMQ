namespace MessageBus.Api.Services.Interfaces;

/// <summary>
/// Service interface for alert management and notifications
/// </summary>
public interface IAlertService
{
    /// <summary>
    /// Gets all configured alert rules
    /// </summary>
    Task<List<AlertRule>> GetAlertRulesAsync();

    /// <summary>
    /// Gets active alerts
    /// </summary>
    Task<List<ActiveAlert>> GetActiveAlertsAsync();

    /// <summary>
    /// Evaluates all alert rules against current metrics
    /// </summary>
    Task<List<AlertEvaluation>> EvaluateAlertsAsync();

    /// <summary>
    /// Creates a new alert rule
    /// </summary>
    Task<ServiceResult<AlertRule>> CreateAlertRuleAsync(CreateAlertRuleRequest request);

    /// <summary>
    /// Updates an existing alert rule
    /// </summary>
    Task<ServiceResult<AlertRule>> UpdateAlertRuleAsync(int ruleId, UpdateAlertRuleRequest request);

    /// <summary>
    /// Deletes an alert rule
    /// </summary>
    Task<ServiceResult> DeleteAlertRuleAsync(int ruleId);

    /// <summary>
    /// Enables or disables an alert rule
    /// </summary>
    Task<ServiceResult> SetAlertRuleEnabledAsync(int ruleId, bool enabled);

    /// <summary>
    /// Acknowledges an active alert
    /// </summary>
    Task<ServiceResult> AcknowledgeAlertAsync(int alertId, string acknowledgedBy, string? notes = null);

    /// <summary>
    /// Triggers a notification (placeholder for email/webhook/Slack)
    /// </summary>
    Task<ServiceResult> TriggerNotificationAsync(ActiveAlert alert);

    /// <summary>
    /// Gets alert history
    /// </summary>
    Task<List<AlertHistoryItem>> GetAlertHistoryAsync(int days = 7);
}

/// <summary>
/// Represents an alert rule configuration
/// </summary>
public class AlertRule
{
    public int Id { get; set; }
    public string Name { get; set; } = string.Empty;
    public string Description { get; set; } = string.Empty;
    public AlertMetricType MetricType { get; set; }
    public string? QueueFilter { get; set; }
    public string? ServiceFilter { get; set; }
    public AlertCondition Condition { get; set; }
    public decimal Threshold { get; set; }
    public decimal? WarningThreshold { get; set; }
    public int EvaluationWindowMinutes { get; set; } = 5;
    public int CooldownMinutes { get; set; } = 15;
    public AlertSeverity Severity { get; set; }
    public bool IsEnabled { get; set; } = true;
    public List<NotificationChannel> NotificationChannels { get; set; } = new();
    public DateTime CreatedAt { get; set; }
    public DateTime? LastModifiedAt { get; set; }
    public DateTime? LastTriggeredAt { get; set; }
}

/// <summary>
/// Types of metrics that can be monitored
/// </summary>
public enum AlertMetricType
{
    QueueDepth,
    QueueOldestMessageAge,
    TransmissionQueueDepth,
    TransmissionQueueStuckCount,
    PoisonMessageCount,
    DeadLetterCount,
    ConversationErrorCount,
    OrphanedConversationCount,
    MessagesPerSecond,
    ProcessingLatency,
    DialogErrorCount
}

/// <summary>
/// Alert condition types
/// </summary>
public enum AlertCondition
{
    GreaterThan,
    GreaterThanOrEqual,
    LessThan,
    LessThanOrEqual,
    Equals,
    NotEquals
}

/// <summary>
/// Alert severity levels
/// </summary>
public enum AlertSeverity
{
    Info,
    Warning,
    Critical
}

/// <summary>
/// Notification channel types
/// </summary>
public enum NotificationChannelType
{
    Email,
    Webhook,
    Slack,
    Teams,
    Console
}

/// <summary>
/// Notification channel configuration
/// </summary>
public class NotificationChannel
{
    public NotificationChannelType Type { get; set; }
    public string Target { get; set; } = string.Empty;
    public Dictionary<string, string> Settings { get; set; } = new();
    public bool IsEnabled { get; set; } = true;
}

/// <summary>
/// Represents an active (triggered) alert
/// </summary>
public class ActiveAlert
{
    public int Id { get; set; }
    public int RuleId { get; set; }
    public string RuleName { get; set; } = string.Empty;
    public AlertSeverity Severity { get; set; }
    public string Message { get; set; } = string.Empty;
    public decimal CurrentValue { get; set; }
    public decimal Threshold { get; set; }
    public string? AffectedQueue { get; set; }
    public string? AffectedService { get; set; }
    public DateTime TriggeredAt { get; set; }
    public bool IsAcknowledged { get; set; }
    public string? AcknowledgedBy { get; set; }
    public DateTime? AcknowledgedAt { get; set; }
    public string? AcknowledgeNotes { get; set; }
}

/// <summary>
/// Result of alert rule evaluation
/// </summary>
public class AlertEvaluation
{
    public AlertRule Rule { get; set; } = new();
    public bool IsTriggered { get; set; }
    public bool IsWarning { get; set; }
    public decimal CurrentValue { get; set; }
    public string? AffectedResource { get; set; }
    public string Message { get; set; } = string.Empty;
    public DateTime EvaluatedAt { get; set; } = DateTime.UtcNow;
}

/// <summary>
/// Request to create a new alert rule
/// </summary>
public class CreateAlertRuleRequest
{
    public string Name { get; set; } = string.Empty;
    public string Description { get; set; } = string.Empty;
    public AlertMetricType MetricType { get; set; }
    public string? QueueFilter { get; set; }
    public string? ServiceFilter { get; set; }
    public AlertCondition Condition { get; set; }
    public decimal Threshold { get; set; }
    public decimal? WarningThreshold { get; set; }
    public int EvaluationWindowMinutes { get; set; } = 5;
    public int CooldownMinutes { get; set; } = 15;
    public AlertSeverity Severity { get; set; }
    public List<NotificationChannel> NotificationChannels { get; set; } = new();
}

/// <summary>
/// Request to update an alert rule
/// </summary>
public class UpdateAlertRuleRequest
{
    public string? Name { get; set; }
    public string? Description { get; set; }
    public AlertCondition? Condition { get; set; }
    public decimal? Threshold { get; set; }
    public decimal? WarningThreshold { get; set; }
    public int? EvaluationWindowMinutes { get; set; }
    public int? CooldownMinutes { get; set; }
    public AlertSeverity? Severity { get; set; }
    public List<NotificationChannel>? NotificationChannels { get; set; }
}

/// <summary>
/// Alert history item
/// </summary>
public class AlertHistoryItem
{
    public int Id { get; set; }
    public int RuleId { get; set; }
    public string RuleName { get; set; } = string.Empty;
    public AlertSeverity Severity { get; set; }
    public string Message { get; set; } = string.Empty;
    public decimal Value { get; set; }
    public decimal Threshold { get; set; }
    public DateTime TriggeredAt { get; set; }
    public DateTime? ResolvedAt { get; set; }
    public TimeSpan? Duration { get; set; }
    public bool WasAcknowledged { get; set; }
    public string? AcknowledgedBy { get; set; }
}
