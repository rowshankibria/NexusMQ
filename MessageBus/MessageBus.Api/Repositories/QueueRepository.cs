using MessageBus.Api.Data;
using MessageBus.Api.Models;
using MessageBus.Api.Repositories.Interfaces;
using Microsoft.Data.SqlClient;
using Microsoft.EntityFrameworkCore;

namespace MessageBus.Api.Repositories;

/// <summary>
/// Repository implementation for queue-related operations
/// </summary>
public class QueueRepository : IQueueRepository
{
    private readonly MessageBusDbContext _context;

    public QueueRepository(MessageBusDbContext context)
    {
        _context = context;
    }

    public async Task<List<QueueInfo>> GetAllQueuesAsync(bool includeSystemQueues = false, bool includeEmptyQueues = true)
    {
        var includeSystemQueuesParam = new SqlParameter("@IncludeSystemQueues", includeSystemQueues);
        var includeEmptyQueuesParam = new SqlParameter("@IncludeEmptyQueues", includeEmptyQueues);

        return await _context.Set<QueueInfo>()
            .FromSqlRaw("EXEC dbo.usp_GetAllQueuesWithStats @IncludeSystemQueues, @IncludeEmptyQueues",
                includeSystemQueuesParam, includeEmptyQueuesParam)
            .ToListAsync();
    }

    public async Task<QueueStatistics?> GetQueueStatisticsAsync(string queueName)
    {
        var param = new SqlParameter("@QueueName", queueName);

        return await _context.Set<QueueStatistics>()
            .FromSqlRaw("EXEC dbo.usp_GetQueueStatistics @QueueName", param)
            .FirstOrDefaultAsync();
    }

    public async Task PauseQueueAsync(string queueName)
    {
        var param = new SqlParameter("@QueueName", queueName);
        await _context.Database.ExecuteSqlRawAsync("EXEC dbo.usp_PauseQueue @QueueName", param);
    }

    public async Task ResumeQueueAsync(string queueName)
    {
        var param = new SqlParameter("@QueueName", queueName);
        await _context.Database.ExecuteSqlRawAsync("EXEC dbo.usp_ResumeQueue @QueueName", param);
    }

    public async Task PurgeQueueAsync(string queueName)
    {
        var param = new SqlParameter("@QueueName", queueName);
        await _context.Database.ExecuteSqlRawAsync("EXEC dbo.usp_PurgeQueue @QueueName", param);
    }
}
