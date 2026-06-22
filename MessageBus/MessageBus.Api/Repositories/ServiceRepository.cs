using MessageBus.Api.Data;
using MessageBus.Api.Models;
using MessageBus.Api.Repositories.Interfaces;
using Microsoft.Data.SqlClient;
using Microsoft.EntityFrameworkCore;

namespace MessageBus.Api.Repositories;

/// <summary>
/// Repository implementation for Service Broker service-related operations
/// </summary>
public class ServiceRepository : IServiceRepository
{
    private readonly MessageBusDbContext _context;

    public ServiceRepository(MessageBusDbContext context)
    {
        _context = context;
    }

    public async Task<List<ServiceInfo>> GetAllServicesAsync()
    {
        return await _context.Set<ServiceInfo>()
            .FromSqlRaw(@"
                SELECT
                    s.name AS ServiceName,
                    s.service_id AS ServiceId,
                    s.service_queue_id AS ServiceQueueId,
                    q.name AS QueueName,
                    s.principal_id AS PrincipalId
                FROM sys.services s
                LEFT JOIN sys.service_queues q ON s.service_queue_id = q.object_id
                WHERE s.is_ms_shipped = 0
                ORDER BY s.name")
            .ToListAsync();
    }

    public async Task<List<ContractInfo>> GetContractsForServiceAsync(string serviceName)
    {
        var param = new SqlParameter("@ServiceName", serviceName);

        return await _context.Set<ContractInfo>()
            .FromSqlRaw(@"
                SELECT
                    c.name AS ContractName,
                    c.service_contract_id AS ContractId,
                    mt.name AS MessageTypeName,
                    cmu.is_sent_by_initiator AS IsSentByInitiator,
                    cmu.is_sent_by_target AS IsSentByTarget
                FROM sys.services s
                INNER JOIN sys.service_contract_usages scu ON s.service_id = scu.service_id
                INNER JOIN sys.service_contracts c ON scu.service_contract_id = c.service_contract_id
                LEFT JOIN sys.service_contract_message_usages cmu ON c.service_contract_id = cmu.service_contract_id
                LEFT JOIN sys.service_message_types mt ON cmu.message_type_id = mt.message_type_id
                WHERE s.name = @ServiceName
                ORDER BY c.name, mt.name", param)
            .ToListAsync();
    }

    public async Task<List<MessageTypeInfo>> GetMessageTypesAsync()
    {
        return await _context.Set<MessageTypeInfo>()
            .FromSqlRaw(@"
                SELECT
                    mt.name AS MessageTypeName,
                    mt.message_type_id AS MessageTypeId,
                    mt.validation AS Validation,
                    mt.validation_desc AS ValidationDesc
                FROM sys.service_message_types mt
                WHERE mt.is_ms_shipped = 0
                ORDER BY mt.name")
            .ToListAsync();
    }
}
