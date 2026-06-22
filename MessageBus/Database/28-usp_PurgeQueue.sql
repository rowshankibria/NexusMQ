/*
================================================================================
Script: 28-usp_PurgeQueue.sql
Purpose: Purge all messages from a Service Broker queue
Phase: 0.5C - Management Stored Procedures
================================================================================
Prerequisites:
  - Phase 0 scripts (00-07) must be run first
  - Phase 0.5A scripts (10-14) must be run first
  - Phase 0.5B scripts (20-24) must be run first
================================================================================
This procedure removes all messages from a queue. It requires a confirmation
code for safety to prevent accidental data loss.
================================================================================
*/

USE [MessageBus]; -- Change to your target database name
GO

SET NOCOUNT ON;

PRINT '========================================';
PRINT 'Creating usp_PurgeQueue Procedure';
PRINT '========================================';
PRINT '';

-- ============================================================================
-- Procedure: usp_PurgeQueue
-- Purpose: Purge all messages from a Service Broker queue
-- ============================================================================
IF EXISTS (SELECT * FROM sys.procedures WHERE name = N'usp_PurgeQueue' AND schema_id = SCHEMA_ID('dbo'))
BEGIN
    DROP PROCEDURE [dbo].[usp_PurgeQueue];
    PRINT 'Dropped existing procedure: usp_PurgeQueue';
END
GO

CREATE PROCEDURE [dbo].[usp_PurgeQueue]
    @QueueName NVARCHAR(256),
    @ConfirmationCode NVARCHAR(50),             -- Safety: must pass 'CONFIRM_PURGE'
    @EndConversations BIT = 1,                  -- End all conversations after purging
    @BatchSize INT = 1000,                      -- Process in batches
    @ApplicationName NVARCHAR(256) = NULL       -- For audit purposes
AS
BEGIN
    SET NOCOUNT ON;

    DECLARE @ErrorMessage NVARCHAR(4000);
    DECLARE @ErrorSeverity INT;
    DECLARE @ErrorState INT;

    -- Validation variables
    DECLARE @QueueSchemaName NVARCHAR(128) = 'dbo';  -- Default schema
    DECLARE @SQL NVARCHAR(MAX);

    -- Tracking variables
    DECLARE @TotalPurged INT = 0;
    DECLARE @BatchPurged INT = 1;
    DECLARE @ConversationsEnded INT = 0;
    DECLARE @StartTime DATETIME2 = SYSDATETIME();

    -- Temp table for received messages
    DECLARE @ReceivedMessages TABLE (
        conversation_handle UNIQUEIDENTIFIER,
        message_type_name NVARCHAR(256)
    );

    -- Temp table for unique conversations to end
    DECLARE @ConversationsToEnd TABLE (
        conversation_handle UNIQUEIDENTIFIER PRIMARY KEY
    );

    BEGIN TRY
        -- Validate confirmation code
        IF @ConfirmationCode IS NULL OR @ConfirmationCode != 'CONFIRM_PURGE'
        BEGIN
            RAISERROR('Invalid confirmation code. You must pass @ConfirmationCode = ''CONFIRM_PURGE'' to execute this destructive operation.', 16, 1);
        END

        -- Validate queue exists
        IF NOT EXISTS (SELECT 1 FROM sys.service_queues WHERE name = @QueueName)
        BEGIN
            RAISERROR('Queue [%s] does not exist.', 16, 1, @QueueName);
        END

        -- Get initial message count
        DECLARE @InitialCount INT = 0;
        SET @SQL = N'SELECT @CountOut = COUNT(*) FROM ' + QUOTENAME(@QueueSchemaName) + N'.' + QUOTENAME(@QueueName) + N' WITH (NOLOCK)';
        EXEC sp_executesql @SQL, N'@CountOut INT OUTPUT', @CountOut = @InitialCount OUTPUT;

        IF @InitialCount = 0
        BEGIN
            -- Nothing to purge
            SELECT
                @QueueName AS QueueName,
                0 AS MessagesPurged,
                0 AS ConversationsEnded,
                0 AS DurationMs,
                'Queue was already empty' AS Status;
            RETURN;
        END

        PRINT 'Starting purge of queue [' + @QueueName + '] with ' + CAST(@InitialCount AS NVARCHAR(20)) + ' messages...';

        -- Log the purge start to audit trail
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
            'PURGE_START',
            @QueueName,
            NULL,
            NULL,
            'Starting purge of ' + CAST(@InitialCount AS NVARCHAR(20)) + ' messages',
            ISNULL(@ApplicationName, APP_NAME())
        );

        -- Purge in batches
        WHILE @BatchPurged > 0
        BEGIN
            DELETE FROM @ReceivedMessages;

            -- Build receive command
            SET @SQL = N'
                RECEIVE TOP(' + CAST(@BatchSize AS NVARCHAR(10)) + N')
                    conversation_handle,
                    message_type_name
                FROM ' + QUOTENAME(@QueueSchemaName) + N'.' + QUOTENAME(@QueueName);

            INSERT INTO @ReceivedMessages (conversation_handle, message_type_name)
            EXEC sp_executesql @SQL;

            SET @BatchPurged = @@ROWCOUNT;
            SET @TotalPurged = @TotalPurged + @BatchPurged;

            -- Collect unique conversations to end
            IF @EndConversations = 1 AND @BatchPurged > 0
            BEGIN
                INSERT INTO @ConversationsToEnd (conversation_handle)
                SELECT DISTINCT conversation_handle
                FROM @ReceivedMessages rm
                WHERE NOT EXISTS (
                    SELECT 1 FROM @ConversationsToEnd cte
                    WHERE cte.conversation_handle = rm.conversation_handle
                );
            END

            IF @BatchPurged > 0
            BEGIN
                PRINT 'Purged batch of ' + CAST(@BatchPurged AS NVARCHAR(10)) + ' messages (Total: ' + CAST(@TotalPurged AS NVARCHAR(20)) + ')...';
            END
        END

        -- End conversations if requested
        IF @EndConversations = 1
        BEGIN
            DECLARE @ConvHandle UNIQUEIDENTIFIER;
            DECLARE conv_cursor CURSOR LOCAL FAST_FORWARD FOR
                SELECT conversation_handle FROM @ConversationsToEnd;

            OPEN conv_cursor;
            FETCH NEXT FROM conv_cursor INTO @ConvHandle;

            WHILE @@FETCH_STATUS = 0
            BEGIN
                BEGIN TRY
                    -- Check if conversation is still active
                    IF EXISTS (
                        SELECT 1 FROM sys.conversation_endpoints
                        WHERE conversation_handle = @ConvHandle
                          AND state NOT IN ('CD', 'ER', 'DI')
                    )
                    BEGIN
                        END CONVERSATION @ConvHandle WITH CLEANUP;
                        SET @ConversationsEnded = @ConversationsEnded + 1;
                    END
                END TRY
                BEGIN CATCH
                    -- Ignore errors ending individual conversations
                    PRINT 'Warning: Could not end conversation ' + CAST(@ConvHandle AS NVARCHAR(50));
                END CATCH

                FETCH NEXT FROM conv_cursor INTO @ConvHandle;
            END

            CLOSE conv_cursor;
            DEALLOCATE conv_cursor;
        END

        -- Log the purge completion to audit trail
        DECLARE @DurationMs INT = DATEDIFF(MILLISECOND, @StartTime, SYSDATETIME());

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
            'PURGE_COMPLETE',
            @QueueName,
            NULL,
            NULL,
            'Purged ' + CAST(@TotalPurged AS NVARCHAR(20)) + ' messages, ended '
                + CAST(@ConversationsEnded AS NVARCHAR(20)) + ' conversations in '
                + CAST(@DurationMs AS NVARCHAR(20)) + 'ms',
            ISNULL(@ApplicationName, APP_NAME())
        );

        -- Return results
        SELECT
            @QueueName AS QueueName,
            @InitialCount AS InitialMessageCount,
            @TotalPurged AS MessagesPurged,
            @ConversationsEnded AS ConversationsEnded,
            @DurationMs AS DurationMs,
            CASE
                WHEN @TotalPurged = @InitialCount THEN 'Queue purged successfully'
                ELSE 'Queue partially purged (new messages may have arrived)'
            END AS Status;

    END TRY
    BEGIN CATCH
        SET @ErrorMessage = ERROR_MESSAGE();
        SET @ErrorSeverity = ERROR_SEVERITY();
        SET @ErrorState = ERROR_STATE();

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
                NEWID(),
                NULL,
                'PURGE_FAILED',
                @QueueName,
                NULL,
                NULL,
                'ERROR after ' + CAST(@TotalPurged AS NVARCHAR(20)) + ' messages: ' + @ErrorMessage,
                ISNULL(@ApplicationName, APP_NAME())
            );
        END TRY
        BEGIN CATCH
            PRINT 'Warning: Could not log failure to audit trail';
        END CATCH

        RAISERROR(@ErrorMessage, @ErrorSeverity, @ErrorState);
    END CATCH
END
GO

PRINT 'Created procedure: usp_PurgeQueue';

-- ============================================================================
-- Add extended properties for documentation
-- ============================================================================
IF NOT EXISTS (SELECT * FROM sys.extended_properties
               WHERE major_id = OBJECT_ID('dbo.usp_PurgeQueue') AND name = 'MS_Description')
BEGIN
    EXEC sp_addextendedproperty
        @name = N'MS_Description',
        @value = N'Purges all messages from a Service Broker queue. Requires confirmation code for safety. Optionally ends associated conversations.',
        @level0type = N'SCHEMA', @level0name = N'dbo',
        @level1type = N'PROCEDURE', @level1name = N'usp_PurgeQueue';
    PRINT 'Added procedure description.';
END
GO

-- ============================================================================
-- Verification
-- ============================================================================
PRINT '';
PRINT '========================================';
PRINT 'Verification - usp_PurgeQueue';
PRINT '========================================';
PRINT '';

SELECT
    p.name AS [Procedure Name],
    p.create_date AS [Created],
    p.modify_date AS [Last Modified]
FROM sys.procedures p
WHERE p.name = N'usp_PurgeQueue';

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
WHERE par.object_id = OBJECT_ID('dbo.usp_PurgeQueue')
ORDER BY par.parameter_id;

PRINT '';
PRINT '========================================';
PRINT 'SAFETY WARNING';
PRINT '========================================';
PRINT '';
PRINT 'This procedure PERMANENTLY DELETES all messages from a queue!';
PRINT 'You MUST pass @ConfirmationCode = ''CONFIRM_PURGE'' to execute.';
PRINT '';
PRINT '========================================';
PRINT 'Usage Examples:';
PRINT '========================================';
PRINT '';
PRINT '-- Purge queue and end conversations';
PRINT 'EXEC dbo.usp_PurgeQueue';
PRINT '    @QueueName = ''MessageBusTargetQueue'',';
PRINT '    @ConfirmationCode = ''CONFIRM_PURGE'',';
PRINT '    @EndConversations = 1;';
PRINT '';
PRINT '-- Purge queue without ending conversations';
PRINT 'EXEC dbo.usp_PurgeQueue';
PRINT '    @QueueName = ''MessageBusTargetQueue'',';
PRINT '    @ConfirmationCode = ''CONFIRM_PURGE'',';
PRINT '    @EndConversations = 0;';
PRINT '';
PRINT '-- This will FAIL (safety check):';
PRINT 'EXEC dbo.usp_PurgeQueue @QueueName = ''MyQueue'', @ConfirmationCode = ''wrong'';';
PRINT '';
PRINT '========================================';
PRINT 'Script completed successfully.';
PRINT '========================================';
GO
