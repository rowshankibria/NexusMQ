using MessageBus.Api.Models;
using MessageBus.Api.Repositories.Interfaces;
using MessageBus.Api.Services.Interfaces;
using Microsoft.Extensions.Logging;

namespace MessageBus.Api.Services;

/// <summary>
/// Service implementation for queue-related business operations
/// </summary>
public class QueueService : IQueueService
{
    private readonly IQueueRepository _queueRepository;
    private readonly ILogger<QueueService> _logger;

    // Health thresholds (could be moved to configuration)
    private const int WarningMessageCountThreshold = 100;
    private const int CriticalMessageCountThreshold = 1000;
    private const int WarningMessageAgeSeconds = 300; // 5 minutes
    private const int CriticalMessageAgeSeconds = 1800; // 30 minutes
    private const int WarningErrorConversationThreshold = 5;
    private const int CriticalErrorConversationThreshold = 20;

    public QueueService(IQueueRepository queueRepository, ILogger<QueueService> logger)
    {
        _queueRepository = queueRepository;
        _logger = logger;
    }

    public async Task<List<QueueInfo>> GetAllQueuesAsync(bool includeSystemQueues = false, bool includeEmptyQueues = true)
    {
        _logger.LogDebug("Getting all queues. IncludeSystemQueues: {IncludeSystem}, IncludeEmpty: {IncludeEmpty}",
            includeSystemQueues, includeEmptyQueues);

        return await _queueRepository.GetAllQueuesAsync(includeSystemQueues, includeEmptyQueues);
    }

    public async Task<QueueStatistics?> GetQueueStatisticsAsync(string queueName)
    {
        if (string.IsNullOrWhiteSpace(queueName))
        {
            _logger.LogWarning("GetQueueStatistics called with empty queue name");
            return null;
        }

        _logger.LogDebug("Getting statistics for queue: {QueueName}", queueName);
        return await _queueRepository.GetQueueStatisticsAsync(queueName);
    }

    public async Task<QueueHealthStatus> GetQueueHealthStatusAsync(string queueName)
    {
        _logger.LogDebug("Calculating health status for queue: {QueueName}", queueName);

        var stats = await _queueRepository.GetQueueStatisticsAsync(queueName);

        if (stats == null)
        {
            return new QueueHealthStatus
            {
                QueueName = queueName,
                Status = HealthLevel.Unknown,
                StatusDescription = "Queue not found or unable to retrieve statistics",
                Issues = new List<string> { "Queue statistics unavailable" }
            };
        }

        var issues = new List<string>();
        var status = HealthLevel.Healthy;

        // Check if receive is disabled
        if (!stats.IsReceiveEnabled)
        {
            issues.Add("Queue receive is disabled (paused)");
            status = HealthLevel.Warning;
        }

        // Check if activation is disabled
        if (!stats.IsActivationEnabled)
        {
            issues.Add("Queue activation is disabled");
            if (status == HealthLevel.Healthy) status = HealthLevel.Warning;
        }

        // Check message count
        if (stats.TotalMessages >= CriticalMessageCountThreshold)
        {
            issues.Add($"Message count ({stats.TotalMessages}) exceeds critical threshold ({CriticalMessageCountThreshold})");
            status = HealthLevel.Critical;
        }
        else if (stats.TotalMessages >= WarningMessageCountThreshold)
        {
            issues.Add($"Message count ({stats.TotalMessages}) exceeds warning threshold ({WarningMessageCountThreshold})");
            if (status == HealthLevel.Healthy) status = HealthLevel.Warning;
        }

        // Check oldest message age
        if (stats.OldestMessageAgeSeconds.HasValue)
        {
            if (stats.OldestMessageAgeSeconds >= CriticalMessageAgeSeconds)
            {
                issues.Add($"Oldest message age ({stats.OldestMessageAgeSeconds}s) exceeds critical threshold ({CriticalMessageAgeSeconds}s)");
                status = HealthLevel.Critical;
            }
            else if (stats.OldestMessageAgeSeconds >= WarningMessageAgeSeconds)
            {
                issues.Add($"Oldest message age ({stats.OldestMessageAgeSeconds}s) exceeds warning threshold ({WarningMessageAgeSeconds}s)");
                if (status == HealthLevel.Healthy) status = HealthLevel.Warning;
            }
        }

        // Check error conversations
        if (stats.ErrorConversations >= CriticalErrorConversationThreshold)
        {
            issues.Add($"Error conversations ({stats.ErrorConversations}) exceed critical threshold ({CriticalErrorConversationThreshold})");
            status = HealthLevel.Critical;
        }
        else if (stats.ErrorConversations >= WarningErrorConversationThreshold)
        {
            issues.Add($"Error conversations ({stats.ErrorConversations}) exceed warning threshold ({WarningErrorConversationThreshold})");
            if (status == HealthLevel.Healthy) status = HealthLevel.Warning;
        }

        var statusDescription = status switch
        {
            HealthLevel.Healthy => "Queue is operating normally",
            HealthLevel.Warning => "Queue has minor issues that should be investigated",
            HealthLevel.Critical => "Queue requires immediate attention",
            _ => "Queue status is unknown"
        };

        return new QueueHealthStatus
        {
            QueueName = queueName,
            Status = status,
            StatusDescription = statusDescription,
            MessageCount = stats.TotalMessages,
            OldestMessageAgeSeconds = stats.OldestMessageAgeSeconds,
            IsReceiveEnabled = stats.IsReceiveEnabled,
            IsActivationEnabled = stats.IsActivationEnabled,
            ErrorConversations = stats.ErrorConversations,
            Issues = issues,
            CheckedAt = DateTime.UtcNow
        };
    }

    public async Task<ServiceResult> PauseQueueAsync(string queueName)
    {
        if (string.IsNullOrWhiteSpace(queueName))
        {
            return ServiceResult.Fail("Queue name is required");
        }

        _logger.LogInformation("Attempting to pause queue: {QueueName}", queueName);

        try
        {
            // Validate queue exists
            var stats = await _queueRepository.GetQueueStatisticsAsync(queueName);
            if (stats == null)
            {
                _logger.LogWarning("Pause failed - queue not found: {QueueName}", queueName);
                return ServiceResult.Fail($"Queue '{queueName}' not found");
            }

            // Check if already paused
            if (!stats.IsReceiveEnabled)
            {
                _logger.LogInformation("Queue already paused: {QueueName}", queueName);
                return ServiceResult.Ok($"Queue '{queueName}' is already paused");
            }

            await _queueRepository.PauseQueueAsync(queueName);

            _logger.LogInformation("Successfully paused queue: {QueueName}", queueName);
            return ServiceResult.Ok($"Queue '{queueName}' has been paused");
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error pausing queue: {QueueName}", queueName);
            return ServiceResult.Fail($"Failed to pause queue: {ex.Message}");
        }
    }

    public async Task<ServiceResult> ResumeQueueAsync(string queueName)
    {
        if (string.IsNullOrWhiteSpace(queueName))
        {
            return ServiceResult.Fail("Queue name is required");
        }

        _logger.LogInformation("Attempting to resume queue: {QueueName}", queueName);

        try
        {
            // Validate queue exists
            var stats = await _queueRepository.GetQueueStatisticsAsync(queueName);
            if (stats == null)
            {
                _logger.LogWarning("Resume failed - queue not found: {QueueName}", queueName);
                return ServiceResult.Fail($"Queue '{queueName}' not found");
            }

            // Check if already active
            if (stats.IsReceiveEnabled)
            {
                _logger.LogInformation("Queue already active: {QueueName}", queueName);
                return ServiceResult.Ok($"Queue '{queueName}' is already active");
            }

            await _queueRepository.ResumeQueueAsync(queueName);

            _logger.LogInformation("Successfully resumed queue: {QueueName}", queueName);
            return ServiceResult.Ok($"Queue '{queueName}' has been resumed");
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error resuming queue: {QueueName}", queueName);
            return ServiceResult.Fail($"Failed to resume queue: {ex.Message}");
        }
    }

    public async Task<ServiceResult> PurgeQueueAsync(string queueName, bool requireConfirmation = true)
    {
        if (string.IsNullOrWhiteSpace(queueName))
        {
            return ServiceResult.Fail("Queue name is required");
        }

        _logger.LogWarning("Attempting to purge queue: {QueueName}", queueName);

        try
        {
            // Validate queue exists
            var stats = await _queueRepository.GetQueueStatisticsAsync(queueName);
            if (stats == null)
            {
                _logger.LogWarning("Purge failed - queue not found: {QueueName}", queueName);
                return ServiceResult.Fail($"Queue '{queueName}' not found");
            }

            // Log warning if there are messages
            if (stats.TotalMessages > 0)
            {
                _logger.LogWarning("Purging {MessageCount} messages from queue: {QueueName}",
                    stats.TotalMessages, queueName);
            }

            await _queueRepository.PurgeQueueAsync(queueName);

            _logger.LogInformation("Successfully purged queue: {QueueName}. Messages removed: {MessageCount}",
                queueName, stats.TotalMessages);

            return ServiceResult.Ok($"Queue '{queueName}' has been purged. {stats.TotalMessages} messages removed.");
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error purging queue: {QueueName}", queueName);
            return ServiceResult.Fail($"Failed to purge queue: {ex.Message}");
        }
    }
}
