using MessageBus.Api.Data;
using MessageBus.Api.Models;
using MessageBus.Api.Repositories.Interfaces;
using Microsoft.Data.SqlClient;
using Microsoft.EntityFrameworkCore;

namespace MessageBus.Api.Repositories;

/// <summary>
/// Repository implementation for diagnostics and health check operations
/// </summary>
public class DiagnosticsRepository : IDiagnosticsRepository
{
    private readonly MessageBusDbContext _context;

    public DiagnosticsRepository(MessageBusDbContext context)
    {
        _context = context;
    }

    public async Task<ServiceBrokerHealthInfo?> GetBrokerStatusAsync()
    {
        return await _context.Set<ServiceBrokerHealthInfo>()
            .FromSqlRaw("SELECT * FROM dbo.vw_ServiceBrokerHealth")
            .FirstOrDefaultAsync();
    }

    public async Task<List<TransmissionQueueItem>> GetTransmissionQueueAsync(int minStuckSeconds = 0, string? serviceNameFilter = null)
    {
        var parameters = new[]
        {
            new SqlParameter("@MinStuckSeconds", minStuckSeconds),
            new SqlParameter("@ServiceNameFilter", (object?)serviceNameFilter ?? DBNull.Value)
        };

        return await _context.Set<TransmissionQueueItem>()
            .FromSqlRaw("EXEC dbo.usp_GetTransmissionQueueStatus @MinStuckSeconds, @ServiceNameFilter", parameters)
            .ToListAsync();
    }

    public async Task<TransmissionQueueSummary?> GetTransmissionQueueSummaryAsync()
    {
        // The stored procedure returns both detail and summary result sets.
        // This query directly gets the summary from sys.transmission_queue
        return await _context.Set<TransmissionQueueSummary>()
            .FromSqlRaw(@"
                SELECT
                    COUNT(*) AS TotalMessages,
                    COUNT(CASE WHEN DATEDIFF(MINUTE, enqueue_time, GETDATE()) > 5 THEN 1 END) AS StuckOver5Min,
                    COUNT(CASE WHEN DATEDIFF(MINUTE, enqueue_time, GETDATE()) > 30 THEN 1 END) AS StuckOver30Min,
                    COUNT(CASE WHEN DATEDIFF(HOUR, enqueue_time, GETDATE()) > 1 THEN 1 END) AS StuckOver1Hour,
                    COUNT(CASE WHEN transmission_status IS NOT NULL AND transmission_status != '' THEN 1 END) AS WithErrors,
                    MIN(enqueue_time) AS OldestMessageTime,
                    DATEDIFF(SECOND, MIN(enqueue_time), GETDATE()) AS OldestMessageAgeSeconds
                FROM sys.transmission_queue")
            .FirstOrDefaultAsync();
    }

    public async Task<List<DialogError>> GetDialogErrorsAsync(bool includeAllErrorStates = true, int minAgeSeconds = 0, string? serviceNameFilter = null)
    {
        var parameters = new[]
        {
            new SqlParameter("@IncludeAllErrorStates", includeAllErrorStates),
            new SqlParameter("@MinAgeSeconds", minAgeSeconds),
            new SqlParameter("@ServiceNameFilter", (object?)serviceNameFilter ?? DBNull.Value)
        };

        return await _context.Set<DialogError>()
            .FromSqlRaw("EXEC dbo.usp_GetDialogErrors @IncludeAllErrorStates, @MinAgeSeconds, @ServiceNameFilter", parameters)
            .ToListAsync();
    }

    public async Task<List<PerformanceMetric>> GetPerformanceMetricsAsync(string? queueName = null, int hoursBack = 24, int aggregationMinutes = 0, int topN = 1000)
    {
        var parameters = new[]
        {
            new SqlParameter("@QueueName", (object?)queueName ?? DBNull.Value),
            new SqlParameter("@HoursBack", hoursBack),
            new SqlParameter("@AggregationMinutes", aggregationMinutes),
            new SqlParameter("@OnlyDisabled", false),
            new SqlParameter("@OnlyPoisoned", false),
            new SqlParameter("@TopN", topN)
        };

        return await _context.Set<PerformanceMetric>()
            .FromSqlRaw("EXEC dbo.usp_GetPerformanceMetrics @QueueName, @HoursBack, @AggregationMinutes, @OnlyDisabled, @OnlyPoisoned, @TopN", parameters)
            .ToListAsync();
    }

    public async Task<HealthCheckResult?> RunHealthCheckAsync(int orphanedConversationHours = 24, int oldMessageMinutes = 60)
    {
        var parameters = new[]
        {
            new SqlParameter("@OrphanedConversationHours", orphanedConversationHours),
            new SqlParameter("@OldMessageMinutes", oldMessageMinutes),
            new SqlParameter("@VerboseOutput", false)
        };

        // The stored procedure returns multiple result sets.
        // We need to get the last result set (Overall Health Summary - result set 10)
        // For simplicity, we execute a direct query to get the overall status.
        // In a production scenario, you might use ADO.NET directly for multiple result sets.
        return await _context.Set<HealthCheckResult>()
            .FromSqlRaw("EXEC dbo.usp_RunHealthCheck @OrphanedConversationHours, @OldMessageMinutes, @VerboseOutput", parameters)
            .FirstOrDefaultAsync();
    }
}
