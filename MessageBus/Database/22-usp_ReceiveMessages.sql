/*
================================================================================
Script: 22-usp_ReceiveMessages.sql
Purpose: Receive multiple messages (batch) from a specified Service Broker queue
Phase: 0.5B - Core Stored Procedures
================================================================================
Prerequisites:
  - Phase 0 scripts (00-07) must be run first
  - Phase 0.5A scripts (10-14) must be run first
  - 20-usp_SendMessage.sql
  - 21-usp_ReceiveMessage.sql
================================================================================
This procedure receives multiple messages from a queue in a single call,
returning them as a result set for batch processing.
================================================================================
*/

USE [MessageBus]; -- Change to your target database name
GO

SET NOCOUNT ON;

PRINT '========================================';
PRINT 'Creating usp_ReceiveMessages Procedure';
PRINT '========================================';
PRINT '';

-- ============================================================================
-- Procedure: usp_ReceiveMessages
-- Purpose: Receive multiple messages from a Service Broker queue (batch)
-- ============================================================================
IF EXISTS (SELECT * FROM sys.procedures WHERE name = N'usp_ReceiveMessages' AND schema_id = SCHEMA_ID('dbo'))
BEGIN
    DROP PROCEDURE [dbo].[usp_ReceiveMessages];
    PRINT 'Dropped existing procedure: usp_ReceiveMessages';
END
GO

CREATE PROCEDURE [dbo].[usp_ReceiveMessages]
    @QueueName NVARCHAR(256),
    @TimeoutMs INT = 5000,                    -- Timeout in milliseconds (default 5 seconds)
    @MaxMessages INT = 10,                    -- Maximum messages to receive
    @ApplicationName NVARCHAR(256) = NULL     -- For audit purposes
AS
BEGIN
    SET NOCOUNT ON;

    DECLARE @ErrorMessage NVARCHAR(4000);
    DECLARE @SQL NVARCHAR(MAX);
    DECLARE @QueueSchemaName NVARCHAR(128) = 'dbo';  -- Default schema
    DECLARE @ReceivedCount INT = 0;

    -- Create temp table to hold received messages
    CREATE TABLE #ReceivedMessages (
        RowNum INT IDENTITY(1,1),
        conversation_handle UNIQUEIDENTIFIER,
        conversation_group_id UNIQUEIDENTIFIER,
        message_sequence_number BIGINT,
        service_name NVARCHAR(512),
        service_contract_name NVARCHAR(256),
        message_type_name NVARCHAR(256),
        validation NCHAR(2),
        message_body VARBINARY(MAX)
    );

    -- Table to hold processed results
    CREATE TABLE #ProcessedMessages (
        RowNum INT,
        ConversationHandle UNIQUEIDENTIFIER,
        ConversationId UNIQUEIDENTIFIER,
        ConversationGroupId UNIQUEIDENTIFIER,
        MessageSequenceNumber BIGINT,
        ServiceName NVARCHAR(512),
        ContractName NVARCHAR(256),
        MessageTypeName NVARCHAR(256),
        MessageBody NVARCHAR(MAX),
        MessageSizeBytes INT,
        IsSystemMessage BIT,
        SystemMessageType NVARCHAR(50)
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

        -- Validate MaxMessages
        IF @MaxMessages < 1 OR @MaxMessages > 1000
        BEGIN
            RAISERROR('MaxMessages must be between 1 and 1000.', 16, 1);
        END

        -- Build dynamic SQL for RECEIVE with WAITFOR
        SET @SQL = N'
            WAITFOR (
                RECEIVE TOP(' + CAST(@MaxMessages AS NVARCHAR(10)) + N')
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

        -- Get count of received messages
        SELECT @ReceivedCount = COUNT(*) FROM #ReceivedMessages;

        IF @ReceivedCount > 0
        BEGIN
            -- Process each message
            INSERT INTO #ProcessedMessages (
                RowNum,
                ConversationHandle,
                ConversationId,
                ConversationGroupId,
                MessageSequenceNumber,
                ServiceName,
                ContractName,
                MessageTypeName,
                MessageBody,
                MessageSizeBytes,
                IsSystemMessage,
                SystemMessageType
            )
            SELECT
                rm.RowNum,
                rm.conversation_handle,
                ce.conversation_id,
                rm.conversation_group_id,
                rm.message_sequence_number,
                rm.service_name,
                rm.service_contract_name,
                rm.message_type_name,
                CAST(rm.message_body AS NVARCHAR(MAX)),
                DATALENGTH(rm.message_body),
                CASE
                    WHEN rm.message_type_name LIKE 'http://schemas.microsoft.com/SQL/ServiceBroker/%'
                    THEN 1 ELSE 0
                END,
                CASE
                    WHEN rm.message_type_name = 'http://schemas.microsoft.com/SQL/ServiceBroker/EndDialog'
                    THEN 'EndDialog'
                    WHEN rm.message_type_name = 'http://schemas.microsoft.com/SQL/ServiceBroker/Error'
                    THEN 'Error'
                    WHEN rm.message_type_name = 'http://schemas.microsoft.com/SQL/ServiceBroker/DialogTimer'
                    THEN 'DialogTimer'
                    ELSE NULL
                END
            FROM #ReceivedMessages rm
            LEFT JOIN sys.conversation_endpoints ce ON rm.conversation_handle = ce.conversation_handle;

            -- Handle END CONVERSATION messages
            DECLARE @HandleToEnd UNIQUEIDENTIFIER;
            DECLARE EndConversationCursor CURSOR LOCAL FAST_FORWARD FOR
                SELECT ConversationHandle
                FROM #ProcessedMessages
                WHERE SystemMessageType IN ('EndDialog', 'Error');

            OPEN EndConversationCursor;
            FETCH NEXT FROM EndConversationCursor INTO @HandleToEnd;

            WHILE @@FETCH_STATUS = 0
            BEGIN
                BEGIN TRY
                    END CONVERSATION @HandleToEnd;
                END TRY
                BEGIN CATCH
                    -- Ignore errors ending conversations (might already be ended)
                    PRINT 'Warning: Could not end conversation ' + CAST(@HandleToEnd AS NVARCHAR(36));
                END CATCH

                FETCH NEXT FROM EndConversationCursor INTO @HandleToEnd;
            END

            CLOSE EndConversationCursor;
            DEALLOCATE EndConversationCursor;

            -- Audit all received messages
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
            SELECT
                pm.ConversationHandle,
                pm.ConversationId,
                CASE
                    WHEN pm.SystemMessageType = 'EndDialog' THEN 'END_CONVERSATION'
                    WHEN pm.SystemMessageType = 'Error' THEN 'ERROR'
                    ELSE 'RECEIVE'
                END,
                @QueueName,
                pm.ServiceName,
                pm.MessageTypeName,
                pm.MessageSequenceNumber,
                LEFT(pm.MessageBody, 500),
                pm.MessageSizeBytes,
                ISNULL(@ApplicationName, APP_NAME())
            FROM #ProcessedMessages pm;

            -- Return the messages
            SELECT
                pm.ConversationHandle,
                pm.ConversationId,
                pm.ConversationGroupId,
                pm.MessageSequenceNumber,
                pm.ServiceName,
                pm.ContractName,
                pm.MessageTypeName,
                pm.MessageBody,
                pm.MessageSizeBytes,
                pm.IsSystemMessage,
                pm.SystemMessageType
            FROM #ProcessedMessages pm
            ORDER BY pm.RowNum;

            -- Return summary
            SELECT
                @ReceivedCount AS TotalMessagesReceived,
                SUM(CASE WHEN IsSystemMessage = 0 THEN 1 ELSE 0 END) AS ApplicationMessages,
                SUM(CASE WHEN SystemMessageType = 'EndDialog' THEN 1 ELSE 0 END) AS EndDialogMessages,
                SUM(CASE WHEN SystemMessageType = 'Error' THEN 1 ELSE 0 END) AS ErrorMessages
            FROM #ProcessedMessages;
        END
        ELSE
        BEGIN
            -- No messages received (timeout) - return empty result set with schema
            SELECT
                CAST(NULL AS UNIQUEIDENTIFIER) AS ConversationHandle,
                CAST(NULL AS UNIQUEIDENTIFIER) AS ConversationId,
                CAST(NULL AS UNIQUEIDENTIFIER) AS ConversationGroupId,
                CAST(NULL AS BIGINT) AS MessageSequenceNumber,
                CAST(NULL AS NVARCHAR(512)) AS ServiceName,
                CAST(NULL AS NVARCHAR(256)) AS ContractName,
                CAST(NULL AS NVARCHAR(256)) AS MessageTypeName,
                CAST(NULL AS NVARCHAR(MAX)) AS MessageBody,
                CAST(NULL AS INT) AS MessageSizeBytes,
                CAST(NULL AS BIT) AS IsSystemMessage,
                CAST(NULL AS NVARCHAR(50)) AS SystemMessageType
            WHERE 1 = 0;  -- Returns empty result set with correct schema

            -- Return summary showing no messages
            SELECT
                0 AS TotalMessagesReceived,
                0 AS ApplicationMessages,
                0 AS EndDialogMessages,
                0 AS ErrorMessages;
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
                NEWID(),
                NULL,
                'ERROR',
                @QueueName,
                NULL,
                NULL,
                'BATCH RECEIVE ERROR: ' + @ErrorMessage,
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
    DROP TABLE #ProcessedMessages;
END
GO

PRINT 'Created procedure: usp_ReceiveMessages';

-- ============================================================================
-- Add extended properties for documentation
-- ============================================================================
IF NOT EXISTS (SELECT * FROM sys.extended_properties
               WHERE major_id = OBJECT_ID('dbo.usp_ReceiveMessages') AND name = 'MS_Description')
BEGIN
    EXEC sp_addextendedproperty
        @name = N'MS_Description',
        @value = N'Receives multiple messages from a Service Broker queue in a single batch operation. Returns messages as a result set for batch processing.',
        @level0type = N'SCHEMA', @level0name = N'dbo',
        @level1type = N'PROCEDURE', @level1name = N'usp_ReceiveMessages';
    PRINT 'Added procedure description.';
END
GO

-- ============================================================================
-- Verification
-- ============================================================================
PRINT '';
PRINT '========================================';
PRINT 'Verification - usp_ReceiveMessages';
PRINT '========================================';
PRINT '';

SELECT
    p.name AS [Procedure Name],
    p.create_date AS [Created],
    p.modify_date AS [Last Modified]
FROM sys.procedures p
WHERE p.name = N'usp_ReceiveMessages';

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
WHERE par.object_id = OBJECT_ID('dbo.usp_ReceiveMessages')
ORDER BY par.parameter_id;

PRINT '';
PRINT '========================================';
PRINT 'Script completed successfully.';
PRINT '========================================';
GO
