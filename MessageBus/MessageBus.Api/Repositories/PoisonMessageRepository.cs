using MessageBus.Api.Data;
using MessageBus.Api.Models;
using MessageBus.Api.Repositories.Interfaces;
using Microsoft.Data.SqlClient;
using Microsoft.EntityFrameworkCore;

namespace MessageBus.Api.Repositories;

/// <summary>
/// Repository implementation for poison message and dead letter queue operations
/// </summary>
public class PoisonMessageRepository : IPoisonMessageRepository
{
    private readonly MessageBusDbContext _context;

    public PoisonMessageRepository(MessageBusDbContext context)
    {
        _context = context;
    }

    public async Task<List<PoisonMessageInfo>> GetPoisonMessagesAsync()
    {
        return await _context.Set<PoisonMessageInfo>()
            .FromSqlRaw("SELECT * FROM dbo.vw_PoisonMessages")
            .ToListAsync();
    }

    public async Task<List<DeadLetterMessage>> GetDeadLetteredMessagesAsync(bool includeResolved = false)
    {
        if (includeResolved)
        {
            return await _context.DeadLetterMessages
                .OrderByDescending(d => d.MovedToDeadLetterAt)
                .ToListAsync();
        }

        return await _context.DeadLetterMessages
            .Where(d => d.ResolvedAt == null)
            .OrderByDescending(d => d.MovedToDeadLetterAt)
            .ToListAsync();
    }

    public async Task RetryPoisonMessageAsync(long id)
    {
        var param = new SqlParameter("@Id", id);
        await _context.Database.ExecuteSqlRawAsync("EXEC dbo.usp_RetryPoisonMessage @Id", param);
    }

    public async Task MoveToDeadLetterAsync(Guid conversationHandle, string queueName, string reason)
    {
        var parameters = new[]
        {
            new SqlParameter("@ConversationHandle", conversationHandle),
            new SqlParameter("@QueueName", queueName),
            new SqlParameter("@Reason", reason)
        };

        await _context.Database.ExecuteSqlRawAsync(
            "EXEC dbo.usp_MoveToDeadLetter @ConversationHandle, @QueueName, @Reason",
            parameters);
    }

    public async Task ResolveDeadLetterMessageAsync(long id, string resolutionNotes, string resolvedBy)
    {
        var message = await _context.DeadLetterMessages.FindAsync(id);
        if (message != null)
        {
            message.ResolvedAt = DateTime.UtcNow;
            message.ResolutionNotes = resolutionNotes;
            message.ResolvedBy = resolvedBy;
            await _context.SaveChangesAsync();
        }
    }
}
