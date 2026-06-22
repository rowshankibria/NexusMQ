using MessageBus.Api.Hubs;
using MessageBus.Api.Services.Interfaces;
using Microsoft.AspNetCore.SignalR;

namespace MessageBus.Api.BackgroundServices;

/// <summary>
/// Background service that collects queue depth and throughput metrics every minute
/// </summary>
public class MetricsCollectionService : BackgroundService
{
    private readonly IServiceProvider _serviceProvider;
    private readonly IHubContext<MessageBusHub> _hubContext;
    private readonly ILogger<MetricsCollectionService> _logger;
    private readonly TimeSpan _collectionInterval = TimeSpan.FromMinutes(1);

    // In-memory metrics storage (could be replaced with time-series database)
    private readonly List<QueueMetricSnapshot> _queueMetrics = new();
    private readonly List<ThroughputMetric> _throughputMetrics = new();
    private readonly object _metricsLock = new();
    private const int MaxMetricRetentionMinutes = 60;

    public MetricsCollectionService(
        IServiceProvider serviceProvider,
        IHubContext<MessageBusHub> hubContext,
        ILogger<MetricsCollectionService> logger)
    {
        _serviceProvider = serviceProvider;
        _hubContext = hubContext;
        _logger = logger;
    }

    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        _logger.LogInformation("Metrics Collection Service starting. Collection interval: {Interval}s",
            _collectionInterval.TotalSeconds);

        // Initial delay to let the application start up
        await Task.Delay(TimeSpan.FromSeconds(15), stoppingToken);

        while (!stoppingToken.IsCancellationRequested)
        {
            try
            {
                await CollectMetricsAsync(stoppingToken);
            }
            catch (OperationCanceledException) when (stoppingToken.IsCancellationRequested)
            {
                break;
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error during metrics collection cycle");
            }

            try
            {
                await Task.Delay(_collectionInterval, stoppingToken);
            }
            catch (OperationCanceledException) when (stoppingToken.IsCancellationRequested)
            {
                break;
            }
        }

        _logger.LogInformation("Metrics Collection Service stopped");
    }

    private async Task CollectMetricsAsync(CancellationToken stoppingToken)
    {
        _logger.LogDebug("Collecting metrics");

        using var scope = _serviceProvider.CreateScope();
        var queueService = scope.ServiceProvider.GetRequiredService<IQueueService>();
        var diagnosticsService = scope.ServiceProvider.GetRequiredService<IDiagnosticsService>();

        var timestamp = DateTime.UtcNow;

        // Collect queue metrics
        var queues = await queueService.GetAllQueuesAsync(includeSystemQueues: false);
        var queueSnapshots = new List<QueueMetricSnapshot>();

        foreach (var queue in queues)
        {
            var snapshot = new QueueMetricSnapshot
            {
                Timestamp = timestamp,
                QueueName = queue.QueueName,
                MessageCount = queue.MessageCount,
                ReadyCount = queue.ReadyCount,
                OldestMessageAgeSeconds = queue.OldestMessageAgeSeconds,
                ActiveConversations = queue.ActiveConversations,
                ErrorConversations = queue.ErrorConversations,
                IsReceiveEnabled = queue.IsReceiveEnabled,
                IsActivationEnabled = queue.IsActivationEnabled
            };

            queueSnapshots.Add(snapshot);
        }

        // Collect transmission queue metrics
        var transmissionSummary = await diagnosticsService.GetTransmissionQueueSummaryAsync();

        // Calculate throughput (messages processed since last collection)
        var throughput = CalculateThroughput(queueSnapshots);

        // Store metrics
        lock (_metricsLock)
        {
            _queueMetrics.AddRange(queueSnapshots);
            if (throughput != null)
            {
                _throughputMetrics.Add(throughput);
            }

            // Clean up old metrics
            var cutoff = DateTime.UtcNow.AddMinutes(-MaxMetricRetentionMinutes);
            _queueMetrics.RemoveAll(m => m.Timestamp < cutoff);
            _throughputMetrics.RemoveAll(m => m.Timestamp < cutoff);
        }

        // Broadcast metrics to connected clients
        await BroadcastMetricsAsync(queueSnapshots, throughput, transmissionSummary);

        _logger.LogDebug("Metrics collected. Queues: {QueueCount}, Total messages: {MessageCount}",
            queueSnapshots.Count, queueSnapshots.Sum(q => q.MessageCount));
    }

    private ThroughputMetric? CalculateThroughput(List<QueueMetricSnapshot> currentSnapshots)
    {
        lock (_metricsLock)
        {
            if (!_queueMetrics.Any())
            {
                return null;
            }

            // Get the most recent previous snapshot for each queue
            var previousSnapshots = _queueMetrics
                .GroupBy(m => m.QueueName)
                .Select(g => g.OrderByDescending(m => m.Timestamp).First())
                .ToDictionary(m => m.QueueName);

            var throughput = new ThroughputMetric
            {
                Timestamp = DateTime.UtcNow,
                IntervalSeconds = (int)_collectionInterval.TotalSeconds
            };

            foreach (var current in currentSnapshots)
            {
                if (previousSnapshots.TryGetValue(current.QueueName, out var previous))
                {
                    // Calculate messages processed (negative change in message count = messages processed)
                    var messagesDelta = previous.MessageCount - current.MessageCount;
                    if (messagesDelta > 0)
                    {
                        throughput.MessagesProcessed += messagesDelta;
                    }

                    // Track new messages added
                    if (messagesDelta < 0)
                    {
                        throughput.MessagesReceived += Math.Abs(messagesDelta);
                    }
                }
            }

            throughput.MessagesPerSecond = throughput.MessagesProcessed / (decimal)throughput.IntervalSeconds;

            return throughput;
        }
    }

    private async Task BroadcastMetricsAsync(
        List<QueueMetricSnapshot> queueSnapshots,
        ThroughputMetric? throughput,
        Models.TransmissionQueueSummary? transmissionSummary)
    {
        try
        {
            // Broadcast to dashboard subscribers
            await _hubContext.Clients.Group("dashboard").SendAsync("MetricsUpdate", new
            {
                Timestamp = DateTime.UtcNow,
                Queues = queueSnapshots.Select(q => new
                {
                    q.QueueName,
                    q.MessageCount,
                    q.ReadyCount,
                    q.OldestMessageAgeSeconds,
                    q.ActiveConversations,
                    q.ErrorConversations,
                    q.IsReceiveEnabled,
                    q.IsActivationEnabled
                }).ToList(),
                Throughput = throughput != null ? new
                {
                    throughput.MessagesProcessed,
                    throughput.MessagesReceived,
                    throughput.MessagesPerSecond,
                    throughput.IntervalSeconds
                } : null,
                TransmissionQueue = transmissionSummary != null ? new
                {
                    transmissionSummary.TotalMessages,
                    transmissionSummary.StuckOver5Min,
                    transmissionSummary.StuckOver30Min,
                    transmissionSummary.WithErrors
                } : null,
                Summary = new
                {
                    TotalQueues = queueSnapshots.Count,
                    TotalMessages = queueSnapshots.Sum(q => q.MessageCount),
                    ActiveQueues = queueSnapshots.Count(q => q.IsReceiveEnabled),
                    QueuesWithErrors = queueSnapshots.Count(q => q.ErrorConversations > 0)
                }
            });

            // Also broadcast individual queue updates
            foreach (var queue in queueSnapshots)
            {
                await _hubContext.Clients.Group($"queue:{queue.QueueName}").SendAsync("QueueMetricsUpdate", new
                {
                    queue.Timestamp,
                    queue.QueueName,
                    queue.MessageCount,
                    queue.ReadyCount,
                    queue.OldestMessageAgeSeconds,
                    queue.ActiveConversations,
                    queue.ErrorConversations,
                    queue.IsReceiveEnabled,
                    queue.IsActivationEnabled
                });
            }
        }
        catch (Exception ex)
        {
            _logger.LogWarning(ex, "Failed to broadcast metrics via SignalR");
        }
    }

    /// <summary>
    /// Gets the recent metrics for a specific queue
    /// </summary>
    public List<QueueMetricSnapshot> GetQueueMetrics(string queueName, int minutes = 60)
    {
        var cutoff = DateTime.UtcNow.AddMinutes(-minutes);
        lock (_metricsLock)
        {
            return _queueMetrics
                .Where(m => m.QueueName == queueName && m.Timestamp >= cutoff)
                .OrderBy(m => m.Timestamp)
                .ToList();
        }
    }

    /// <summary>
    /// Gets the recent throughput metrics
    /// </summary>
    public List<ThroughputMetric> GetThroughputMetrics(int minutes = 60)
    {
        var cutoff = DateTime.UtcNow.AddMinutes(-minutes);
        lock (_metricsLock)
        {
            return _throughputMetrics
                .Where(m => m.Timestamp >= cutoff)
                .OrderBy(m => m.Timestamp)
                .ToList();
        }
    }

    public override async Task StopAsync(CancellationToken cancellationToken)
    {
        _logger.LogInformation("Metrics Collection Service is stopping");
        await base.StopAsync(cancellationToken);
    }
}

/// <summary>
/// Snapshot of queue metrics at a point in time
/// </summary>
public class QueueMetricSnapshot
{
    public DateTime Timestamp { get; set; }
    public string QueueName { get; set; } = string.Empty;
    public int MessageCount { get; set; }
    public int ReadyCount { get; set; }
    public int? OldestMessageAgeSeconds { get; set; }
    public int ActiveConversations { get; set; }
    public int ErrorConversations { get; set; }
    public bool IsReceiveEnabled { get; set; }
    public bool IsActivationEnabled { get; set; }
}

/// <summary>
/// Throughput metric calculated between collection intervals
/// </summary>
public class ThroughputMetric
{
    public DateTime Timestamp { get; set; }
    public int IntervalSeconds { get; set; }
    public int MessagesProcessed { get; set; }
    public int MessagesReceived { get; set; }
    public decimal MessagesPerSecond { get; set; }
}
