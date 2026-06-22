using System.Text;
using System.Text.Json;
using MessageBus.Api.Models;
using MessageBus.Api.Repositories.Interfaces;
using MessageBus.Api.Services.Interfaces;
using Microsoft.Extensions.Logging;

namespace MessageBus.Api.Services;

/// <summary>
/// Service implementation for conversation-related business operations
/// </summary>
public class ConversationService : IConversationService
{
    private readonly IConversationRepository _conversationRepository;
    private readonly ILogger<ConversationService> _logger;

    public ConversationService(
        IConversationRepository conversationRepository,
        ILogger<ConversationService> logger)
    {
        _conversationRepository = conversationRepository;
        _logger = logger;
    }

    public async Task<List<ConversationInfo>> GetConversationsAsync(string? stateFilter = null, string? serviceFilter = null)
    {
        _logger.LogDebug("Getting conversations. StateFilter: {StateFilter}, ServiceFilter: {ServiceFilter}",
            stateFilter, serviceFilter);

        return await _conversationRepository.GetConversationsAsync(stateFilter, serviceFilter);
    }

    public async Task<ServiceResult<ConversationDetail>> GetConversationDetailAsync(Guid conversationHandle, bool includeDeadLetterHistory = true, bool includeTransmissionQueue = true)
    {
        if (conversationHandle == Guid.Empty)
        {
            return ServiceResult<ConversationDetail>.Fail("Conversation handle is required");
        }

        _logger.LogDebug("Getting conversation detail: {ConversationHandle}", conversationHandle);

        try
        {
            var conversations = await _conversationRepository.GetConversationsAsync();
            var conversation = conversations.FirstOrDefault(c => c.ConversationHandle == conversationHandle);

            if (conversation == null)
            {
                _logger.LogWarning("Conversation not found: {ConversationHandle}", conversationHandle);
                return ServiceResult<ConversationDetail>.Fail($"Conversation {conversationHandle} not found");
            }

            var trace = await _conversationRepository.GetConversationTraceAsync(
                conversationHandle, includeDeadLetterHistory, includeTransmissionQueue);

            var timeline = BuildTimelineFromTrace(conversationHandle, trace);

            var detail = new ConversationDetail
            {
                Conversation = conversation,
                Trace = trace,
                Timeline = timeline,
                MessageCount = trace.Count(t => t.Operation.Contains("SEND") || t.Operation.Contains("RECEIVE")),
                FirstMessageTime = trace.OrderBy(t => t.OperationTimestamp).FirstOrDefault()?.OperationTimestamp,
                LastMessageTime = trace.OrderByDescending(t => t.OperationTimestamp).FirstOrDefault()?.OperationTimestamp
            };

            if (detail.FirstMessageTime.HasValue && detail.LastMessageTime.HasValue)
            {
                detail.Duration = detail.LastMessageTime.Value - detail.FirstMessageTime.Value;
            }

            return ServiceResult<ConversationDetail>.Ok(detail, "Conversation detail retrieved successfully");
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error getting conversation detail: {ConversationHandle}", conversationHandle);
            return ServiceResult<ConversationDetail>.Fail($"Failed to get conversation detail: {ex.Message}");
        }
    }

    public async Task<List<ConversationTraceItem>> GetConversationTraceAsync(Guid conversationHandle)
    {
        if (conversationHandle == Guid.Empty)
        {
            _logger.LogWarning("GetConversationTrace called with empty conversation handle");
            return new List<ConversationTraceItem>();
        }

        _logger.LogDebug("Getting conversation trace: {ConversationHandle}", conversationHandle);
        return await _conversationRepository.GetConversationTraceAsync(conversationHandle);
    }

    public async Task<ConversationTimeline> BuildTimelineAsync(Guid conversationHandle)
    {
        _logger.LogDebug("Building timeline for conversation: {ConversationHandle}", conversationHandle);

        var trace = await _conversationRepository.GetConversationTraceAsync(conversationHandle);
        return BuildTimelineFromTrace(conversationHandle, trace);
    }

    public async Task<ServiceResult<string>> ExportAsJsonAsync(Guid conversationHandle)
    {
        if (conversationHandle == Guid.Empty)
        {
            return ServiceResult<string>.Fail("Conversation handle is required");
        }

        _logger.LogInformation("Exporting conversation as JSON: {ConversationHandle}", conversationHandle);

        try
        {
            var detailResult = await GetConversationDetailAsync(conversationHandle);
            if (!detailResult.Success || detailResult.Result == null)
            {
                return ServiceResult<string>.Fail(detailResult.Message, detailResult.Errors);
            }

            var options = new JsonSerializerOptions
            {
                WriteIndented = true,
                PropertyNamingPolicy = JsonNamingPolicy.CamelCase
            };

            var json = JsonSerializer.Serialize(new
            {
                ExportedAt = DateTime.UtcNow,
                ConversationHandle = conversationHandle,
                detailResult.Result.Conversation,
                detailResult.Result.Timeline,
                detailResult.Result.Trace,
                Summary = new
                {
                    detailResult.Result.MessageCount,
                    detailResult.Result.FirstMessageTime,
                    detailResult.Result.LastMessageTime,
                    DurationSeconds = detailResult.Result.Duration?.TotalSeconds
                }
            }, options);

            _logger.LogInformation("Successfully exported conversation as JSON: {ConversationHandle}", conversationHandle);
            return ServiceResult<string>.Ok(json, "Export completed successfully");
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error exporting conversation as JSON: {ConversationHandle}", conversationHandle);
            return ServiceResult<string>.Fail($"Failed to export as JSON: {ex.Message}");
        }
    }

    public async Task<ServiceResult<string>> ExportAsCsvAsync(Guid conversationHandle)
    {
        if (conversationHandle == Guid.Empty)
        {
            return ServiceResult<string>.Fail("Conversation handle is required");
        }

        _logger.LogInformation("Exporting conversation as CSV: {ConversationHandle}", conversationHandle);

        try
        {
            var trace = await _conversationRepository.GetConversationTraceAsync(conversationHandle);
            if (!trace.Any())
            {
                return ServiceResult<string>.Fail($"No trace data found for conversation {conversationHandle}");
            }

            var csv = new StringBuilder();
            csv.AppendLine("SequenceNumber,Timestamp,Operation,QueueName,ServiceName,MessageTypeName,MessageSequenceNumber,MessageSizeBytes,ApplicationName,UserName,HostName");

            foreach (var item in trace.OrderBy(t => t.SequenceNumber))
            {
                csv.AppendLine(string.Join(",",
                    item.SequenceNumber,
                    EscapeCsvField(item.OperationTimestamp.ToString("O")),
                    EscapeCsvField(item.Operation),
                    EscapeCsvField(item.QueueName ?? ""),
                    EscapeCsvField(item.ServiceName ?? ""),
                    EscapeCsvField(item.MessageTypeName ?? ""),
                    item.MessageSequenceNumber?.ToString() ?? "",
                    item.MessageSizeBytes?.ToString() ?? "",
                    EscapeCsvField(item.ApplicationName ?? ""),
                    EscapeCsvField(item.UserName ?? ""),
                    EscapeCsvField(item.HostName ?? "")
                ));
            }

            _logger.LogInformation("Successfully exported conversation as CSV: {ConversationHandle}", conversationHandle);
            return ServiceResult<string>.Ok(csv.ToString(), "Export completed successfully");
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error exporting conversation as CSV: {ConversationHandle}", conversationHandle);
            return ServiceResult<string>.Fail($"Failed to export as CSV: {ex.Message}");
        }
    }

    public async Task<ServiceResult> EndConversationAsync(Guid conversationHandle, bool withCleanup = false)
    {
        if (conversationHandle == Guid.Empty)
        {
            return ServiceResult.Fail("Conversation handle is required");
        }

        _logger.LogInformation("Ending conversation: {ConversationHandle}, WithCleanup: {WithCleanup}",
            conversationHandle, withCleanup);

        try
        {
            await _conversationRepository.EndConversationAsync(conversationHandle, withCleanup);

            _logger.LogInformation("Successfully ended conversation: {ConversationHandle}", conversationHandle);
            return ServiceResult.Ok($"Conversation {conversationHandle} has been ended");
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error ending conversation: {ConversationHandle}", conversationHandle);
            return ServiceResult.Fail($"Failed to end conversation: {ex.Message}");
        }
    }

    public async Task<ConversationStats> GetConversationStatsAsync()
    {
        _logger.LogDebug("Getting conversation statistics");

        var conversations = await _conversationRepository.GetConversationsAsync();

        var stats = new ConversationStats
        {
            TotalActive = conversations.Count,
            ByState_Conversing = conversations.Count(c => c.State == "CO"),
            ByState_Started = conversations.Count(c => c.State == "SO" || c.State == "SI"),
            ByState_Error = conversations.Count(c => c.State == "ER"),
            ByState_Other = conversations.Count(c => !new[] { "CO", "SO", "SI", "ER" }.Contains(c.State)),
            ByService = conversations
                .GroupBy(c => c.LocalService)
                .ToDictionary(g => g.Key, g => g.Count()),
            Initiators = conversations.Count(c => c.IsInitiator),
            Targets = conversations.Count(c => !c.IsInitiator)
        };

        if (conversations.Any())
        {
            var lifetimes = conversations
                .Where(c => c.Lifetime > DateTime.UtcNow)
                .Select(c => (c.Lifetime - DateTime.UtcNow).TotalSeconds)
                .ToList();

            if (lifetimes.Any())
            {
                stats.AverageLifetime = TimeSpan.FromSeconds(lifetimes.Average());
            }
        }

        return stats;
    }

    private ConversationTimeline BuildTimelineFromTrace(Guid conversationHandle, List<ConversationTraceItem> trace)
    {
        var orderedTrace = trace.OrderBy(t => t.SequenceNumber).ToList();

        var timeline = new ConversationTimeline
        {
            ConversationHandle = conversationHandle,
            StartTime = orderedTrace.FirstOrDefault()?.OperationTimestamp ?? DateTime.MinValue,
            EndTime = orderedTrace.LastOrDefault()?.OperationTimestamp
        };

        // Build events
        foreach (var item in orderedTrace)
        {
            var timelineEvent = new TimelineEvent
            {
                SequenceNumber = item.SequenceNumber,
                Timestamp = item.OperationTimestamp,
                EventType = item.Operation,
                MessageType = item.MessageTypeName,
                MessagePreview = item.MessageBodyPreview,
                MessageSize = item.MessageSizeBytes,
                QueueName = item.QueueName,
                ApplicationName = item.ApplicationName
            };

            // Determine direction based on operation
            if (item.Operation.Contains("SEND", StringComparison.OrdinalIgnoreCase))
            {
                timelineEvent.Direction = "Outbound";
                timelineEvent.FromService = item.ServiceName;
            }
            else if (item.Operation.Contains("RECEIVE", StringComparison.OrdinalIgnoreCase))
            {
                timelineEvent.Direction = "Inbound";
                timelineEvent.ToService = item.ServiceName;
            }

            timelineEvent.Metadata["UserName"] = item.UserName ?? "";
            timelineEvent.Metadata["HostName"] = item.HostName ?? "";
            timelineEvent.Metadata["AuditId"] = item.AuditId;

            timeline.Events.Add(timelineEvent);
        }

        // Build participants
        var services = orderedTrace
            .Where(t => !string.IsNullOrEmpty(t.ServiceName))
            .Select(t => t.ServiceName!)
            .Distinct();

        foreach (var service in services)
        {
            var serviceTrace = orderedTrace.Where(t => t.ServiceName == service).ToList();

            timeline.Participants.Add(new TimelineParticipant
            {
                ServiceName = service,
                QueueName = serviceTrace.FirstOrDefault()?.QueueName,
                IsInitiator = serviceTrace.Any(t => t.Operation.Contains("BEGIN", StringComparison.OrdinalIgnoreCase)),
                MessagesSent = serviceTrace.Count(t => t.Operation.Contains("SEND", StringComparison.OrdinalIgnoreCase)),
                MessagesReceived = serviceTrace.Count(t => t.Operation.Contains("RECEIVE", StringComparison.OrdinalIgnoreCase))
            });
        }

        return timeline;
    }

    private static string EscapeCsvField(string field)
    {
        if (string.IsNullOrEmpty(field)) return "";

        if (field.Contains(',') || field.Contains('"') || field.Contains('\n') || field.Contains('\r'))
        {
            return $"\"{field.Replace("\"", "\"\"")}\"";
        }

        return field;
    }
}
