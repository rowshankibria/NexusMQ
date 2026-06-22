/*
================================================================================
Script: 26-usp_RetryPoisonMessage.sql
Purpose: Retry a poison message from the DeadLetterQueue
Phase: 0.5C - Management Stored Procedures
================================================================================
Prerequisites:
  - Phase 0 scripts (00-07) must be run first
  - Phase 0.5A scripts (10-14) must be run first
  - Phase 0.5B scripts (20-24) must be run first
================================================================================
This procedure retries a message that was previously moved to the dead letter
queue, creating a new conversation and resending the message.
================================================================================
*/

USE [MessageBus]; -- Change to your target database name
GO

SET NOCOUNT ON;

PRINT '========================================';
PRINT 'Creating usp_RetryPoisonMessage Procedure';
PRINT '========================================';
PRINT '';

-- ============================================================================
-- Procedure: usp_RetryPoisonMessage
-- Purpose: Retry a poison message from the DeadLetterQueue
-- ============================================================================
IF EXISTS (SELECT * FROM sys.procedures WHERE name = N'usp_RetryPoisonMessage' AND schema_id = SCHEMA_ID('dbo'))
BEGIN
    DROP PROCEDURE [dbo].[usp_RetryPoisonMessage];
    PRINT 'Dropped existing procedure: usp_RetryPoisonMessage';
END
GO

CREATE PROCEDURE [dbo].[usp_RetryPoisonMessage]
    @DeadLetterId BIGINT = NULL,                    -- ID from DeadLetterQueue table
    @ConversationHandle UNIQUEIDENTIFIER = NULL,    -- Original conversation handle (alternative lookup)
    @QueueName NVARCHAR(256) = NULL,                -- Queue to re-enable (optional)
    @InitiatorService NVARCHAR(256) = NULL,         -- Override initiator service
    @TargetService NVARCHAR(256) = NULL,            -- Override target service
    @ContractName NVARCHAR(256) = NULL,             -- Override contract name
    @ReEnableQueue BIT = 1,                         -- Re-enable the queue after retry
    @ApplicationName NVARCHAR(256) = NULL           -- For audit purposes
AS
BEGIN
    SET NOCOUNT ON;
    SET XACT_ABORT ON;

    DECLARE @ErrorMessage NVARCHAR(4000);
    DECLARE @ErrorSeverity INT;
    DECLARE @ErrorState INT;

    -- Variables for message data
    DECLARE @OriginalConversationHandle UNIQUEIDENTIFIER;
    DECLARE @SourceQueueName NVARCHAR(256);
    DECLARE @ServiceName NVARCHAR(256);
    DECLARE @MessageTypeName NVARCHAR(256);
    DECLARE @MessageBody VARBINARY(MAX);
    DECLARE @RetryCount INT;
    DECLARE @MaxRetries INT;
    DECLARE @ResolvedAt DATETIME2;

    -- Variables for new conversation
    DECLARE @NewDialogHandle UNIQUEIDENTIFIER;
    DECLARE @NewConversationId UNIQUEIDENTIFIER;
    DECLARE @ActualInitiatorService NVARCHAR(256);
    DECLARE @ActualTargetService NVARCHAR(256);
    DECLARE @ActualContractName NVARCHAR(256);

    BEGIN TRY
        -- Validate that at least one identifier is provided
        IF @DeadLetterId IS NULL AND @ConversationHandle IS NULL
        BEGIN
            RAISERROR('Either @DeadLetterId or @ConversationHandle must be provided.', 16, 1);
        END

        -- Get the dead letter record
        SELECT TOP 1
            @DeadLetterId = Id,
            @OriginalConversationHandle = ConversationHandle,
            @SourceQueueName = SourceQueueName,
            @ServiceName = ServiceName,
            @MessageTypeName = MessageTypeName,
            @MessageBody = MessageBody,
            @RetryCount = RetryCount,
            @MaxRetries = MaxRetries,
            @ResolvedAt = ResolvedAt
        FROM dbo.DeadLetterQueue
        WHERE (@DeadLetterId IS NOT NULL AND Id = @DeadLetterId)
           OR (@DeadLetterId IS NULL AND ConversationHandle = @ConversationHandle)
        ORDER BY MovedToDeadLetterAt DESC;

        IF @DeadLetterId IS NULL
        BEGIN
            RAISERROR('Dead letter record not found.', 16, 1);
        END

        -- Check if already resolved
        IF @ResolvedAt IS NOT NULL
        BEGIN
            RAISERROR('This dead letter message has already been resolved.', 16, 1);
        END

        -- Check retry limit
        IF @RetryCount >= @MaxRetries
        BEGIN
            DECLARE @RetryMsg NVARCHAR(200) = 'Maximum retry attempts (' + CAST(@MaxRetries AS NVARCHAR(10)) + ') reached for this message. Update MaxRetries to allow more attempts.';
            RAISERROR(@RetryMsg, 16, 1);
        END

        -- Determine service names (use overrides if provided, otherwise try to determine from original)
        SET @ActualInitiatorService = ISNULL(@InitiatorService, @ServiceName);
        SET @ActualTargetService = ISNULL(@TargetService, @ServiceName);

        -- If still null, try to get from queue association
        IF @ActualInitiatorService IS NULL
        BEGIN
            SELECT TOP 1 @ActualInitiatorService = s.name
            FROM sys.services s
            INNER JOIN sys.service_queues q ON s.service_queue_id = q.object_id
            WHERE q.name = @SourceQueueName;
        END

        IF @ActualTargetService IS NULL
        BEGIN
            SET @ActualTargetService = @ActualInitiatorService;
        END

        -- Determine contract
        SET @ActualContractName = ISNULL(@ContractName, 'MessageBusContract');

        -- Validate we have what we need
        IF @ActualInitiatorService IS NULL
        BEGIN
            RAISERROR('Cannot determine initiator service. Please provide @InitiatorService parameter.', 16, 1);
        END

        IF @ActualTargetService IS NULL
        BEGIN
            RAISERROR('Cannot determine target service. Please provide @TargetService parameter.', 16, 1);
        END

        BEGIN TRANSACTION;

        -- Create new conversation and send message
        BEGIN DIALOG @NewDialogHandle
            FROM SERVICE @ActualInitiatorService
            TO SERVICE @ActualTargetService
            ON CONTRACT @ActualContractName
            WITH ENCRYPTION = OFF,
                 LIFETIME = 3600; -- 1 hour

        -- Get new conversation ID
        SELECT @NewConversationId = conversation_id
        FROM sys.conversation_endpoints
        WHERE conversation_handle = @NewDialogHandle;

        -- Send the message
        SEND ON CONVERSATION @NewDialogHandle
            MESSAGE TYPE @MessageTypeName (@MessageBody);

        -- Update the dead letter record
        UPDATE dbo.DeadLetterQueue
        SET RetryCount = RetryCount + 1,
            LastRetryAt = SYSDATETIME(),
            ResolutionNotes = ISNULL(ResolutionNotes + CHAR(13) + CHAR(10), '')
                + 'Retry attempt ' + CAST(RetryCount + 1 AS NVARCHAR(10))
                + ' at ' + CONVERT(NVARCHAR(30), SYSDATETIME(), 121)
                + ' - New ConversationHandle: ' + CAST(@NewDialogHandle AS NVARCHAR(50))
        WHERE Id = @DeadLetterId;

        -- Log to audit trail
        INSERT INTO dbo.MessageAuditTrail (
            ConversationHandle,
            ConversationId,
            Operation,
            QueueName,
            ServiceName,
            MessageTypeName,
            MessageBodyPreview,
            MessageSizeBytes,
            ApplicationName
        )
        VALUES (
            @NewDialogHandle,
            @NewConversationId,
            'RETRY',
            @ActualInitiatorService + ' -> ' + @ActualTargetService,
            @ActualInitiatorService,
            @MessageTypeName,
            'RETRY from DeadLetter ID: ' + CAST(@DeadLetterId AS NVARCHAR(20)),
            DATALENGTH(@MessageBody),
            ISNULL(@ApplicationName, APP_NAME())
        );

        -- Re-enable the queue if requested and queue name is provided
        IF @ReEnableQueue = 1 AND ISNULL(@QueueName, @SourceQueueName) IS NOT NULL
        BEGIN
            DECLARE @QueueToEnable NVARCHAR(256) = ISNULL(@QueueName, @SourceQueueName);
            DECLARE @EnableSQL NVARCHAR(500);

            -- Check if queue exists and is disabled
            IF EXISTS (
                SELECT 1 FROM sys.service_queues
                WHERE name = @QueueToEnable AND is_receive_enabled = 0
            )
            BEGIN
                SET @EnableSQL = N'ALTER QUEUE ' + QUOTENAME(@QueueToEnable) + N' WITH STATUS = ON;';
                EXEC sp_executesql @EnableSQL;

                -- Log queue re-enable
                INSERT INTO dbo.MessageAuditTrail (
                    ConversationHandle,
                    ConversationId,
                    Operation,
                    QueueName,
                    ServiceName,
                    MessageTypeName,
                    MessageBodyPreview,
                    ApplicationName
                )
                VALUES (
                    @NewDialogHandle,
                    @NewConversationId,
                    'QUEUE_ENABLED',
                    @QueueToEnable,
                    @ActualInitiatorService,
                    NULL,
                    'Queue re-enabled after retry of DeadLetter ID: ' + CAST(@DeadLetterId AS NVARCHAR(20)),
                    ISNULL(@ApplicationName, APP_NAME())
                );
            END
        END

        COMMIT TRANSACTION;

        -- Return success info
        SELECT
            @DeadLetterId AS DeadLetterId,
            @OriginalConversationHandle AS OriginalConversationHandle,
            @NewDialogHandle AS NewConversationHandle,
            @NewConversationId AS NewConversationId,
            @RetryCount + 1 AS RetryAttempt,
            @MaxRetries AS MaxRetries,
            @ActualInitiatorService AS InitiatorService,
            @ActualTargetService AS TargetService,
            @MessageTypeName AS MessageTypeName,
            DATALENGTH(@MessageBody) AS MessageSizeBytes,
            'Message retry initiated successfully' AS Status;

    END TRY
    BEGIN CATCH
        SET @ErrorMessage = ERROR_MESSAGE();
        SET @ErrorSeverity = ERROR_SEVERITY();
        SET @ErrorState = ERROR_STATE();

        IF @@TRANCOUNT > 0
            ROLLBACK TRANSACTION;

        -- Log the retry failure
        BEGIN TRY
            INSERT INTO dbo.MessageAuditTrail (
                ConversationHandle,
                ConversationId,
                Operation,
                QueueName,
                ServiceName,
                MessageTypeName,
                MessageBodyPreview,
                ApplicationName
            )
            VALUES (
                ISNULL(@OriginalConversationHandle, NEWID()),
                NULL,
                'RETRY_FAILED',
                ISNULL(@SourceQueueName, 'Unknown'),
                ISNULL(@ServiceName, 'Unknown'),
                @MessageTypeName,
                'ERROR: ' + @ErrorMessage,
                ISNULL(@ApplicationName, APP_NAME())
            );
        END TRY
        BEGIN CATCH
            PRINT 'Warning: Could not log retry failure to audit trail';
        END CATCH

        RAISERROR(@ErrorMessage, @ErrorSeverity, @ErrorState);
    END CATCH
END
GO

PRINT 'Created procedure: usp_RetryPoisonMessage';

-- ============================================================================
-- Add extended properties for documentation
-- ============================================================================
IF NOT EXISTS (SELECT * FROM sys.extended_properties
               WHERE major_id = OBJECT_ID('dbo.usp_RetryPoisonMessage') AND name = 'MS_Description')
BEGIN
    EXEC sp_addextendedproperty
        @name = N'MS_Description',
        @value = N'Retries a poison message from the DeadLetterQueue by creating a new conversation and resending the message. Optionally re-enables the queue.',
        @level0type = N'SCHEMA', @level0name = N'dbo',
        @level1type = N'PROCEDURE', @level1name = N'usp_RetryPoisonMessage';
    PRINT 'Added procedure description.';
END
GO

-- ============================================================================
-- Verification
-- ============================================================================
PRINT '';
PRINT '========================================';
PRINT 'Verification - usp_RetryPoisonMessage';
PRINT '========================================';
PRINT '';

SELECT
    p.name AS [Procedure Name],
    p.create_date AS [Created],
    p.modify_date AS [Last Modified]
FROM sys.procedures p
WHERE p.name = N'usp_RetryPoisonMessage';

PRINT '';
PRINT 'Parameters:';
PRINT '-----------';

SELECT
    par.name AS [Parameter],
    t.name AS [Type],
    CASE
        WHEN t.name IN ('nvarchar', 'varchar', 'char', 'nchar') THEN
            CASE WHEN par.max_length = -1 THEN 'MAX' ELSE CAST(par.max_length / 2 AS VARCHAR(10)) END
        ELSE ''
    END AS [Length],
    CASE par.is_output WHEN 1 THEN 'Yes' ELSE 'No' END AS [Output]
FROM sys.parameters par
INNER JOIN sys.types t ON par.user_type_id = t.user_type_id
WHERE par.object_id = OBJECT_ID('dbo.usp_RetryPoisonMessage')
ORDER BY par.parameter_id;

PRINT '';
PRINT '========================================';
PRINT 'Usage Examples:';
PRINT '========================================';
PRINT '';
PRINT '-- Retry by DeadLetter ID';
PRINT 'EXEC dbo.usp_RetryPoisonMessage @DeadLetterId = 123;';
PRINT '';
PRINT '-- Retry by conversation handle';
PRINT 'EXEC dbo.usp_RetryPoisonMessage';
PRINT '    @ConversationHandle = ''12345678-1234-1234-1234-123456789ABC'';';
PRINT '';
PRINT '-- Retry with service overrides';
PRINT 'EXEC dbo.usp_RetryPoisonMessage';
PRINT '    @DeadLetterId = 123,';
PRINT '    @InitiatorService = ''MessageBusInitiatorService'',';
PRINT '    @TargetService = ''MessageBusTargetService'',';
PRINT '    @ReEnableQueue = 1;';
PRINT '';
PRINT '========================================';
PRINT 'Script completed successfully.';
PRINT '========================================';
GO
