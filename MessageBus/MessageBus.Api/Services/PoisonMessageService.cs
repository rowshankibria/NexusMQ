using System.Diagnostics;
using MessageBus.Api.Models;
using MessageBus.Api.Repositories.Interfaces;
using MessageBus.Api.Services.Interfaces;
using Microsoft.Extensions.Logging;

namespace MessageBus.Api.Services;

/// <summary>
/// Service implementation for poison message and dead letter queue operations
/// </summary>
public class PoisonMessageService : IPoisonMessageService
{
    private readonly IPoisonMessageRepository _poisonMessageRepository;
    private readonly IQueueRepository _queueRepository;
    private readonly ILogger<PoisonMessageService> _logger;

    public PoisonMessageService(
        IPoisonMessageRepository poisonMessageRepository,
        IQueueRepository queueRepository,
        ILogger<PoisonMessageService> logger)
    {
        _poisonMessageRepository = poisonMessageRepository;
        _queueRepository = queueRepository;
        _logger = logger;
    }

    public async Task<List<PoisonMessageInfo>> GetPoisonMessagesAsync()
    {
        _logger.LogDebug("Getting all poison messages");
        return await _poisonMessageRepository.GetPoisonMessagesAsync();
    }

    public async Task<List<DeadLetterMessage>> GetDeadLetteredMessagesAsync(bool includeResolved = false)
    {
        _logger.LogDebug("Getting dead lettered messages. IncludeResolved: {IncludeResolved}", includeResolved);
        return await _poisonMessageRepository.GetDeadLetteredMessagesAsync(includeResolved);
    }

    public async Task<ServiceResult> RetryPoisonMessageAsync(long id)
    {
        _logger.LogInformation("Attempting to retry poison message: {Id}", id);

        try
        {
            // Get poison messages to find the one with this ID
            var poisonMessages = await _poisonMessageRepository.GetPoisonMessagesAsync();
            var poisonMessage = poisonMessages.FirstOrDefault(pm => pm.Id == id);

            if (poisonMessage == null)
            {
                _logger.LogWarning("Poison message not found: {Id}", id);
                return ServiceResult.Fail($"Poison message with ID {id} not found");
            }

            // Check retry count
            if (poisonMessage.RetryCount >= poisonMessage.MaxRetries)
            {
                _logger.LogWarning("Poison message {Id} has exceeded max retries ({MaxRetries})",
                    id, poisonMessage.MaxRetries);
                return ServiceResult.Fail($"Message has exceeded maximum retry count ({poisonMessage.MaxRetries})");
            }

            // Re-enable the queue if it's paused
            var queueStats = await _queueRepository.GetQueueStatisticsAsync(poisonMessage.SourceQueueName);
            if (queueStats != null && !queueStats.IsReceiveEnabled)
            {
                _logger.LogInformation("Re-enabling queue {QueueName} for retry", poisonMessage.SourceQueueName);
                await _queueRepository.ResumeQueueAsync(poisonMessage.SourceQueueName);
            }

            // Retry the message
            await _poisonMessageRepository.RetryPoisonMessageAsync(id);

            _logger.LogInformation("Successfully retried poison message: {Id}", id);
            return ServiceResult.Ok($"Poison message {id} has been queued for retry");
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error retrying poison message: {Id}", id);
            return ServiceResult.Fail($"Failed to retry poison message: {ex.Message}");
        }
    }

    public async Task<ServiceResult<BulkOperationResult>> BulkRetryPoisonMessagesAsync(IEnumerable<long> ids)
    {
        var idList = ids.ToList();
        if (!idList.Any())
        {
            return ServiceResult<BulkOperationResult>.Fail("No message IDs provided");
        }

        _logger.LogInformation("Starting bulk retry for {Count} poison messages", idList.Count);

        var stopwatch = Stopwatch.StartNew();
        var result = new BulkOperationResult
        {
            Requested = idList.Count
        };

        foreach (var id in idList)
        {
            try
            {
                await _poisonMessageRepository.RetryPoisonMessageAsync(id);
                result.Results.Add(new BulkOperationItemResult { Id = id, Success = true });
                result.Succeeded++;
            }
            catch (Exception ex)
            {
                result.Results.Add(new BulkOperationItemResult { Id = id, Success = false, Error = ex.Message });
                result.Failed++;
                _logger.LogWarning(ex, "Failed to retry poison message {Id}", id);
            }
        }

        stopwatch.Stop();
        result.Duration = stopwatch.Elapsed;

        _logger.LogInformation("Bulk retry completed. Succeeded: {Succeeded}, Failed: {Failed}, Duration: {Duration}ms",
            result.Succeeded, result.Failed, stopwatch.ElapsedMilliseconds);

        var message = result.Failed == 0
            ? $"Successfully retried {result.Succeeded} messages"
            : $"Completed with {result.Succeeded} successes and {result.Failed} failures";

        return ServiceResult<BulkOperationResult>.Ok(result, message);
    }

    public async Task<ServiceResult> MoveToDeadLetterAsync(Guid conversationHandle, string queueName, string reason)
    {
        if (conversationHandle == Guid.Empty)
        {
            return ServiceResult.Fail("Conversation handle is required");
        }

        if (string.IsNullOrWhiteSpace(queueName))
        {
            return ServiceResult.Fail("Queue name is required");
        }

        if (string.IsNullOrWhiteSpace(reason))
        {
            return ServiceResult.Fail("Reason is required for moving to dead letter");
        }

        _logger.LogInformation("Moving conversation {ConversationHandle} from {QueueName} to dead letter. Reason: {Reason}",
            conversationHandle, queueName, reason);

        try
        {
            await _poisonMessageRepository.MoveToDeadLetterAsync(conversationHandle, queueName, reason);

            _logger.LogInformation("Successfully moved conversation {ConversationHandle} to dead letter",
                conversationHandle);
            return ServiceResult.Ok("Message moved to dead letter queue");
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error moving conversation {ConversationHandle} to dead letter",
                conversationHandle);
            return ServiceResult.Fail($"Failed to move to dead letter: {ex.Message}");
        }
    }

    public async Task<ServiceResult> PurgePoisonMessageAsync(long id, string reason)
    {
        if (string.IsNullOrWhiteSpace(reason))
        {
            return ServiceResult.Fail("Reason is required for purging a poison message");
        }

        _logger.LogInformation("Purging poison message {Id} to dead letter. Reason: {Reason}", id, reason);

        try
        {
            var poisonMessages = await _poisonMessageRepository.GetPoisonMessagesAsync();
            var poisonMessage = poisonMessages.FirstOrDefault(pm => pm.Id == id);

            if (poisonMessage == null)
            {
                _logger.LogWarning("Poison message not found for purge: {Id}", id);
                return ServiceResult.Fail($"Poison message with ID {id} not found");
            }

            await _poisonMessageRepository.MoveToDeadLetterAsync(
                poisonMessage.ConversationHandle,
                poisonMessage.SourceQueueName,
                reason);

            _logger.LogInformation("Successfully purged poison message {Id} to dead letter", id);
            return ServiceResult.Ok($"Poison message {id} has been moved to dead letter");
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error purging poison message: {Id}", id);
            return ServiceResult.Fail($"Failed to purge poison message: {ex.Message}");
        }
    }

    public async Task<ServiceResult<BulkOperationResult>> BulkPurgePoisonMessagesAsync(IEnumerable<long> ids, string reason)
    {
        var idList = ids.ToList();
        if (!idList.Any())
        {
            return ServiceResult<BulkOperationResult>.Fail("No message IDs provided");
        }

        if (string.IsNullOrWhiteSpace(reason))
        {
            return ServiceResult<BulkOperationResult>.Fail("Reason is required for bulk purge");
        }

        _logger.LogInformation("Starting bulk purge for {Count} poison messages. Reason: {Reason}",
            idList.Count, reason);

        var stopwatch = Stopwatch.StartNew();
        var result = new BulkOperationResult
        {
            Requested = idList.Count
        };

        var poisonMessages = await _poisonMessageRepository.GetPoisonMessagesAsync();

        foreach (var id in idList)
        {
            try
            {
                var poisonMessage = poisonMessages.FirstOrDefault(pm => pm.Id == id);
                if (poisonMessage == null)
                {
                    result.Results.Add(new BulkOperationItemResult
                    {
                        Id = id,
                        Success = false,
                        Error = "Poison message not found"
                    });
                    result.Failed++;
                    continue;
                }

                await _poisonMessageRepository.MoveToDeadLetterAsync(
                    poisonMessage.ConversationHandle,
                    poisonMessage.SourceQueueName,
                    reason);

                result.Results.Add(new BulkOperationItemResult { Id = id, Success = true });
                result.Succeeded++;
            }
            catch (Exception ex)
            {
                result.Results.Add(new BulkOperationItemResult { Id = id, Success = false, Error = ex.Message });
                result.Failed++;
                _logger.LogWarning(ex, "Failed to purge poison message {Id}", id);
            }
        }

        stopwatch.Stop();
        result.Duration = stopwatch.Elapsed;

        _logger.LogInformation("Bulk purge completed. Succeeded: {Succeeded}, Failed: {Failed}, Duration: {Duration}ms",
            result.Succeeded, result.Failed, stopwatch.ElapsedMilliseconds);

        var message = result.Failed == 0
            ? $"Successfully purged {result.Succeeded} messages"
            : $"Completed with {result.Succeeded} successes and {result.Failed} failures";

        return ServiceResult<BulkOperationResult>.Ok(result, message);
    }

    public async Task<ServiceResult> ResolveDeadLetterMessageAsync(long id, string resolutionNotes, string resolvedBy)
    {
        if (string.IsNullOrWhiteSpace(resolutionNotes))
        {
            return ServiceResult.Fail("Resolution notes are required");
        }

        if (string.IsNullOrWhiteSpace(resolvedBy))
        {
            return ServiceResult.Fail("Resolved by is required");
        }

        _logger.LogInformation("Resolving dead letter message {Id} by {ResolvedBy}", id, resolvedBy);

        try
        {
            await _poisonMessageRepository.ResolveDeadLetterMessageAsync(id, resolutionNotes, resolvedBy);

            _logger.LogInformation("Successfully resolved dead letter message {Id}", id);
            return ServiceResult.Ok($"Dead letter message {id} has been resolved");
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error resolving dead letter message: {Id}", id);
            return ServiceResult.Fail($"Failed to resolve dead letter message: {ex.Message}");
        }
    }

    public async Task<PoisonMessageStats> GetPoisonMessageStatsAsync()
    {
        _logger.LogDebug("Getting poison message statistics");

        var poisonMessages = await _poisonMessageRepository.GetPoisonMessagesAsync();
        var deadLetterMessages = await _poisonMessageRepository.GetDeadLetteredMessagesAsync(includeResolved: true);

        var stats = new PoisonMessageStats
        {
            TotalPoisonMessages = poisonMessages.Count,
            TotalDeadLettered = deadLetterMessages.Count,
            UnresolvedDeadLettered = deadLetterMessages.Count(d => d.ResolvedAt == null),
            ResolvedDeadLettered = deadLetterMessages.Count(d => d.ResolvedAt != null),
            ByQueue = poisonMessages
                .GroupBy(p => p.SourceQueueName)
                .ToDictionary(g => g.Key, g => g.Count()),
            ByErrorType = poisonMessages
                .Where(p => !string.IsNullOrEmpty(p.ErrorMessage))
                .GroupBy(p => ExtractErrorType(p.ErrorMessage!))
                .ToDictionary(g => g.Key, g => g.Count()),
            OldestPoisonMessage = poisonMessages
                .OrderBy(p => p.MovedToDeadLetterAt)
                .FirstOrDefault()?.MovedToDeadLetterAt
        };

        return stats;
    }

    private static string ExtractErrorType(string errorMessage)
    {
        // Extract a simplified error type from the error message
        if (errorMessage.Contains("timeout", StringComparison.OrdinalIgnoreCase))
            return "Timeout";
        if (errorMessage.Contains("connection", StringComparison.OrdinalIgnoreCase))
            return "Connection Error";
        if (errorMessage.Contains("validation", StringComparison.OrdinalIgnoreCase))
            return "Validation Error";
        if (errorMessage.Contains("permission", StringComparison.OrdinalIgnoreCase) ||
            errorMessage.Contains("access denied", StringComparison.OrdinalIgnoreCase))
            return "Permission Error";
        if (errorMessage.Contains("not found", StringComparison.OrdinalIgnoreCase))
            return "Not Found";

        return "Other";
    }
}
