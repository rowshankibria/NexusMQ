using MessageBus.Api.Hubs;
using MessageBus.Api.Services.Interfaces;
using Microsoft.AspNetCore.SignalR;

namespace MessageBus.Api.BackgroundServices;

/// <summary>
/// Background service that runs periodic health checks every 30 seconds
/// </summary>
public class HealthMonitorService : BackgroundService
{
    private readonly IServiceProvider _serviceProvider;
    private readonly IHubContext<MessageBusHub> _hubContext;
    private readonly ILogger<HealthMonitorService> _logger;
    private readonly TimeSpan _checkInterval = TimeSpan.FromSeconds(30);

    public HealthMonitorService(
        IServiceProvider serviceProvider,
        IHubContext<MessageBusHub> hubContext,
        ILogger<HealthMonitorService> logger)
    {
        _serviceProvider = serviceProvider;
        _hubContext = hubContext;
        _logger = logger;
    }

    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        _logger.LogInformation("Health Monitor Service starting. Check interval: {Interval}s", _checkInterval.TotalSeconds);

        // Initial delay to let the application start up
        await Task.Delay(TimeSpan.FromSeconds(10), stoppingToken);

        while (!stoppingToken.IsCancellationRequested)
        {
            try
            {
                await RunHealthCheckAsync(stoppingToken);
            }
            catch (OperationCanceledException) when (stoppingToken.IsCancellationRequested)
            {
                // Service is stopping, exit gracefully
                break;
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error during health check cycle");
            }

            try
            {
                await Task.Delay(_checkInterval, stoppingToken);
            }
            catch (OperationCanceledException) when (stoppingToken.IsCancellationRequested)
            {
                break;
            }
        }

        _logger.LogInformation("Health Monitor Service stopped");
    }

    private async Task RunHealthCheckAsync(CancellationToken stoppingToken)
    {
        _logger.LogDebug("Running periodic health check");

        using var scope = _serviceProvider.CreateScope();
        var diagnosticsService = scope.ServiceProvider.GetRequiredService<IDiagnosticsService>();
        var alertService = scope.ServiceProvider.GetRequiredService<IAlertService>();

        // Run health checks
        var systemStatus = await diagnosticsService.GetSystemStatusAsync();

        // Evaluate alert rules
        var alertEvaluations = await alertService.EvaluateAlertsAsync();
        var triggeredAlerts = alertEvaluations.Where(e => e.IsTriggered).ToList();

        // Broadcast to connected clients via SignalR
        await BroadcastHealthStatusAsync(systemStatus, triggeredAlerts);

        _logger.LogDebug("Health check completed. Status: {Status}, Triggered alerts: {AlertCount}",
            systemStatus.Status, triggeredAlerts.Count);
    }

    private async Task BroadcastHealthStatusAsync(SystemStatus systemStatus, List<AlertEvaluation> triggeredAlerts)
    {
        try
        {
            // Broadcast to dashboard subscribers
            await _hubContext.Clients.Group("dashboard").SendAsync("HealthStatusUpdate", new
            {
                Timestamp = DateTime.UtcNow,
                Status = systemStatus.Status.ToString(),
                systemStatus.Description,
                Broker = new
                {
                    systemStatus.Broker.IsEnabled,
                    Status = systemStatus.Broker.Status.ToString()
                },
                Queues = new
                {
                    systemStatus.Queues.TotalQueues,
                    systemStatus.Queues.ActiveQueues,
                    systemStatus.Queues.PausedQueues,
                    systemStatus.Queues.TotalMessages,
                    Status = systemStatus.Queues.Status.ToString()
                },
                Conversations = new
                {
                    systemStatus.Conversations.TotalActive,
                    systemStatus.Conversations.InError,
                    systemStatus.Conversations.Orphaned,
                    Status = systemStatus.Conversations.Status.ToString()
                },
                Transmission = new
                {
                    systemStatus.Transmission.TotalMessages,
                    systemStatus.Transmission.StuckMessages,
                    Status = systemStatus.Transmission.Status.ToString()
                },
                TriggeredAlerts = triggeredAlerts.Select(a => new
                {
                    a.Rule.Name,
                    Severity = a.Rule.Severity.ToString(),
                    a.Message,
                    a.CurrentValue,
                    a.AffectedResource
                }).ToList()
            });
        }
        catch (Exception ex)
        {
            _logger.LogWarning(ex, "Failed to broadcast health status via SignalR");
        }
    }

    public override async Task StopAsync(CancellationToken cancellationToken)
    {
        _logger.LogInformation("Health Monitor Service is stopping");
        await base.StopAsync(cancellationToken);
    }
}
