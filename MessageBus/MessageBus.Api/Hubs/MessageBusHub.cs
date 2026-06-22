using MessageBus.Api.Models;
using MessageBus.Api.Services.Interfaces;
using Microsoft.AspNetCore.SignalR;

namespace MessageBus.Api.Hubs;

/// <summary>
/// SignalR hub for real-time message bus updates
/// </summary>
public class MessageBusHub : Hub
{
    private readonly ILogger<MessageBusHub> _logger;

    public MessageBusHub(ILogger<MessageBusHub> logger)
    {
        _logger = logger;
    }

    public override async Task OnConnectedAsync()
    {
        _logger.LogInformation("Client connected: {ConnectionId}", Context.ConnectionId);
        await base.OnConnectedAsync();
    }

    public override async Task OnDisconnectedAsync(Exception? exception)
    {
        _logger.LogInformation("Client disconnected: {ConnectionId}", Context.ConnectionId);
        await base.OnDisconnectedAsync(exception);
    }

    /// <summary>
    /// Subscribe to a specific queue's updates
    /// </summary>
    /// <param name="queueName">Name of the queue to subscribe to</param>
    public async Task SubscribeToQueue(string queueName)
    {
        if (string.IsNullOrWhiteSpace(queueName))
        {
            _logger.LogWarning("Client {ConnectionId} attempted to subscribe with empty queue name", Context.ConnectionId);
            return;
        }

        await Groups.AddToGroupAsync(Context.ConnectionId, $"queue:{queueName}");
        _logger.LogInformation("Client {ConnectionId} subscribed to queue: {QueueName}", Context.ConnectionId, queueName);

        // Send confirmation to the client
        await Clients.Caller.SendAsync("SubscriptionConfirmed", new
        {
            Type = "queue",
            Name = queueName,
            Timestamp = DateTime.UtcNow
        });
    }

    /// <summary>
    /// Unsubscribe from a specific queue's updates
    /// </summary>
    /// <param name="queueName">Name of the queue to unsubscribe from</param>
    public async Task UnsubscribeFromQueue(string queueName)
    {
        if (string.IsNullOrWhiteSpace(queueName))
        {
            return;
        }

        await Groups.RemoveFromGroupAsync(Context.ConnectionId, $"queue:{queueName}");
        _logger.LogInformation("Client {ConnectionId} unsubscribed from queue: {QueueName}", Context.ConnectionId, queueName);

        // Send confirmation to the client
        await Clients.Caller.SendAsync("UnsubscriptionConfirmed", new
        {
            Type = "queue",
            Name = queueName,
            Timestamp = DateTime.UtcNow
        });
    }

    /// <summary>
    /// Subscribe to dashboard updates (health, metrics, alerts)
    /// </summary>
    public async Task SubscribeToDashboard()
    {
        await Groups.AddToGroupAsync(Context.ConnectionId, "dashboard");
        _logger.LogInformation("Client {ConnectionId} subscribed to dashboard", Context.ConnectionId);

        await Clients.Caller.SendAsync("SubscriptionConfirmed", new
        {
            Type = "dashboard",
            Name = "dashboard",
            Timestamp = DateTime.UtcNow
        });
    }

    /// <summary>
    /// Unsubscribe from dashboard updates
    /// </summary>
    public async Task UnsubscribeFromDashboard()
    {
        await Groups.RemoveFromGroupAsync(Context.ConnectionId, "dashboard");
        _logger.LogInformation("Client {ConnectionId} unsubscribed from dashboard", Context.ConnectionId);

        await Clients.Caller.SendAsync("UnsubscriptionConfirmed", new
        {
            Type = "dashboard",
            Name = "dashboard",
            Timestamp = DateTime.UtcNow
        });
    }

    /// <summary>
    /// Subscribe to alert notifications
    /// </summary>
    public async Task SubscribeToAlerts()
    {
        await Groups.AddToGroupAsync(Context.ConnectionId, "alerts");
        _logger.LogInformation("Client {ConnectionId} subscribed to alerts", Context.ConnectionId);

        await Clients.Caller.SendAsync("SubscriptionConfirmed", new
        {
            Type = "alerts",
            Name = "alerts",
            Timestamp = DateTime.UtcNow
        });
    }

    /// <summary>
    /// Unsubscribe from alert notifications
    /// </summary>
    public async Task UnsubscribeFromAlerts()
    {
        await Groups.RemoveFromGroupAsync(Context.ConnectionId, "alerts");
        _logger.LogInformation("Client {ConnectionId} unsubscribed from alerts", Context.ConnectionId);

        await Clients.Caller.SendAsync("UnsubscriptionConfirmed", new
        {
            Type = "alerts",
            Name = "alerts",
            Timestamp = DateTime.UtcNow
        });
    }

    /// <summary>
    /// Subscribe to conversation updates
    /// </summary>
    /// <param name="conversationHandle">The conversation handle to subscribe to</param>
    public async Task SubscribeToConversation(Guid conversationHandle)
    {
        if (conversationHandle == Guid.Empty)
        {
            _logger.LogWarning("Client {ConnectionId} attempted to subscribe with empty conversation handle", Context.ConnectionId);
            return;
        }

        await Groups.AddToGroupAsync(Context.ConnectionId, $"conversation:{conversationHandle}");
        _logger.LogInformation("Client {ConnectionId} subscribed to conversation: {ConversationHandle}",
            Context.ConnectionId, conversationHandle);

        await Clients.Caller.SendAsync("SubscriptionConfirmed", new
        {
            Type = "conversation",
            Name = conversationHandle.ToString(),
            Timestamp = DateTime.UtcNow
        });
    }

    /// <summary>
    /// Unsubscribe from conversation updates
    /// </summary>
    /// <param name="conversationHandle">The conversation handle to unsubscribe from</param>
    public async Task UnsubscribeFromConversation(Guid conversationHandle)
    {
        if (conversationHandle == Guid.Empty)
        {
            return;
        }

        await Groups.RemoveFromGroupAsync(Context.ConnectionId, $"conversation:{conversationHandle}");
        _logger.LogInformation("Client {ConnectionId} unsubscribed from conversation: {ConversationHandle}",
            Context.ConnectionId, conversationHandle);

        await Clients.Caller.SendAsync("UnsubscriptionConfirmed", new
        {
            Type = "conversation",
            Name = conversationHandle.ToString(),
            Timestamp = DateTime.UtcNow
        });
    }

    /// <summary>
    /// Get current connection status
    /// </summary>
    public async Task Ping()
    {
        await Clients.Caller.SendAsync("Pong", new
        {
            ConnectionId = Context.ConnectionId,
            Timestamp = DateTime.UtcNow,
            Status = "Connected"
        });
    }
}

/// <summary>
/// Extension methods for sending SignalR messages from services
/// </summary>
public static class MessageBusHubExtensions
{
    /// <summary>
    /// Send queue statistics update to subscribed clients
    /// </summary>
    public static async Task SendQueueUpdated(this IHubContext<MessageBusHub> hubContext, string queueName, QueueStatistics stats)
    {
        await hubContext.Clients.Group($"queue:{queueName}").SendAsync("QueueUpdated", new
        {
            QueueName = queueName,
            Statistics = stats,
            Timestamp = DateTime.UtcNow
        });
    }

    /// <summary>
    /// Send alert triggered notification to subscribed clients
    /// </summary>
    public static async Task SendAlertTriggered(this IHubContext<MessageBusHub> hubContext, ActiveAlert alert)
    {
        // Send to alerts group
        await hubContext.Clients.Group("alerts").SendAsync("AlertTriggered", new
        {
            Alert = alert,
            Timestamp = DateTime.UtcNow
        });

        // Also send to dashboard
        await hubContext.Clients.Group("dashboard").SendAsync("AlertTriggered", new
        {
            Alert = alert,
            Timestamp = DateTime.UtcNow
        });
    }

    /// <summary>
    /// Send health update to dashboard subscribers
    /// </summary>
    public static async Task SendHealthUpdate(this IHubContext<MessageBusHub> hubContext, SystemStatus status)
    {
        await hubContext.Clients.Group("dashboard").SendAsync("HealthUpdated", new
        {
            Status = status,
            Timestamp = DateTime.UtcNow
        });
    }

    /// <summary>
    /// Send metrics update to dashboard subscribers
    /// </summary>
    public static async Task SendMetricsUpdate(this IHubContext<MessageBusHub> hubContext, List<PerformanceMetric> metrics)
    {
        await hubContext.Clients.Group("dashboard").SendAsync("MetricsUpdated", new
        {
            Metrics = metrics,
            Timestamp = DateTime.UtcNow
        });
    }

    /// <summary>
    /// Send conversation update to subscribed clients
    /// </summary>
    public static async Task SendConversationUpdated(this IHubContext<MessageBusHub> hubContext, Guid conversationHandle, ConversationDetail detail)
    {
        await hubContext.Clients.Group($"conversation:{conversationHandle}").SendAsync("ConversationUpdated", new
        {
            ConversationHandle = conversationHandle,
            Detail = detail,
            Timestamp = DateTime.UtcNow
        });
    }

    /// <summary>
    /// Send poison message alert to dashboard
    /// </summary>
    public static async Task SendPoisonMessageAlert(this IHubContext<MessageBusHub> hubContext, PoisonMessageInfo poisonMessage)
    {
        await hubContext.Clients.Group("dashboard").SendAsync("PoisonMessageDetected", new
        {
            PoisonMessage = poisonMessage,
            Timestamp = DateTime.UtcNow
        });
    }

    /// <summary>
    /// Broadcast a general notification to all connected clients
    /// </summary>
    public static async Task BroadcastNotification(this IHubContext<MessageBusHub> hubContext, string type, string message, object? data = null)
    {
        await hubContext.Clients.All.SendAsync("Notification", new
        {
            Type = type,
            Message = message,
            Data = data,
            Timestamp = DateTime.UtcNow
        });
    }
}
