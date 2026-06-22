/*
================================================================================
Script: 27-usp_MoveToDeadLetter.sql
Purpose: Move a poison message from a queue to the DeadLetterQueue table
Phase: 0.5C - Management Stored Procedures
================================================================================
Prerequisites:
  - Phase 0 scripts (00-07) must be run first
  - Phase 0.5A scripts (10-14) must be run first
  - Phase 0.5B scripts (20-24) must be run first
================================================================================
This procedure receives a poison message from a queue and stores it in the
DeadLetterQueue table for later review and potential retry.
================================================================================
*/

USE [MessageBus]; -- Change to your target database name
GO

SET NOCOUNT ON;

PRINT '========================================';
PRINT 'Creating usp_MoveToDeadLetter Procedure';
PRINT '========================================';
PRINT '';

-- ============================================================================
-- Procedure: usp_MoveToDeadLetter
-- Purpose: Move a poison message from a queue to the DeadLetterQueue table
-- ============================================================================
IF EXISTS (SELECT * FROM sys.procedures WHERE name = N'usp_MoveToDeadLetter' AND schema_id = SCHEMA_ID('dbo'))
BEGIN
    DROP PROCEDURE [dbo].[usp_MoveToDeadLetter];
    PRINT 'Dropped existing procedure: usp_MoveToDeadLetter';
END
GO

CREATE PROCEDURE [dbo].[usp_MoveToDeadLetter]
    @ConversationHandle UNIQUEIDENTIFIER,
    @QueueName NVARCHAR(256),
    @ErrorMessage NVARCHAR(MAX) = NULL,
    @ErrorNumber INT = NULL,
    @EndConversation BIT = 1,                   -- End the conversation after moving
    @MaxRetries INT = 5,                        -- Default max retry attempts
    @ApplicationName NVARCHAR(256) = NULL       -- For audit purposes
AS
BEGIN
    SET NOCOUNT ON;
    SET XACT_ABORT ON;

    DECLARE @ErrorMsg NVARCHAR(4000);
    DECLARE @ErrorSeverity INT;
    DECLARE @ErrorState INT;

    -- Variables for message data
    DECLARE @ConversationId UNIQUEIDENTIFIER;
    DECLARE @ServiceName NVARCHAR(256);
    DECLARE @MessageTypeName NVARCHAR(256);
    DECLARE @MessageBody VARBINARY(MAX);
    DECLARE @MessageSequenceNumber BIGINT;
    DECLARE @QueueSchemaName NVARCHAR(128) = 'dbo';  -- Default schema

    -- Variables for receive operation
    DECLARE @SQL NVARCHAR(MAX);
    DECLARE @DeadLetterId BIGINT;

    BEGIN TRY
        -- Validate queue exists
        IF NOT EXISTS (SELECT 1 FROM sys.service_queues WHERE name = @QueueName)
        BEGIN
            RAISERROR('Queue [%s] does not exist.', 16, 1, @QueueName);
        END

        -- Get conversation details
        SELECT
            @ConversationId = ce.conversation_id,
            @ServiceName = s.name
        FROM sys.conversation_endpoints ce
        LEFT JOIN sys.services s ON ce.service_id = s.service_id
        WHERE ce.conversation_handle = @ConversationHandle;

        IF @ConversationId IS NULL
        BEGIN
            -- Conversation might already be ended, but we can still proceed
            PRINT 'Warning: Conversation handle not found in sys.conversation_endpoints. It may have already been ended.';
        END

        BEGIN TRANSACTION;

        -- Create temp table to receive the message
        CREATE TABLE #ReceivedMessage (
            conversation_handle UNIQUEIDENTIFIER,
            message_type_name NVARCHAR(256),
            message_body VARBINARY(MAX),
            message_sequence_number BIGINT
        );

        -- Try to receive the message from the queue
        SET @SQL = N'
            RECEIVE TOP(1)
                conversation_handle,
                message_type_name,
                message_body,
                message_sequence_number
            FROM ' + QUOTENAME(@QueueSchemaName) + N'.' + QUOTENAME(@QueueName) + N'
            WHERE conversation_handle = @ConvHandle';

        INSERT INTO #ReceivedMessage
        EXEC sp_executesql @SQL,
            N'@ConvHandle UNIQUEIDENTIFIER',
            @ConvHandle = @ConversationHandle;

        -- Check if we received a message
        IF EXISTS (SELECT 1 FROM #ReceivedMessage)
        BEGIN
            SELECT
                @MessageTypeName = message_type_name,
                @MessageBody = message_body,
                @MessageSequenceNumber = message_sequence_number
            FROM #ReceivedMessage;
        END
        ELSE
        BEGIN
            -- No message found - might already have been received or doesn't exist
            -- Create a placeholder record
            SET @MessageTypeName = '(Message already consumed or not found)';
            SET @MessageBody = NULL;
            SET @MessageSequenceNumber = NULL;
        END

        -- Insert into DeadLetterQueue
        INSERT INTO dbo.DeadLetterQueue (
            ConversationHandle,
            ConversationId,
            SourceQueueName,
            ServiceName,
            MessageTypeName,
            MessageBody,
            ErrorMessage,
            ErrorNumber,
            RetryCount,
            MaxRetries,
            OriginalEnqueueTime
        )
        VALUES (
            @ConversationHandle,
            @ConversationId,
            @QueueName,
            @ServiceName,
            @MessageTypeName,
            @MessageBody,
            @ErrorMessage,
            @ErrorNumber,
            0,
            @MaxRetries,
            NULL  -- We don't have the original enqueue time
        );

        SET @DeadLetterId = SCOPE_IDENTITY();

        -- End the conversation if requested
        IF @EndConversation = 1 AND @ConversationId IS NOT NULL
        BEGIN
            BEGIN TRY
                IF @ErrorMessage IS NOT NULL
                BEGIN
                    END CONVERSATION @ConversationHandle
                        WITH ERROR = ISNULL(@ErrorNumber, 50000)
                        DESCRIPTION = @ErrorMessage;
                END
                ELSE
                BEGIN
                    END CONVERSATION @ConversationHandle;
                END
            END TRY
            BEGIN CATCH
                -- Conversation might already be ended
                PRINT 'Warning: Could not end conversation - it may already be ended.';
            END CATCH
        END

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
            @ConversationHandle,
            @ConversationId,
            'MOVE_TO_DEADLETTER',
            @QueueName,
            @ServiceName,
            @MessageTypeName,
            'DeadLetter ID: ' + CAST(@DeadLetterId AS NVARCHAR(20))
                + CASE WHEN @ErrorMessage IS NOT NULL
                       THEN ' | Error: ' + LEFT(@ErrorMessage, 200)
                       ELSE '' END,
            ISNULL(DATALENGTH(@MessageBody), 0),
            ISNULL(@ApplicationName, APP_NAME())
        );

        DROP TABLE #ReceivedMessage;

        COMMIT TRANSACTION;

        -- Return success info
        SELECT
            @DeadLetterId AS DeadLetterId,
            @ConversationHandle AS ConversationHandle,
            @ConversationId AS ConversationId,
            @QueueName AS SourceQueueName,
            @ServiceName AS ServiceName,
            @MessageTypeName AS MessageTypeName,
            ISNULL(DATALENGTH(@MessageBody), 0) AS MessageSizeBytes,
            @ErrorMessage AS ErrorMessage,
            @ErrorNumber AS ErrorNumber,
            CASE WHEN @EndConversation = 1 THEN 'Yes' ELSE 'No' END AS ConversationEnded,
            'Message moved to dead letter queue successfully' AS Status;

    END TRY
    BEGIN CATCH
        SET @ErrorMsg = ERROR_MESSAGE();
        SET @ErrorSeverity = ERROR_SEVERITY();
        SET @ErrorState = ERROR_STATE();

        IF @@TRANCOUNT > 0
            ROLLBACK TRANSACTION;

        IF OBJECT_ID('tempdb..#ReceivedMessage') IS NOT NULL
            DROP TABLE #ReceivedMessage;

        -- Log the failure
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
                @ConversationHandle,
                @ConversationId,
                'DEADLETTER_FAILED',
                @QueueName,
                @ServiceName,
                @MessageTypeName,
                'ERROR: ' + @ErrorMsg,
                ISNULL(@ApplicationName, APP_NAME())
            );
        END TRY
        BEGIN CATCH
            PRINT 'Warning: Could not log failure to audit trail';
        END CATCH

        RAISERROR(@ErrorMsg, @ErrorSeverity, @ErrorState);
    END CATCH
END
GO

PRINT 'Created procedure: usp_MoveToDeadLetter';

-- ============================================================================
-- Add extended properties for documentation
-- ============================================================================
IF NOT EXISTS (SELECT * FROM sys.extended_properties
               WHERE major_id = OBJECT_ID('dbo.usp_MoveToDeadLetter') AND name = 'MS_Description')
BEGIN
    EXEC sp_addextendedproperty
        @name = N'MS_Description',
        @value = N'Moves a poison message from a Service Broker queue to the DeadLetterQueue table for later review and potential retry.',
        @level0type = N'SCHEMA', @level0name = N'dbo',
        @level1type = N'PROCEDURE', @level1name = N'usp_MoveToDeadLetter';
    PRINT 'Added procedure description.';
END
GO

-- ============================================================================
-- Verification
-- ============================================================================
PRINT '';
PRINT '========================================';
PRINT 'Verification - usp_MoveToDeadLetter';
PRINT '========================================';
PRINT '';

SELECT
    p.name AS [Procedure Name],
    p.create_date AS [Created],
    p.modify_date AS [Last Modified]
FROM sys.procedures p
WHERE p.name = N'usp_MoveToDeadLetter';

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
WHERE par.object_id = OBJECT_ID('dbo.usp_MoveToDeadLetter')
ORDER BY par.parameter_id;

PRINT '';
PRINT '========================================';
PRINT 'Usage Examples:';
PRINT '========================================';
PRINT '';
PRINT '-- Move poison message with error details';
PRINT 'EXEC dbo.usp_MoveToDeadLetter';
PRINT '    @ConversationHandle = ''12345678-1234-1234-1234-123456789ABC'',';
PRINT '    @QueueName = ''MessageBusTargetQueue'',';
PRINT '    @ErrorMessage = ''Message processing failed after 5 attempts'',';
PRINT '    @ErrorNumber = 50001;';
PRINT '';
PRINT '-- Move message without ending conversation';
PRINT 'EXEC dbo.usp_MoveToDeadLetter';
PRINT '    @ConversationHandle = ''12345678-1234-1234-1234-123456789ABC'',';
PRINT '    @QueueName = ''MessageBusTargetQueue'',';
PRINT '    @EndConversation = 0;';
PRINT '';
PRINT '========================================';
PRINT 'Script completed successfully.';
PRINT '========================================';
GO
