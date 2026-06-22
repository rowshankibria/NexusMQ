using MessageBus.Api.Models;

namespace MessageBus.Api.Services.Interfaces;

/// <summary>
/// Service interface for conversation-related business operations
/// </summary>
public interface IConversationService
{
    /// <summary>
    /// Gets active conversations with optional filtering
    /// </summary>
    Task<List<ConversationInfo>> GetConversationsAsync(string? stateFilter = null, string? serviceFilter = null);

    /// <summary>
    /// Gets a conversation with its full trace
    /// </summary>
    Task<ServiceResult<ConversationDetail>> GetConversationDetailAsync(Guid conversationHandle, bool includeDeadLetterHistory = true, bool includeTransmissionQueue = true);

    /// <summary>
    /// Gets the conversation trace items
    /// </summary>
    Task<List<ConversationTraceItem>> GetConversationTraceAsync(Guid conversationHandle);

    /// <summary>
    /// Builds a timeline data structure for visualization
    /// </summary>
    Task<ConversationTimeline> BuildTimelineAsync(Guid conversationHandle);

    /// <summary>
    /// Exports a conversation as JSON
    /// </summary>
    Task<ServiceResult<string>> ExportAsJsonAsync(Guid conversationHandle);

    /// <summary>
    /// Exports a conversation as CSV
    /// </summary>
    Task<ServiceResult<string>> ExportAsCsvAsync(Guid conversationHandle);

    /// <summary>
    /// Ends a conversation
    /// </summary>
    Task<ServiceResult> EndConversationAsync(Guid conversationHandle, bool withCleanup = false);

    /// <summary>
    /// Gets conversation statistics
    /// </summary>
    Task<ConversationStats> GetConversationStatsAsync();
}

/// <summary>
/// Detailed conversation information including trace
/// </summary>
public class ConversationDetail
{
    public ConversationInfo Conversation { get; set; } = new();
    public List<ConversationTraceItem> Trace { get; set; } = new();
    public ConversationTimeline Timeline { get; set; } = new();
    public int MessageCount { get; set; }
    public DateTime? FirstMessageTime { get; set; }
    public DateTime? LastMessageTime { get; set; }
    public TimeSpan? Duration { get; set; }
}

/// <summary>
/// Timeline representation of a conversation for visualization
/// </summary>
public class ConversationTimeline
{
    public Guid ConversationHandle { get; set; }
    public DateTime StartTime { get; set; }
    public DateTime? EndTime { get; set; }
    public List<TimelineEvent> Events { get; set; } = new();
    public List<TimelineParticipant> Participants { get; set; } = new();
}

/// <summary>
/// Represents an event in the conversation timeline
/// </summary>
public class TimelineEvent
{
    public long SequenceNumber { get; set; }
    public DateTime Timestamp { get; set; }
    public string EventType { get; set; } = string.Empty;
    public string? Direction { get; set; }
    public string? FromService { get; set; }
    public string? ToService { get; set; }
    public string? MessageType { get; set; }
    public string? MessagePreview { get; set; }
    public int? MessageSize { get; set; }
    public string? QueueName { get; set; }
    public string? ApplicationName { get; set; }
    public Dictionary<string, object> Metadata { get; set; } = new();
}

/// <summary>
/// Represents a participant in a conversation
/// </summary>
public class TimelineParticipant
{
    public string ServiceName { get; set; } = string.Empty;
    public string? QueueName { get; set; }
    public bool IsInitiator { get; set; }
    public int MessagesSent { get; set; }
    public int MessagesReceived { get; set; }
}

/// <summary>
/// Statistics about conversations
/// </summary>
public class ConversationStats
{
    public int TotalActive { get; set; }
    public int ByState_Conversing { get; set; }
    public int ByState_Started { get; set; }
    public int ByState_Error { get; set; }
    public int ByState_Other { get; set; }
    public Dictionary<string, int> ByService { get; set; } = new();
    public int Initiators { get; set; }
    public int Targets { get; set; }
    public TimeSpan? AverageLifetime { get; set; }
}
