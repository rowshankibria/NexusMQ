namespace MessageBus.Client.Models;

/// <summary>
/// Represents the status of a message queue
/// </summary>
public class QueueStatus
{
    /// <summary>
    /// Name of the queue
    /// </summary>
    public string QueueName { get; set; } = string.Empty;

    /// <summary>
    /// Total number of messages in the queue
    /// </summary>
    public int MessageCount { get; set; }

    /// <summary>
    /// Number of messages ready for processing
    /// </summary>
    public int ReadyCount { get; set; }

    /// <summary>
    /// Whether receive is enabled on the queue
    /// </summary>
    public bool IsReceiveEnabled { get; set; }

    /// <summary>
    /// Whether activation is enabled on the queue
    /// </summary>
    public bool IsActivationEnabled { get; set; }

    /// <summary>
    /// Age of the oldest message in seconds
    /// </summary>
    public int? OldestMessageAgeSeconds { get; set; }

    /// <summary>
    /// Number of active conversations
    /// </summary>
    public int ActiveConversations { get; set; }

    /// <summary>
    /// Number of conversations in error state
    /// </summary>
    public int ErrorConversations { get; set; }

    /// <summary>
    /// Overall health status (Healthy, Warning, Critical, Unknown)
    /// </summary>
    public string Status { get; set; } = string.Empty;
}

/// <summary>
/// Represents a message received from a queue
/// </summary>
public class MessageReceived<T>
{
    /// <summary>
    /// The queue the message was received from
    /// </summary>
    public string QueueName { get; set; } = string.Empty;

    /// <summary>
    /// The conversation handle for this message
    /// </summary>
    public Guid ConversationHandle { get; set; }

    /// <summary>
    /// The message type
    /// </summary>
    public string MessageType { get; set; } = string.Empty;

    /// <summary>
    /// The deserialized message body
    /// </summary>
    public T? Body { get; set; }

    /// <summary>
    /// When the message was received
    /// </summary>
    public DateTime ReceivedAt { get; set; } = DateTime.UtcNow;
}

/// <summary>
/// Result of sending a message
/// </summary>
public class SendMessageResult
{
    /// <summary>
    /// Whether the send was successful
    /// </summary>
    public bool Success { get; set; }

    /// <summary>
    /// The conversation handle for the sent message
    /// </summary>
    public Guid? ConversationHandle { get; set; }

    /// <summary>
    /// Message describing the result
    /// </summary>
    public string Message { get; set; } = string.Empty;

    /// <summary>
    /// Error details if the send failed
    /// </summary>
    public string? Error { get; set; }
}
