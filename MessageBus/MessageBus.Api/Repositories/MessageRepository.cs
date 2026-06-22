using MessageBus.Api.Data;
using MessageBus.Api.Models;
using MessageBus.Api.Repositories.Interfaces;
using Microsoft.Data.SqlClient;
using Microsoft.EntityFrameworkCore;
using System.Data;

namespace MessageBus.Api.Repositories;

/// <summary>
/// Repository implementation for message-related operations
/// </summary>
public class MessageRepository : IMessageRepository
{
    private readonly MessageBusDbContext _context;

    public MessageRepository(MessageBusDbContext context)
    {
        _context = context;
    }

    public async Task<List<MessageInfo>> GetMessagesAsync(string queueName, int pageNumber = 1, int pageSize = 25, string? statusFilter = null, string? messageTypeFilter = null)
    {
        var parameters = new List<SqlParameter>
        {
            new SqlParameter("@QueueName", queueName),
            new SqlParameter("@PageNumber", pageNumber),
            new SqlParameter("@PageSize", pageSize),
            new SqlParameter("@StatusFilter", (object?)statusFilter ?? DBNull.Value),
            new SqlParameter("@MessageTypeFilter", (object?)messageTypeFilter ?? DBNull.Value)
        };

        return await _context.Set<MessageInfo>()
            .FromSqlRaw("EXEC dbo.usp_PeekMessages @QueueName, @PageNumber, @PageSize, @StatusFilter, @MessageTypeFilter",
                parameters.ToArray())
            .ToListAsync();
    }

    public async Task<SendMessageResult> SendMessageAsync(
        string initiatorService,
        string targetService,
        string contractName,
        string messageTypeName,
        string messageBody,
        int priority = 5,
        Guid? dialogHandle = null,
        Guid? conversationGroup = null,
        int dialogLifetimeSeconds = 3600,
        bool useExistingDialog = false,
        string? applicationName = null)
    {
        var parameters = new List<SqlParameter>
        {
            new SqlParameter("@InitiatorService", initiatorService),
            new SqlParameter("@TargetService", targetService),
            new SqlParameter("@ContractName", contractName),
            new SqlParameter("@MessageTypeName", messageTypeName),
            new SqlParameter("@MessageBody", messageBody),
            new SqlParameter("@Priority", priority),
            new SqlParameter("@DialogHandle", (object?)dialogHandle ?? DBNull.Value) { Direction = ParameterDirection.InputOutput },
            new SqlParameter("@ConversationGroup", (object?)conversationGroup ?? DBNull.Value),
            new SqlParameter("@DialogLifetime", dialogLifetimeSeconds),
            new SqlParameter("@UseExistingDialog", useExistingDialog),
            new SqlParameter("@ApplicationName", (object?)applicationName ?? DBNull.Value)
        };

        var result = await _context.Set<SendMessageResult>()
            .FromSqlRaw(@"EXEC dbo.usp_SendMessage
                @InitiatorService, @TargetService, @ContractName, @MessageTypeName, @MessageBody,
                @Priority, @DialogHandle OUTPUT, @ConversationGroup, @DialogLifetime, @UseExistingDialog, @ApplicationName",
                parameters.ToArray())
            .ToListAsync();

        return result.FirstOrDefault() ?? new SendMessageResult { Status = "No result returned" };
    }

    public async Task<ReceiveMessageResult> ReceiveMessageAsync(string queueName, int timeoutMs = 5000, string? applicationName = null)
    {
        var parameters = new List<SqlParameter>
        {
            new SqlParameter("@QueueName", queueName),
            new SqlParameter("@TimeoutMs", timeoutMs),
            new SqlParameter("@MaxMessages", 1),
            new SqlParameter("@ConversationHandle", SqlDbType.UniqueIdentifier) { Direction = ParameterDirection.Output },
            new SqlParameter("@MessageTypeName", SqlDbType.NVarChar, 256) { Direction = ParameterDirection.Output },
            new SqlParameter("@MessageBody", SqlDbType.NVarChar, -1) { Direction = ParameterDirection.Output },
            new SqlParameter("@ApplicationName", (object?)applicationName ?? DBNull.Value)
        };

        var result = await _context.Set<ReceiveMessageResult>()
            .FromSqlRaw("EXEC dbo.usp_ReceiveMessage @QueueName, @TimeoutMs, @MaxMessages, @ConversationHandle OUTPUT, @MessageTypeName OUTPUT, @MessageBody OUTPUT, @ApplicationName",
                parameters.ToArray())
            .ToListAsync();

        return result.FirstOrDefault() ?? new ReceiveMessageResult { MessageReceived = false };
    }
}
