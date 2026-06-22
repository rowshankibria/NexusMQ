using System.Net.Http.Headers;
using System.Text;
using System.Text.Json;
using MessageBus.Client.Models;
using Microsoft.AspNetCore.SignalR.Client;

namespace MessageBus.Client;

/// <summary>
/// Client for interacting with the MessageBus API
/// </summary>
public class MessageBusClient : IDisposable
{
    private HttpClient? _httpClient;
    private HubConnection? _hubConnection;
    private string _apiUrl = string.Empty;
    private string _apiKey = string.Empty;
    private bool _disposed;

    private readonly Dictionary<string, List<IDisposable>> _subscriptions = new();
    private readonly JsonSerializerOptions _jsonOptions = new()
    {
        PropertyNameCaseInsensitive = true,
        PropertyNamingPolicy = JsonNamingPolicy.CamelCase
    };

    /// <summary>
    /// Gets whether the SignalR connection is established
    /// </summary>
    public bool IsConnected => _hubConnection?.State == HubConnectionState.Connected;

    /// <summary>
    /// Configures the client with the API URL and API key
    /// </summary>
    /// <param name="apiUrl">The base URL of the MessageBus API (e.g., http://localhost:5000/api)</param>
    /// <param name="apiKey">The API key for authentication</param>
    public void Configure(string apiUrl, string apiKey)
    {
        if (string.IsNullOrWhiteSpace(apiUrl))
            throw new ArgumentException("API URL is required", nameof(apiUrl));
        if (string.IsNullOrWhiteSpace(apiKey))
            throw new ArgumentException("API key is required", nameof(apiKey));

        _apiUrl = apiUrl.TrimEnd('/');
        _apiKey = apiKey;

        // Create or reconfigure HttpClient
        _httpClient = new HttpClient
        {
            BaseAddress = new Uri(_apiUrl)
        };
        _httpClient.DefaultRequestHeaders.Add("X-API-Key", _apiKey);
        _httpClient.DefaultRequestHeaders.Accept.Add(new MediaTypeWithQualityHeaderValue("application/json"));
    }

    /// <summary>
    /// Connects to the SignalR hub for real-time updates
    /// </summary>
    public async Task ConnectAsync(CancellationToken cancellationToken = default)
    {
        EnsureConfigured();

        var hubUrl = _apiUrl.Replace("/api", "") + "/hubs/messagebus";

        _hubConnection = new HubConnectionBuilder()
            .WithUrl(hubUrl, options =>
            {
                options.Headers.Add("X-API-Key", _apiKey);
            })
            .WithAutomaticReconnect()
            .Build();

        await _hubConnection.StartAsync(cancellationToken);
    }

    /// <summary>
    /// Disconnects from the SignalR hub
    /// </summary>
    public async Task DisconnectAsync(CancellationToken cancellationToken = default)
    {
        if (_hubConnection != null)
        {
            await _hubConnection.StopAsync(cancellationToken);
            await _hubConnection.DisposeAsync();
            _hubConnection = null;
        }
    }

    /// <summary>
    /// Publishes a message to a queue
    /// </summary>
    /// <typeparam name="T">The type of the message</typeparam>
    /// <param name="queueName">The name of the target queue</param>
    /// <param name="message">The message to send</param>
    /// <param name="messageType">Optional message type (defaults to type name)</param>
    /// <param name="cancellationToken">Cancellation token</param>
    public async Task<SendMessageResult> PublishAsync<T>(
        string queueName,
        T message,
        string? messageType = null,
        CancellationToken cancellationToken = default)
    {
        EnsureConfigured();

        var request = new
        {
            queueName,
            messageType = messageType ?? typeof(T).Name,
            messageBody = JsonSerializer.Serialize(message, _jsonOptions)
        };

        var content = new StringContent(
            JsonSerializer.Serialize(request, _jsonOptions),
            Encoding.UTF8,
            "application/json");

        var response = await _httpClient!.PostAsync("messages/send", content, cancellationToken);

        if (!response.IsSuccessStatusCode)
        {
            var error = await response.Content.ReadAsStringAsync(cancellationToken);
            throw CreateException(response, error);
        }

        var responseBody = await response.Content.ReadAsStringAsync(cancellationToken);
        return JsonSerializer.Deserialize<SendMessageResult>(responseBody, _jsonOptions)
            ?? new SendMessageResult { Success = true };
    }

    /// <summary>
    /// Subscribes to messages from a queue via SignalR
    /// </summary>
    /// <typeparam name="T">The expected message type</typeparam>
    /// <param name="queueName">The queue to subscribe to</param>
    /// <param name="handler">Handler function called when a message is received</param>
    /// <param name="cancellationToken">Cancellation token</param>
    /// <returns>A disposable subscription that can be used to unsubscribe</returns>
    public async Task<IDisposable> SubscribeAsync<T>(
        string queueName,
        Func<MessageReceived<T>, Task> handler,
        CancellationToken cancellationToken = default)
    {
        if (_hubConnection == null || _hubConnection.State != HubConnectionState.Connected)
        {
            await ConnectAsync(cancellationToken);
        }

        // Subscribe to the queue on the server
        await _hubConnection!.InvokeAsync("SubscribeToQueue", queueName, cancellationToken);

        // Register the handler for messages
        var subscription = _hubConnection.On<string, string, string>("MessageReceived",
            async (queue, messageType, body) =>
            {
                if (queue.Equals(queueName, StringComparison.OrdinalIgnoreCase))
                {
                    var message = new MessageReceived<T>
                    {
                        QueueName = queue,
                        MessageType = messageType,
                        Body = JsonSerializer.Deserialize<T>(body, _jsonOptions),
                        ReceivedAt = DateTime.UtcNow
                    };
                    await handler(message);
                }
            });

        // Track subscriptions for cleanup
        if (!_subscriptions.ContainsKey(queueName))
        {
            _subscriptions[queueName] = new List<IDisposable>();
        }
        _subscriptions[queueName].Add(subscription);

        return new Subscription(async () =>
        {
            subscription.Dispose();
            _subscriptions[queueName].Remove(subscription);

            if (_subscriptions[queueName].Count == 0)
            {
                await _hubConnection.InvokeAsync("UnsubscribeFromQueue", queueName);
                _subscriptions.Remove(queueName);
            }
        });
    }

    /// <summary>
    /// Gets the status of a queue
    /// </summary>
    /// <param name="queueName">The name of the queue</param>
    /// <param name="cancellationToken">Cancellation token</param>
    /// <returns>The queue status</returns>
    public async Task<QueueStatus> GetQueueStatusAsync(
        string queueName,
        CancellationToken cancellationToken = default)
    {
        EnsureConfigured();

        var response = await _httpClient!.GetAsync($"queues/{Uri.EscapeDataString(queueName)}", cancellationToken);

        if (!response.IsSuccessStatusCode)
        {
            var error = await response.Content.ReadAsStringAsync(cancellationToken);
            throw CreateException(response, error);
        }

        var responseBody = await response.Content.ReadAsStringAsync(cancellationToken);
        return JsonSerializer.Deserialize<QueueStatus>(responseBody, _jsonOptions)
            ?? throw new MessageBusException("Failed to deserialize queue status");
    }

    /// <summary>
    /// Gets a list of all queues
    /// </summary>
    /// <param name="includeSystemQueues">Include system queues</param>
    /// <param name="includeEmptyQueues">Include queues with no messages</param>
    /// <param name="cancellationToken">Cancellation token</param>
    /// <returns>List of queue statuses</returns>
    public async Task<List<QueueStatus>> GetQueuesAsync(
        bool includeSystemQueues = false,
        bool includeEmptyQueues = true,
        CancellationToken cancellationToken = default)
    {
        EnsureConfigured();

        var url = $"queues?includeSystemQueues={includeSystemQueues}&includeEmptyQueues={includeEmptyQueues}";
        var response = await _httpClient!.GetAsync(url, cancellationToken);

        if (!response.IsSuccessStatusCode)
        {
            var error = await response.Content.ReadAsStringAsync(cancellationToken);
            throw CreateException(response, error);
        }

        var responseBody = await response.Content.ReadAsStringAsync(cancellationToken);
        return JsonSerializer.Deserialize<List<QueueStatus>>(responseBody, _jsonOptions)
            ?? new List<QueueStatus>();
    }

    private void EnsureConfigured()
    {
        if (_httpClient == null)
            throw new InvalidOperationException("Client not configured. Call Configure() first.");
    }

    private static MessageBusException CreateException(HttpResponseMessage response, string error)
    {
        var statusCode = (int)response.StatusCode;

        return statusCode switch
        {
            401 => new MessageBusAuthenticationException(error),
            403 => new MessageBusAuthorizationException(error),
            404 => new MessageBusNotFoundException(error),
            _ => new MessageBusException(error, statusCode)
        };
    }

    public void Dispose()
    {
        if (_disposed) return;
        _disposed = true;

        foreach (var subscriptionList in _subscriptions.Values)
        {
            foreach (var subscription in subscriptionList)
            {
                subscription.Dispose();
            }
        }
        _subscriptions.Clear();

        _hubConnection?.DisposeAsync().AsTask().Wait();
        _httpClient?.Dispose();
    }

    /// <summary>
    /// Internal subscription class for managing unsubscription
    /// </summary>
    private class Subscription : IDisposable
    {
        private readonly Func<Task> _unsubscribe;
        private bool _disposed;

        public Subscription(Func<Task> unsubscribe)
        {
            _unsubscribe = unsubscribe;
        }

        public void Dispose()
        {
            if (_disposed) return;
            _disposed = true;
            _unsubscribe().Wait();
        }
    }
}
