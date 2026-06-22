using MessageBus.Api.Repositories.Interfaces;
using MessageBus.Api.Services.Interfaces;
using Microsoft.Data.SqlClient;
using System.Data;

namespace MessageBus.Api.Repositories;

/// <summary>
/// Repository for health check database operations calling usp_RunHealthCheck
/// </summary>
public class HealthRepository : IHealthRepository
{
    private readonly SqlConnection _connection;
    private readonly ILogger<HealthRepository> _logger;

    public HealthRepository(SqlConnection connection, ILogger<HealthRepository> logger)
    {
        _connection = connection;
        _logger = logger;
    }

    public async Task<HealthCheckResult> RunHealthCheckAsync()
    {
        var result = new HealthCheckResult();

        try
        {
            await _connection.OpenAsync();

            using var command = new SqlCommand("dbo.usp_RunHealthCheck", _connection)
            {
                CommandType = CommandType.StoredProcedure
            };

            using var reader = await command.ExecuteReaderAsync();

            // Result Set 1: Service Broker Database Status
            if (await reader.ReadAsync())
            {
                result.BrokerStatus = new BrokerStatus
                {
                    DatabaseName = reader.GetString(reader.GetOrdinal("DatabaseName")),
                    BrokerGuid = reader.GetString(reader.GetOrdinal("BrokerGuid")),
                    Status = reader.GetString(reader.GetOrdinal("BrokerStatus")),
                    StatusLevel = reader.GetString(reader.GetOrdinal("StatusLevel")),
                    ServerName = reader.GetString(reader.GetOrdinal("ServerName"))
                };
            }

            // Result Set 2: Queue Health Summary
            if (await reader.NextResultAsync())
            {
                while (await reader.ReadAsync())
                {
                    result.QueueHealth.Add(new QueueHealth
                    {
                        QueueName = reader.GetString(reader.GetOrdinal("QueueName")),
                        IsReceiveEnabled = reader.GetBoolean(reader.GetOrdinal("is_receive_enabled")),
                        IsActivationEnabled = reader.GetBoolean(reader.GetOrdinal("is_activation_enabled")),
                        ReceiveStatus = reader.GetString(reader.GetOrdinal("ReceiveStatus")),
                        StatusLevel = reader.GetString(reader.GetOrdinal("StatusLevel")),
                        ApproxMessageCount = reader.IsDBNull(reader.GetOrdinal("ApproxMessageCount"))
                            ? 0
                            : reader.GetInt64(reader.GetOrdinal("ApproxMessageCount"))
                    });
                }
            }

            // Skip to Result Set 10: Overall Health Summary
            // Result sets 3-9 can be processed in future phases
            for (int i = 0; i < 7; i++)
            {
                await reader.NextResultAsync();
            }

            // Result Set 10: Overall Health Summary
            if (await reader.NextResultAsync() && await reader.ReadAsync())
            {
                result.OverallStatus = reader.GetString(reader.GetOrdinal("OverallHealthStatus"));
                result.CriticalIssues = reader.GetInt32(reader.GetOrdinal("CriticalIssues"));
                result.Warnings = reader.GetInt32(reader.GetOrdinal("Warnings"));
                result.CheckTimestamp = reader.GetDateTime(reader.GetOrdinal("CheckTimestamp"));
                result.Recommendation = reader.GetString(reader.GetOrdinal("Recommendation"));
            }

            return result;
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error running health check");
            throw;
        }
        finally
        {
            if (_connection.State == ConnectionState.Open)
            {
                await _connection.CloseAsync();
            }
        }
    }
}
