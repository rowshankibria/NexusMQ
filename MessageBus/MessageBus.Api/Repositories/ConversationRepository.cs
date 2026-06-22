using MessageBus.Api.Data;
using MessageBus.Api.Models;
using MessageBus.Api.Repositories.Interfaces;
using Microsoft.Data.SqlClient;
using Microsoft.EntityFrameworkCore;

namespace MessageBus.Api.Repositories;

/// <summary>
/// Repository implementation for conversation-related operations
/// </summary>
public class ConversationRepository : IConversationRepository
{
    private readonly MessageBusDbContext _context;

    public ConversationRepository(MessageBusDbContext context)
    {
        _context = context;
    }

    public async Task<List<ConversationInfo>> GetConversationsAsync(string? stateFilter = null, string? serviceFilter = null)
    {
        var sql = "SELECT * FROM dbo.vw_ActiveConversations WHERE 1=1";
        var parameters = new List<SqlParameter>();

        if (!string.IsNullOrEmpty(stateFilter))
        {
            sql += " AND State = @StateFilter";
            parameters.Add(new SqlParameter("@StateFilter", stateFilter));
        }

        if (!string.IsNullOrEmpty(serviceFilter))
        {
            sql += " AND (LocalService = @ServiceFilter OR FarService = @ServiceFilter)";
            parameters.Add(new SqlParameter("@ServiceFilter", serviceFilter));
        }

        sql += " ORDER BY Lifetime DESC";

        return await _context.Set<ConversationInfo>()
            .FromSqlRaw(sql, parameters.ToArray())
            .ToListAsync();
    }

    public async Task<List<ConversationTraceItem>> GetConversationTraceAsync(Guid conversationHandle, bool includeDeadLetterHistory = true, bool includeTransmissionQueue = true)
    {
        var parameters = new[]
        {
            new SqlParameter("@ConversationHandle", conversationHandle),
            new SqlParameter("@ConversationId", DBNull.Value),
            new SqlParameter("@IncludeDeadLetterHistory", includeDeadLetterHistory),
            new SqlParameter("@IncludeTransmissionQueue", includeTransmissionQueue)
        };

        // Note: The stored procedure returns multiple result sets.
        // For simplicity, we're returning the MESSAGE_TIMELINE result set.
        // In a full implementation, you might want to return a composite object.
        return await _context.Set<ConversationTraceItem>()
            .FromSqlRaw("EXEC dbo.usp_GetConversationTrace @ConversationHandle, @ConversationId, @IncludeDeadLetterHistory, @IncludeTransmissionQueue",
                parameters)
            .ToListAsync();
    }

    public async Task EndConversationAsync(Guid conversationHandle, bool withCleanup = false)
    {
        var sql = withCleanup
            ? "END CONVERSATION @ConversationHandle WITH CLEANUP"
            : "END CONVERSATION @ConversationHandle";

        var param = new SqlParameter("@ConversationHandle", conversationHandle);
        await _context.Database.ExecuteSqlRawAsync(sql, param);
    }
}
