using System.Diagnostics;
using MessageBus.Api.Models;
using MessageBus.Api.Repositories.Interfaces;
using MessageBus.Api.Services.Interfaces;
using Microsoft.Extensions.Logging;

namespace MessageBus.Api.Services;

/// <summary>
/// Service implementation for message-related business operations
/// </summary>
public class MessageService : IMessageService
{
    private readonly IMessageRepository _messageRepository;
    private readonly IServiceRepository _serviceRepository;
    private readonly ILogger<MessageService> _logger;

    public MessageService(
        IMessageRepository messageRepository,
        IServiceRepository serviceRepository,
        ILogger<MessageService> logger)
    {
        _messageRepository = messageRepository;
        _serviceRepository = serviceRepository;
        _logger = logger;
    }

    public async Task<List<MessageInfo>> GetMessagesAsync(string queueName, int pageNumber = 1, int pageSize = 25, string? statusFilter = null, string? messageTypeFilter = null)
    {
        if (string.IsNullOrWhiteSpace(queueName))
        {
            _logger.LogWarning("GetMessages called with empty queue name");
            return new List<MessageInfo>();
        }

        _logger.LogDebug("Getting messages from queue: {QueueName}, Page: {PageNumber}, Size: {PageSize}",
            queueName, pageNumber, pageSize);

        return await _messageRepository.GetMessagesAsync(queueName, pageNumber, pageSize, statusFilter, messageTypeFilter);
    }

    public async Task<ServiceResult<SendMessageResult>> SendMessageAsync(SendMessageRequest request)
    {
        // Validate request
        var validationErrors = ValidateSendMessageRequest(request);
        if (validationErrors.Count > 0)
        {
            return ServiceResult<SendMessageResult>.Fail("Validation failed", validationErrors);
        }

        _logger.LogInformation("Sending message from {InitiatorService} to {TargetService}, Type: {MessageType}",
            request.InitiatorService, request.TargetService, request.MessageTypeName);

        try
        {
            // Validate target service exists
            var serviceValidation = await ValidateServiceAsync(request.TargetService);
            if (!serviceValidation.Success)
            {
                return ServiceResult<SendMessageResult>.Fail(serviceValidation.Message, serviceValidation.Errors);
            }

            // Validate message type exists in contract
            var messageTypeValidation = await ValidateMessageTypeAsync(request.ContractName, request.MessageTypeName);
            if (!messageTypeValidation.Success)
            {
                return ServiceResult<SendMessageResult>.Fail(messageTypeValidation.Message, messageTypeValidation.Errors);
            }

            var result = await _messageRepository.SendMessageAsync(
                request.InitiatorService,
                request.TargetService,
                request.ContractName,
                request.MessageTypeName,
                request.MessageBody,
                request.Priority,
                request.DialogHandle,
                request.ConversationGroup,
                request.DialogLifetimeSeconds,
                request.UseExistingDialog,
                request.ApplicationName);

            _logger.LogInformation("Message sent successfully. DialogHandle: {DialogHandle}",
                result.DialogHandle);

            return ServiceResult<SendMessageResult>.Ok(result, "Message sent successfully");
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error sending message from {InitiatorService} to {TargetService}",
                request.InitiatorService, request.TargetService);
            return ServiceResult<SendMessageResult>.Fail($"Failed to send message: {ex.Message}");
        }
    }

    public async Task<ServiceResult<BulkSendResult>> BulkSendAsync(SendMessageRequest request, int count)
    {
        if (count <= 0)
        {
            return ServiceResult<BulkSendResult>.Fail("Count must be greater than 0");
        }

        if (count > 1000)
        {
            return ServiceResult<BulkSendResult>.Fail("Count cannot exceed 1000 for bulk operations");
        }

        _logger.LogInformation("Starting bulk send: {Count} messages from {InitiatorService} to {TargetService}",
            count, request.InitiatorService, request.TargetService);

        var stopwatch = Stopwatch.StartNew();
        var result = new BulkSendResult
        {
            Requested = count
        };

        // Validate once before bulk operation
        var serviceValidation = await ValidateServiceAsync(request.TargetService);
        if (!serviceValidation.Success)
        {
            return ServiceResult<BulkSendResult>.Fail(serviceValidation.Message, serviceValidation.Errors);
        }

        var messageTypeValidation = await ValidateMessageTypeAsync(request.ContractName, request.MessageTypeName);
        if (!messageTypeValidation.Success)
        {
            return ServiceResult<BulkSendResult>.Fail(messageTypeValidation.Message, messageTypeValidation.Errors);
        }

        for (int i = 0; i < count; i++)
        {
            try
            {
                var sendResult = await _messageRepository.SendMessageAsync(
                    request.InitiatorService,
                    request.TargetService,
                    request.ContractName,
                    request.MessageTypeName,
                    request.MessageBody,
                    request.Priority,
                    null, // New dialog for each message
                    request.ConversationGroup,
                    request.DialogLifetimeSeconds,
                    false,
                    request.ApplicationName);

                result.Results.Add(sendResult);
                result.Succeeded++;
            }
            catch (Exception ex)
            {
                result.Failed++;
                result.Errors.Add($"Message {i + 1}: {ex.Message}");
                _logger.LogWarning(ex, "Failed to send message {Index} of {Total} in bulk operation",
                    i + 1, count);
            }
        }

        stopwatch.Stop();
        result.Duration = stopwatch.Elapsed;

        _logger.LogInformation("Bulk send completed. Succeeded: {Succeeded}, Failed: {Failed}, Duration: {Duration}ms",
            result.Succeeded, result.Failed, stopwatch.ElapsedMilliseconds);

        var message = result.Failed == 0
            ? $"Successfully sent {result.Succeeded} messages"
            : $"Completed with {result.Succeeded} successes and {result.Failed} failures";

        return ServiceResult<BulkSendResult>.Ok(result, message);
    }

    public async Task<ServiceResult> ValidateMessageTypeAsync(string contractName, string messageTypeName)
    {
        if (string.IsNullOrWhiteSpace(contractName))
        {
            return ServiceResult.Fail("Contract name is required");
        }

        if (string.IsNullOrWhiteSpace(messageTypeName))
        {
            return ServiceResult.Fail("Message type name is required");
        }

        try
        {
            var messageTypes = await _serviceRepository.GetMessageTypesAsync();
            var messageType = messageTypes.FirstOrDefault(mt =>
                mt.MessageTypeName.Equals(messageTypeName, StringComparison.OrdinalIgnoreCase));

            if (messageType == null)
            {
                _logger.LogWarning("Message type not found: {MessageTypeName}", messageTypeName);
                return ServiceResult.Fail($"Message type '{messageTypeName}' not found");
            }

            return ServiceResult.Ok($"Message type '{messageTypeName}' is valid");
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error validating message type: {MessageTypeName}", messageTypeName);
            return ServiceResult.Fail($"Error validating message type: {ex.Message}");
        }
    }

    public async Task<ServiceResult> ValidateServiceAsync(string serviceName)
    {
        if (string.IsNullOrWhiteSpace(serviceName))
        {
            return ServiceResult.Fail("Service name is required");
        }

        try
        {
            var services = await _serviceRepository.GetAllServicesAsync();
            var service = services.FirstOrDefault(s =>
                s.ServiceName.Equals(serviceName, StringComparison.OrdinalIgnoreCase));

            if (service == null)
            {
                _logger.LogWarning("Service not found: {ServiceName}", serviceName);
                return ServiceResult.Fail($"Service '{serviceName}' not found");
            }

            return ServiceResult.Ok($"Service '{serviceName}' is valid");
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error validating service: {ServiceName}", serviceName);
            return ServiceResult.Fail($"Error validating service: {ex.Message}");
        }
    }

    public async Task<ServiceResult<ReceiveMessageResult>> ReceiveMessageAsync(string queueName, int timeoutMs = 5000, string? applicationName = null)
    {
        if (string.IsNullOrWhiteSpace(queueName))
        {
            return ServiceResult<ReceiveMessageResult>.Fail("Queue name is required");
        }

        _logger.LogDebug("Receiving message from queue: {QueueName}, Timeout: {TimeoutMs}ms",
            queueName, timeoutMs);

        try
        {
            var result = await _messageRepository.ReceiveMessageAsync(queueName, timeoutMs, applicationName);

            if (result.ConversationHandle == Guid.Empty)
            {
                _logger.LogDebug("No message received from queue: {QueueName}", queueName);
                return ServiceResult<ReceiveMessageResult>.Ok(result, "No message available");
            }

            _logger.LogDebug("Message received from queue: {QueueName}, Type: {MessageType}",
                queueName, result.MessageTypeName);

            return ServiceResult<ReceiveMessageResult>.Ok(result, "Message received successfully");
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error receiving message from queue: {QueueName}", queueName);
            return ServiceResult<ReceiveMessageResult>.Fail($"Failed to receive message: {ex.Message}");
        }
    }

    private static List<string> ValidateSendMessageRequest(SendMessageRequest request)
    {
        var errors = new List<string>();

        if (string.IsNullOrWhiteSpace(request.InitiatorService))
            errors.Add("Initiator service is required");

        if (string.IsNullOrWhiteSpace(request.TargetService))
            errors.Add("Target service is required");

        if (string.IsNullOrWhiteSpace(request.ContractName))
            errors.Add("Contract name is required");

        if (string.IsNullOrWhiteSpace(request.MessageTypeName))
            errors.Add("Message type name is required");

        if (string.IsNullOrWhiteSpace(request.MessageBody))
            errors.Add("Message body is required");

        if (request.Priority < 1 || request.Priority > 10)
            errors.Add("Priority must be between 1 and 10");

        if (request.DialogLifetimeSeconds < 60)
            errors.Add("Dialog lifetime must be at least 60 seconds");

        return errors;
    }
}
