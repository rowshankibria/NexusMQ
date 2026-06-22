using MessageBus.Api.Models;

namespace MessageBus.Api.Repositories.Interfaces;

/// <summary>
/// Repository interface for queue-related operations
/// </summary>
public interface IQueueRepository
{
    /// <summary>
    /// Gets all queues with their statistics
    /// </summary>
    Task<List<QueueInfo>> GetAllQueuesAsync(bool includeSystemQueues = false, bool includeEmptyQueues = true);

    /// <summary>
    /// Gets detailed statistics for a specific queue
    /// </summary>
    Task<QueueStatistics?> GetQueueStatisticsAsync(string queueName);

    /// <summary>
    /// Pauses (disables receive on) a queue
    /// </summary>
    Task PauseQueueAsync(string queueName);

    /// <summary>
    /// Resumes (enables receive on) a queue
    /// </summary>
    Task ResumeQueueAsync(string queueName);

    /// <summary>
    /// Purges all messages from a queue
    /// </summary>
    Task PurgeQueueAsync(string queueName);
}
