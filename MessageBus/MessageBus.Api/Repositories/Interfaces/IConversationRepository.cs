using MessageBus.Api.Models;

namespace MessageBus.Api.Repositories.Interfaces;

/// <summary>
/// Repository interface for conversation-related operations
/// </summary>
public interface IConversationRepository
{
    /// <summary>
    /// Gets active conversations with optional filtering
    /// </summary>
    Task<List<ConversationInfo>> GetConversationsAsync(string? stateFilter = null, string? serviceFilter = null);

    /// <summary>
    /// Gets the conversation trace/history for a specific conversation
    /// </summary>
    Task<List<ConversationTraceItem>> GetConversationTraceAsync(Guid conversationHandle, bool includeDeadLetterHistory = true, bool includeTransmissionQueue = true);

    /// <summary>
    /// Ends a conversation
    /// </summary>
    Task EndConversationAsync(Guid conversationHandle, bool withCleanup = false);
}
