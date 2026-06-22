/*
================================================================================
Script: 21-usp_ReceiveMessage.sql
Purpose: Receive a single message from a specified Service Broker queue
Phase: 0.5B - Core Stored Procedures
================================================================================
Prerequisites:
  - Phase 0 scripts (00-07) must be run first
  - Phase 0.5A scripts (10-14) must be run first
  - 20-usp_SendMessage.sql
================================================================================
This procedure receives a single message from a queue with timeout support,
handles END CONVERSATION messages, and logs to the audit trail.
================================================================================
*/

USE [MessageBus]; -- Change to your target database name
GO

SET NOCOUNT ON;

PRINT '========================================';
PRINT 'Creating usp_ReceiveMessage Procedure';
PRINT '========================================';
PRINT '';

-- ============================================================================
-- Procedure: usp_ReceiveMessage
-- Purpose: Receive a single message from a Service Broker queue
-- ============================================================================
IF EXISTS (SELECT * FROM sys.procedures WHERE name = N'usp_ReceiveMessage' AND schema_id = SCHEMA_ID('dbo'))
BEGIN
    DROP PROCEDURE [dbo].[usp_ReceiveMessage];
    PRINT 'Dropped existing procedure: usp_ReceiveMessage';
END
GO

CREATE PROCEDURE [dbo].[usp_ReceiveMessage]
    @QueueName NVARCHAR(256),
    @TimeoutMs INT = 5000,                               -- Timeout in milliseconds (default 5 seconds)
    @MaxMessages INT = 1,                                -- Always 1 for single message receive
    @ConversationHandle UNIQUEIDENTIFIER = NULL OUTPUT,  -- Returns the conversation handle
    @MessageTypeName NVARCHAR(256) = NULL OUTPUT,        -- Returns the message type
    @MessageBody NVARCHAR(MAX) = NULL OUTPUT,            -- Returns the message body
    @ApplicationName NVARCHAR(256) = NULL                -- For audit purposes
AS
BEGIN
    SET NOCOUNT ON;

    DECLARE @ErrorMessage NVARCHAR(4000);
    DECLARE @SQL NVARCHAR(MAX);
    DECLARE @ConversationId UNIQUEIDENTIFIER;
    DECLARE @ConversationGroupId UNIQUEIDENTIFIER;
    DECLARE @MessageSequenceNumber BIGINT;
    DECLARE @ServiceName NVARCHAR(256);
    DECLARE @ServiceContractName NVARCHAR(256);
    DECLARE @MessageSizeBytes INT;
    DECLARE @MessageBodyPreview NVARCHAR(500);
    DECLARE @ValidationFlag BIT;
    DECLARE @QueueSchemaName NVARCHAR(128) = 'dbo';  -- Default schema

    -- Create temp table to hold received message
    CREATE TABLE #ReceivedMessages (
        conversation_handle UNIQUEIDENTIFIER,
        conversation_group_id UNIQUEIDENTIFIER,
        message_sequence_number BIGINT,
        service_name NVARCHAR(512),
        service_contract_name NVARCHAR(256),
        message_type_name NVARCHAR(256),
        validation NCHAR(2),
        message_body VARBINARY(MAX)
    );

    BEGIN TRY
        -- Validate queue exists
        IF NOT EXISTS (
            SELECT 1
            FROM sys.service_queues
            WHERE name = @QueueName
        )
        BEGIN
            RAISERROR('Queue [%s] does not exist.', 16, 1, @QueueName);
        END

        -- Check if queue is enabled for receive
        IF EXISTS (
            SELECT 1
            FROM sys.service_queues
            WHERE name = @QueueName
              AND is_receive_enabled = 0
        )
        BEGIN
            RAISERROR('Queue [%s] is disabled for receiving messages.', 16, 1, @QueueName);
        END

        -- Build dynamic SQL for RECEIVE with WAITFOR
        -- Using QUOTENAME to prevent SQL injection
        SET @SQL = N'
            WAITFOR (
                RECEIVE TOP(1)
                    conversation_handle,
                    conversation_group_id,
                    message_sequence_number,
                    service_name,
                    service_contract_name,
                    message_type_name,
                    validation,
                    message_body
                FROM ' + QUOTENAME(@QueueSchemaName) + N'.' + QUOTENAME(@QueueName) + N'
                INTO #ReceivedMessages
            ), TIMEOUT ' + CAST(@TimeoutMs AS NVARCHAR(10));

        -- Execute the receive
        EXEC sp_executesql @SQL;

        -- Check if we received a message
        IF EXISTS (SELECT 1 FROM #ReceivedMessages)
        BEGIN
            -- Extract message details
            SELECT TOP 1
                @ConversationHandle = conversation_handle,
                @ConversationGroupId = conversation_group_id,
                @MessageSequenceNumber = message_sequence_number,
                @ServiceName = service_name,
                @ServiceContractName = service_contract_name,
                @MessageTypeName = message_type_name,
                @ValidationFlag = CASE validation WHEN 'X' THEN 1 ELSE 0 END,
                @MessageBody = CAST(message_body AS NVARCHAR(MAX))
            FROM #ReceivedMessages;

            -- Get conversation ID
            SELECT @ConversationId = conversation_id
            FROM sys.conversation_endpoints
            WHERE conversation_handle = @ConversationHandle;

            -- Calculate message metadata
            SET @MessageSizeBytes = DATALENGTH(@MessageBody);
            SET @MessageBodyPreview = LEFT(@MessageBody, 500);

            -- Handle system message types
            IF @MessageTypeName = N'http://schemas.microsoft.com/SQL/ServiceBroker/EndDialog'
            BEGIN
                -- End the conversation gracefully
                END CONVERSATION @ConversationHandle;

                -- Audit the end conversation
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
                    'END_CONVERSATION',
                    @QueueName,
                    @ServiceName,
                    @MessageTypeName,
                    'Dialog ended by remote service',
                    ISNULL(@ApplicationName, APP_NAME())
                );

                -- Set output to indicate end conversation
                SET @MessageBody = N'__END_CONVERSATION__';
            END
            ELSE IF @MessageTypeName = N'http://schemas.microsoft.com/SQL/ServiceBroker/Error'
            BEGIN
                -- Handle error message
                END CONVERSATION @ConversationHandle;

                -- Audit the error
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
                    'ERROR',
                    @QueueName,
                    @ServiceName,
                    @MessageTypeName,
                    'Error message received: ' + LEFT(ISNULL(@MessageBody, ''), 400),
                    ISNULL(@ApplicationName, APP_NAME())
                );

                -- Set output to indicate error
                SET @MessageBody = N'__ERROR__: ' + ISNULL(@MessageBody, N'Unknown error');
            END
            ELSE
            BEGIN
                -- Normal message - audit the receive
                INSERT INTO dbo.MessageAuditTrail (
                    ConversationHandle,
                    ConversationId,
                    Operation,
                    QueueName,
                    ServiceName,
                    MessageTypeName,
                    MessageSequenceNumber,
                    MessageBodyPreview,
                    MessageSizeBytes,
                    ApplicationName
                )
                VALUES (
                    @ConversationHandle,
                    @ConversationId,
                    'RECEIVE',
                    @QueueName,
                    @ServiceName,
                    @MessageTypeName,
                    @MessageSequenceNumber,
                    @MessageBodyPreview,
                    @MessageSizeBytes,
                    ISNULL(@ApplicationName, APP_NAME())
                );
            END

            -- Return success with message details
            SELECT
                1 AS MessageReceived,
                @ConversationHandle AS ConversationHandle,
                @ConversationId AS ConversationId,
                @ConversationGroupId AS ConversationGroupId,
                @MessageTypeName AS MessageTypeName,
                @MessageSequenceNumber AS MessageSequenceNumber,
                @ServiceName AS ServiceName,
                @ServiceContractName AS ContractName,
                @MessageSizeBytes AS MessageSizeBytes,
                @MessageBody AS MessageBody;
        END
        ELSE
        BEGIN
            -- No message received (timeout)
            SELECT
                0 AS MessageReceived,
                NULL AS ConversationHandle,
                NULL AS ConversationId,
                NULL AS ConversationGroupId,
                NULL AS MessageTypeName,
                NULL AS MessageSequenceNumber,
                NULL AS ServiceName,
                NULL AS ContractName,
                NULL AS MessageSizeBytes,
                NULL AS MessageBody;
        END

    END TRY
    BEGIN CATCH
        SET @ErrorMessage = ERROR_MESSAGE();

        -- Log error to audit trail
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
                ISNULL(@ConversationHandle, NEWID()),
                @ConversationId,
                'ERROR',
                @QueueName,
                @ServiceName,
                @MessageTypeName,
                'RECEIVE ERROR: ' + @ErrorMessage,
                ISNULL(@ApplicationName, APP_NAME())
            );
        END TRY
        BEGIN CATCH
            PRINT 'Warning: Could not log error to audit trail';
        END CATCH

        -- Re-throw
        DECLARE @ErrorSeverity INT = ERROR_SEVERITY();
        DECLARE @ErrorState INT = ERROR_STATE();
        RAISERROR(@ErrorMessage, @ErrorSeverity, @ErrorState);
    END CATCH

    -- Cleanup
    DROP TABLE #ReceivedMessages;
END
GO

PRINT 'Created procedure: usp_ReceiveMessage';

-- ============================================================================
-- Add extended properties for documentation
-- ============================================================================
IF NOT EXISTS (SELECT * FROM sys.extended_properties
               WHERE major_id = OBJECT_ID('dbo.usp_ReceiveMessage') AND name = 'MS_Description')
BEGIN
    EXEC sp_addextendedproperty
        @name = N'MS_Description',
        @value = N'Receives a single message from a Service Broker queue with timeout support. Handles END CONVERSATION and Error messages automatically.',
        @level0type = N'SCHEMA', @level0name = N'dbo',
        @level1type = N'PROCEDURE', @level1name = N'usp_ReceiveMessage';
    PRINT 'Added procedure description.';
END
GO

-- ============================================================================
-- Verification
-- ============================================================================
PRINT '';
PRINT '========================================';
PRINT 'Verification - usp_ReceiveMessage';
PRINT '========================================';
PRINT '';

SELECT
    p.name AS [Procedure Name],
    p.create_date AS [Created],
    p.modify_date AS [Last Modified]
FROM sys.procedures p
WHERE p.name = N'usp_ReceiveMessage';

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
WHERE par.object_id = OBJECT_ID('dbo.usp_ReceiveMessage')
ORDER BY par.parameter_id;

PRINT '';
PRINT '========================================';
PRINT 'Script completed successfully.';
PRINT '========================================';
GO
