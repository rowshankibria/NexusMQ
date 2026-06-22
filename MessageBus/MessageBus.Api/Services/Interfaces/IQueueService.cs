using MessageBus.Api.Models;

namespace MessageBus.Api.Services.Interfaces;

/// <summary>
/// Service interface for queue-related business operations
/// </summary>
public interface IQueueService
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
    /// Gets the calculated health status for a queue
    /// </summary>
    Task<QueueHealthStatus> GetQueueHealthStatusAsync(string queueName);

    /// <summary>
    /// Pauses a queue with validation
    /// </summary>
    Task<ServiceResult> PauseQueueAsync(string queueName);

    /// <summary>
    /// Resumes a queue with validation
    /// </summary>
    Task<ServiceResult> ResumeQueueAsync(string queueName);

    /// <summary>
    /// Purges all messages from a queue with validation
    /// </summary>
    Task<ServiceResult> PurgeQueueAsync(string queueName, bool requireConfirmation = true);
}

/// <summary>
/// Represents a queue's health status
/// </summary>
public class QueueHealthStatus
{
    public string QueueName { get; set; } = string.Empty;
    public HealthLevel Status { get; set; }
    public string StatusDescription { get; set; } = string.Empty;
    public int MessageCount { get; set; }
    public int? OldestMessageAgeSeconds { get; set; }
    public bool IsReceiveEnabled { get; set; }
    public bool IsActivationEnabled { get; set; }
    public int ErrorConversations { get; set; }
    public List<string> Issues { get; set; } = new();
    public DateTime CheckedAt { get; set; } = DateTime.UtcNow;
}

/// <summary>
/// Health level enumeration
/// </summary>
public enum HealthLevel
{
    Healthy,
    Warning,
    Critical,
    Unknown
}

/// <summary>
/// Generic service operation result
/// </summary>
public class ServiceResult
{
    public bool Success { get; set; }
    public string Message { get; set; } = string.Empty;
    public List<string> Errors { get; set; } = new();
    public Dictionary<string, object> Data { get; set; } = new();

    public static ServiceResult Ok(string message = "Operation completed successfully")
        => new() { Success = true, Message = message };

    public static ServiceResult Fail(string message, params string[] errors)
        => new() { Success = false, Message = message, Errors = errors.ToList() };

    public static ServiceResult Fail(string message, List<string> errors)
        => new() { Success = false, Message = message, Errors = errors };
}

/// <summary>
/// Generic service operation result with data
/// </summary>
public class ServiceResult<T> : ServiceResult
{
    public T? Result { get; set; }

    public static ServiceResult<T> Ok(T result, string message = "Operation completed successfully")
        => new() { Success = true, Message = message, Result = result };

    public new static ServiceResult<T> Fail(string message, params string[] errors)
        => new() { Success = false, Message = message, Errors = errors.ToList() };

    public new static ServiceResult<T> Fail(string message, List<string> errors)
        => new() { Success = false, Message = message, Errors = errors };
}
