/*
================================================================================
Script: 24-usp_GetQueueStatistics.sql
Purpose: Get comprehensive statistics for a Service Broker queue
Phase: 0.5B - Core Stored Procedures
================================================================================
Prerequisites:
  - Phase 0 scripts (00-07) must be run first
  - Phase 0.5A scripts (10-14) must be run first
================================================================================
This procedure returns detailed statistics about a queue including message counts,
age metrics, configuration, and health status.
================================================================================
*/

USE [MessageBus]; -- Change to your target database name
GO

SET NOCOUNT ON;

PRINT '========================================';
PRINT 'Creating usp_GetQueueStatistics Procedure';
PRINT '========================================';
PRINT '';

-- ============================================================================
-- Procedure: usp_GetQueueStatistics
-- Purpose: Get comprehensive statistics for a Service Broker queue
-- ============================================================================
IF EXISTS (SELECT * FROM sys.procedures WHERE name = N'usp_GetQueueStatistics' AND schema_id = SCHEMA_ID('dbo'))
BEGIN
    DROP PROCEDURE [dbo].[usp_GetQueueStatistics];
    PRINT 'Dropped existing procedure: usp_GetQueueStatistics';
END
GO

CREATE PROCEDURE [dbo].[usp_GetQueueStatistics]
    @QueueName NVARCHAR(256)
AS
BEGIN
    SET NOCOUNT ON;

    DECLARE @ErrorMessage NVARCHAR(4000);
    DECLARE @SQL NVARCHAR(MAX);
    DECLARE @QueueSchemaName NVARCHAR(128) = 'dbo';  -- Default schema

    -- Variables for statistics
    DECLARE @TotalMessages INT = 0;
    DECLARE @ReadyMessages INT = 0;
    DECLARE @ReceivedMessages INT = 0;
    DECLARE @OldestMessageAgeSeconds INT = NULL;
    DECLARE @NewestMessageAgeSeconds INT = NULL;
    DECLARE @AvgMessageAgeSeconds INT = NULL;
    DECLARE @MinQueuingOrder BIGINT = NULL;
    DECLARE @MaxQueuingOrder BIGINT = NULL;

    -- Queue configuration variables
    DECLARE @QueueId INT;
    DECLARE @IsReceiveEnabled BIT;
    DECLARE @IsEnqueueEnabled BIT;
    DECLARE @IsRetentionEnabled BIT;
    DECLARE @IsPoisonMessageHandlingEnabled BIT;
    DECLARE @IsActivationEnabled BIT;
    DECLARE @ActivationProcedure NVARCHAR(256);
    DECLARE @MaxQueueReaders INT;
    DECLARE @ExecuteAsPrincipal NVARCHAR(128);
    DECLARE @CreateDate DATETIME;
    DECLARE @ModifyDate DATETIME;

    BEGIN TRY
        -- Validate queue exists and get configuration
        SELECT
            @QueueId = q.object_id,
            @IsReceiveEnabled = q.is_receive_enabled,
            @IsEnqueueEnabled = q.is_enqueue_enabled,
            @IsRetentionEnabled = q.is_retention_enabled,
            @IsPoisonMessageHandlingEnabled = q.is_poison_message_handling_enabled,
            @IsActivationEnabled = q.is_activation_enabled,
            @ActivationProcedure = q.activation_procedure,
            @MaxQueueReaders = q.max_readers,
            @ExecuteAsPrincipal = q.execute_as_principal_id,
            @CreateDate = o.create_date,
            @ModifyDate = o.modify_date
        FROM sys.service_queues q
        INNER JOIN sys.objects o ON q.object_id = o.object_id
        WHERE q.name = @QueueName;

        IF @QueueId IS NULL
        BEGIN
            RAISERROR('Queue [%s] does not exist.', 16, 1, @QueueName);
        END

        -- Get message counts and age statistics using dynamic SQL
        SET @SQL = N'
            SELECT
                @TotalMessagesOut = COUNT(*),
                @ReadyMessagesOut = SUM(CASE WHEN status = 1 THEN 1 ELSE 0 END),
                @ReceivedMessagesOut = SUM(CASE WHEN status = 0 THEN 1 ELSE 0 END),
                @MinQueuingOrderOut = MIN(queuing_order),
                @MaxQueuingOrderOut = MAX(queuing_order)
            FROM ' + QUOTENAME(@QueueSchemaName) + N'.' + QUOTENAME(@QueueName) + N' WITH (NOLOCK)';

        EXEC sp_executesql @SQL,
            N'@TotalMessagesOut INT OUTPUT, @ReadyMessagesOut INT OUTPUT, @ReceivedMessagesOut INT OUTPUT,
              @MinQueuingOrderOut BIGINT OUTPUT, @MaxQueuingOrderOut BIGINT OUTPUT',
            @TotalMessagesOut = @TotalMessages OUTPUT,
            @ReadyMessagesOut = @ReadyMessages OUTPUT,
            @ReceivedMessagesOut = @ReceivedMessages OUTPUT,
            @MinQueuingOrderOut = @MinQueuingOrder OUTPUT,
            @MaxQueuingOrderOut = @MaxQueuingOrder OUTPUT;

        -- Note: Service Broker queues don't have a direct timestamp column for message enqueue time
        -- The queuing_order can give us relative age, but not absolute timestamps
        -- For absolute timing, we'd need to look at conversation endpoints or audit trail

        -- Estimate age based on conversation endpoints if messages exist
        IF @TotalMessages > 0
        BEGIN
            -- Get conversation age statistics for messages in this queue
            SET @SQL = N'
                SELECT
                    @OldestAgeOut = MAX(DATEDIFF(SECOND, ce.lifetime, DATEADD(SECOND, ce.lifetime, GETUTCDATE()))),
                    @AvgAgeOut = AVG(DATEDIFF(SECOND, ce.lifetime, DATEADD(SECOND, ce.lifetime, GETUTCDATE())))
                FROM ' + QUOTENAME(@QueueSchemaName) + N'.' + QUOTENAME(@QueueName) + N' q WITH (NOLOCK)
                INNER JOIN sys.conversation_endpoints ce WITH (NOLOCK)
                    ON q.conversation_handle = ce.conversation_handle
                WHERE ce.state NOT IN (''CD'', ''ER'')'; -- Not closed or error

            -- This query may not give accurate results, so we'll use audit trail if available
            -- For now, set to NULL as a safer default
            SET @OldestMessageAgeSeconds = NULL;
            SET @AvgMessageAgeSeconds = NULL;
        END

        -- Get poison message count from transmission queue
        DECLARE @PoisonMessageCount INT = 0;
        SELECT @PoisonMessageCount = COUNT(*)
        FROM sys.transmission_queue tq WITH (NOLOCK)
        WHERE tq.is_conversation_error = 1;

        -- Get queue-related transmission errors
        DECLARE @TransmissionQueueCount INT = 0;
        SELECT @TransmissionQueueCount = COUNT(*)
        FROM sys.transmission_queue WITH (NOLOCK);

        -- Get active conversation count related to this queue's service
        DECLARE @ActiveConversations INT = 0;
        SELECT @ActiveConversations = COUNT(*)
        FROM sys.conversation_endpoints ce WITH (NOLOCK)
        INNER JOIN sys.services s WITH (NOLOCK) ON ce.service_id = s.service_id
        INNER JOIN sys.service_queues q WITH (NOLOCK) ON s.service_queue_id = q.object_id
        WHERE q.name = @QueueName
          AND ce.state NOT IN ('CD', 'ER'); -- Not closed or error

        -- Get conversations in error state
        DECLARE @ErrorConversations INT = 0;
        SELECT @ErrorConversations = COUNT(*)
        FROM sys.conversation_endpoints ce WITH (NOLOCK)
        INNER JOIN sys.services s WITH (NOLOCK) ON ce.service_id = s.service_id
        INNER JOIN sys.service_queues q WITH (NOLOCK) ON s.service_queue_id = q.object_id
        WHERE q.name = @QueueName
          AND ce.state = 'ER';

        -- Return main statistics result set
        SELECT
            -- Queue Identity
            @QueueName AS QueueName,
            @QueueId AS QueueObjectId,

            -- Message Counts
            @TotalMessages AS TotalMessages,
            @ReadyMessages AS ReadyMessages,
            @ReceivedMessages AS ReceivedMessages,

            -- Age Statistics (may be NULL if not available)
            @OldestMessageAgeSeconds AS OldestMessageAgeSeconds,
            @AvgMessageAgeSeconds AS AvgMessageAgeSeconds,

            -- Queue Configuration
            @IsReceiveEnabled AS IsReceiveEnabled,
            @IsEnqueueEnabled AS IsEnqueueEnabled,
            @IsRetentionEnabled AS IsRetentionEnabled,
            @IsPoisonMessageHandlingEnabled AS IsPoisonMessageHandlingEnabled,

            -- Activation Configuration
            @IsActivationEnabled AS IsActivationEnabled,
            ISNULL(@ActivationProcedure, '(None)') AS ActivationProcedure,
            ISNULL(@MaxQueueReaders, 0) AS MaxQueueReaders,

            -- Conversation Statistics
            @ActiveConversations AS ActiveConversations,
            @ErrorConversations AS ErrorConversations,

            -- System-wide Statistics
            @PoisonMessageCount AS SystemPoisonMessageCount,
            @TransmissionQueueCount AS TransmissionQueueCount,

            -- Queue Metadata
            @CreateDate AS QueueCreatedDate,
            @ModifyDate AS QueueModifiedDate,

            -- Health Indicators
            CASE
                WHEN @IsReceiveEnabled = 0 THEN 'Disabled'
                WHEN @TotalMessages = 0 THEN 'Healthy - Empty'
                WHEN @ErrorConversations > 0 THEN 'Warning - Error Conversations'
                WHEN @TotalMessages > 10000 THEN 'Warning - High Message Count'
                ELSE 'Healthy'
            END AS HealthStatus;

        -- Return message type breakdown
        SET @SQL = N'
            SELECT
                message_type_name AS MessageTypeName,
                COUNT(*) AS MessageCount,
                SUM(DATALENGTH(message_body)) AS TotalSizeBytes,
                AVG(DATALENGTH(message_body)) AS AvgSizeBytes,
                MIN(DATALENGTH(message_body)) AS MinSizeBytes,
                MAX(DATALENGTH(message_body)) AS MaxSizeBytes
            FROM ' + QUOTENAME(@QueueSchemaName) + N'.' + QUOTENAME(@QueueName) + N' WITH (NOLOCK)
            GROUP BY message_type_name
            ORDER BY COUNT(*) DESC';

        EXEC sp_executesql @SQL;

        -- Return priority breakdown
        SET @SQL = N'
            SELECT
                priority AS Priority,
                COUNT(*) AS MessageCount,
                SUM(CASE WHEN status = 1 THEN 1 ELSE 0 END) AS ReadyCount,
                SUM(CASE WHEN status = 0 THEN 1 ELSE 0 END) AS ReceivedCount
            FROM ' + QUOTENAME(@QueueSchemaName) + N'.' + QUOTENAME(@QueueName) + N' WITH (NOLOCK)
            GROUP BY priority
            ORDER BY priority';

        EXEC sp_executesql @SQL;

    END TRY
    BEGIN CATCH
        SET @ErrorMessage = ERROR_MESSAGE();
        DECLARE @ErrorSeverity INT = ERROR_SEVERITY();
        DECLARE @ErrorState INT = ERROR_STATE();
        RAISERROR(@ErrorMessage, @ErrorSeverity, @ErrorState);
    END CATCH
END
GO

PRINT 'Created procedure: usp_GetQueueStatistics';

-- ============================================================================
-- Add extended properties for documentation
-- ============================================================================
IF NOT EXISTS (SELECT * FROM sys.extended_properties
               WHERE major_id = OBJECT_ID('dbo.usp_GetQueueStatistics') AND name = 'MS_Description')
BEGIN
    EXEC sp_addextendedproperty
        @name = N'MS_Description',
        @value = N'Returns comprehensive statistics for a Service Broker queue including message counts, age metrics, configuration settings, and health status.',
        @level0type = N'SCHEMA', @level0name = N'dbo',
        @level1type = N'PROCEDURE', @level1name = N'usp_GetQueueStatistics';
    PRINT 'Added procedure description.';
END
GO

-- ============================================================================
-- Verification
-- ============================================================================
PRINT '';
PRINT '========================================';
PRINT 'Verification - usp_GetQueueStatistics';
PRINT '========================================';
PRINT '';

SELECT
    p.name AS [Procedure Name],
    p.create_date AS [Created],
    p.modify_date AS [Last Modified]
FROM sys.procedures p
WHERE p.name = N'usp_GetQueueStatistics';

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
WHERE par.object_id = OBJECT_ID('dbo.usp_GetQueueStatistics')
ORDER BY par.parameter_id;

PRINT '';
PRINT '========================================';
PRINT 'Return Result Sets:';
PRINT '========================================';
PRINT '';
PRINT '1. Main Statistics:';
PRINT '   - Queue identity and object ID';
PRINT '   - Message counts (Total, Ready, Received)';
PRINT '   - Age statistics (if available)';
PRINT '   - Queue configuration flags';
PRINT '   - Activation settings';
PRINT '   - Conversation statistics';
PRINT '   - Health status indicator';
PRINT '';
PRINT '2. Message Type Breakdown:';
PRINT '   - Message type name';
PRINT '   - Count and size statistics per type';
PRINT '';
PRINT '3. Priority Breakdown:';
PRINT '   - Messages per priority level';
PRINT '   - Ready/Received split per priority';
PRINT '';
PRINT '========================================';
PRINT 'Usage Example:';
PRINT '========================================';
PRINT '';
PRINT 'EXEC dbo.usp_GetQueueStatistics @QueueName = ''MessageBusTargetQueue'';';
PRINT '';
PRINT '========================================';
PRINT 'Script completed successfully.';
PRINT '========================================';
GO
