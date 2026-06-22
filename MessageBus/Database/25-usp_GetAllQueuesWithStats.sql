/*
================================================================================
Script: 25-usp_GetAllQueuesWithStats.sql
Purpose: Get comprehensive statistics for all Service Broker queues
Phase: 0.5C - Management Stored Procedures
================================================================================
Prerequisites:
  - Phase 0 scripts (00-07) must be run first
  - Phase 0.5A scripts (10-14) must be run first
  - Phase 0.5B scripts (20-24) must be run first
================================================================================
This procedure returns detailed statistics about all queues in the database
including message counts, configuration, and health status.
================================================================================
*/

USE [MessageBus]; -- Change to your target database name
GO

SET NOCOUNT ON;

PRINT '========================================';
PRINT 'Creating usp_GetAllQueuesWithStats Procedure';
PRINT '========================================';
PRINT '';

-- ============================================================================
-- Procedure: usp_GetAllQueuesWithStats
-- Purpose: Get comprehensive statistics for all Service Broker queues
-- ============================================================================
IF EXISTS (SELECT * FROM sys.procedures WHERE name = N'usp_GetAllQueuesWithStats' AND schema_id = SCHEMA_ID('dbo'))
BEGIN
    DROP PROCEDURE [dbo].[usp_GetAllQueuesWithStats];
    PRINT 'Dropped existing procedure: usp_GetAllQueuesWithStats';
END
GO

CREATE PROCEDURE [dbo].[usp_GetAllQueuesWithStats]
    @IncludeSystemQueues BIT = 0,       -- Include system queues (like EventNotificationErrorsQueue)
    @IncludeEmptyQueues BIT = 1         -- Include queues with no messages
AS
BEGIN
    SET NOCOUNT ON;

    DECLARE @ErrorMessage NVARCHAR(4000);

    BEGIN TRY
        -- Create temp table to store queue statistics
        CREATE TABLE #QueueStats (
            QueueName NVARCHAR(256),
            SchemaName NVARCHAR(128),
            ServiceName NVARCHAR(256),
            QueueObjectId INT,
            IsActivationEnabled BIT,
            IsReceiveEnabled BIT,
            IsEnqueueEnabled BIT,
            IsRetentionEnabled BIT,
            IsPoisonMessageHandlingEnabled BIT,
            ActivationProcedure NVARCHAR(256),
            MaxReaders INT,
            MessageCount INT,
            ReadyCount INT,
            ReceivedCount INT,
            OldestMessageAge INT,  -- In seconds
            ActiveConversations INT,
            ErrorConversations INT,
            Status NVARCHAR(50),
            CreateDate DATETIME,
            ModifyDate DATETIME
        );

        -- Insert queue metadata
        INSERT INTO #QueueStats (
            QueueName,
            SchemaName,
            ServiceName,
            QueueObjectId,
            IsActivationEnabled,
            IsReceiveEnabled,
            IsEnqueueEnabled,
            IsRetentionEnabled,
            IsPoisonMessageHandlingEnabled,
            ActivationProcedure,
            MaxReaders,
            MessageCount,
            ReadyCount,
            ReceivedCount,
            OldestMessageAge,
            ActiveConversations,
            ErrorConversations,
            Status,
            CreateDate,
            ModifyDate
        )
        SELECT
            q.name AS QueueName,
            s.name AS SchemaName,
            ISNULL(svc.name, '(No Service)') AS ServiceName,
            q.object_id AS QueueObjectId,
            q.is_activation_enabled,
            q.is_receive_enabled,
            q.is_enqueue_enabled,
            q.is_retention_enabled,
            q.is_poison_message_handling_enabled,
            ISNULL(q.activation_procedure, '(None)'),
            ISNULL(q.max_readers, 0),
            0,  -- MessageCount - will be updated
            0,  -- ReadyCount - will be updated
            0,  -- ReceivedCount - will be updated
            NULL,  -- OldestMessageAge - will be updated
            0,  -- ActiveConversations - will be updated
            0,  -- ErrorConversations - will be updated
            CASE
                WHEN q.is_receive_enabled = 0 THEN 'Disabled'
                ELSE 'Active'
            END,
            o.create_date,
            o.modify_date
        FROM sys.service_queues q
        INNER JOIN sys.schemas s ON q.schema_id = s.schema_id
        INNER JOIN sys.objects o ON q.object_id = o.object_id
        LEFT JOIN sys.services svc ON svc.service_queue_id = q.object_id
        WHERE (@IncludeSystemQueues = 1 OR q.is_ms_shipped = 0);

        -- Update message counts for each queue using dynamic SQL
        DECLARE @QueueName NVARCHAR(256);
        DECLARE @SchemaName NVARCHAR(128);
        DECLARE @SQL NVARCHAR(MAX);
        DECLARE @TotalCount INT;
        DECLARE @ReadyCount INT;
        DECLARE @ReceivedCount INT;
        DECLARE @OldestAge INT;

        DECLARE queue_cursor CURSOR LOCAL FAST_FORWARD FOR
            SELECT QueueName, SchemaName
            FROM #QueueStats;

        OPEN queue_cursor;
        FETCH NEXT FROM queue_cursor INTO @QueueName, @SchemaName;

        WHILE @@FETCH_STATUS = 0
        BEGIN
            BEGIN TRY
                -- Get message counts
                SET @SQL = N'
                    SELECT
                        @TotalCountOut = COUNT(*),
                        @ReadyCountOut = SUM(CASE WHEN status = 1 THEN 1 ELSE 0 END),
                        @ReceivedCountOut = SUM(CASE WHEN status = 0 THEN 1 ELSE 0 END)
                    FROM ' + QUOTENAME(@SchemaName) + N'.' + QUOTENAME(@QueueName) + N' WITH (NOLOCK)';

                EXEC sp_executesql @SQL,
                    N'@TotalCountOut INT OUTPUT, @ReadyCountOut INT OUTPUT, @ReceivedCountOut INT OUTPUT',
                    @TotalCountOut = @TotalCount OUTPUT,
                    @ReadyCountOut = @ReadyCount OUTPUT,
                    @ReceivedCountOut = @ReceivedCount OUTPUT;

                -- Try to estimate oldest message age from audit trail
                SELECT TOP 1 @OldestAge = DATEDIFF(SECOND, mat.OperationTimestamp, SYSDATETIME())
                FROM dbo.MessageAuditTrail mat
                WHERE mat.QueueName LIKE '%' + @QueueName + '%'
                  AND mat.Operation = 'SEND'
                ORDER BY mat.OperationTimestamp ASC;

                UPDATE #QueueStats
                SET MessageCount = ISNULL(@TotalCount, 0),
                    ReadyCount = ISNULL(@ReadyCount, 0),
                    ReceivedCount = ISNULL(@ReceivedCount, 0),
                    OldestMessageAge = @OldestAge
                WHERE QueueName = @QueueName AND SchemaName = @SchemaName;

            END TRY
            BEGIN CATCH
                -- If we can't read the queue, set counts to -1 (error indicator)
                UPDATE #QueueStats
                SET MessageCount = -1,
                    ReadyCount = -1,
                    ReceivedCount = -1,
                    Status = 'Error: ' + LEFT(ERROR_MESSAGE(), 100)
                WHERE QueueName = @QueueName AND SchemaName = @SchemaName;
            END CATCH

            SET @TotalCount = NULL;
            SET @ReadyCount = NULL;
            SET @ReceivedCount = NULL;
            SET @OldestAge = NULL;

            FETCH NEXT FROM queue_cursor INTO @QueueName, @SchemaName;
        END

        CLOSE queue_cursor;
        DEALLOCATE queue_cursor;

        -- Update conversation statistics for each queue
        UPDATE qs
        SET ActiveConversations = ISNULL(conv.ActiveCount, 0),
            ErrorConversations = ISNULL(conv.ErrorCount, 0)
        FROM #QueueStats qs
        LEFT JOIN (
            SELECT
                q.name AS QueueName,
                COUNT(CASE WHEN ce.state NOT IN ('CD', 'ER') THEN 1 END) AS ActiveCount,
                COUNT(CASE WHEN ce.state = 'ER' THEN 1 END) AS ErrorCount
            FROM sys.service_queues q
            INNER JOIN sys.services svc ON svc.service_queue_id = q.object_id
            LEFT JOIN sys.conversation_endpoints ce ON ce.service_id = svc.service_id
            GROUP BY q.name
        ) conv ON qs.QueueName = conv.QueueName;

        -- Update status based on collected statistics
        UPDATE #QueueStats
        SET Status = CASE
            WHEN IsReceiveEnabled = 0 THEN 'Disabled'
            WHEN MessageCount = -1 THEN 'Error'
            WHEN ErrorConversations > 0 THEN 'Poison'
            WHEN MessageCount > 10000 THEN 'Backlog'
            WHEN MessageCount > 0 AND IsActivationEnabled = 0 THEN 'Idle'
            WHEN MessageCount > 0 THEN 'Active'
            WHEN MessageCount = 0 THEN 'Empty'
            ELSE 'Unknown'
        END;

        -- Return results (optionally filter empty queues)
        SELECT
            QueueName,
            SchemaName,
            ServiceName,
            IsActivationEnabled,
            IsReceiveEnabled,
            MaxReaders,
            MessageCount,
            ReadyCount,
            ReceivedCount,
            OldestMessageAge AS OldestMessageAgeSeconds,
            CASE
                WHEN OldestMessageAge IS NULL THEN NULL
                WHEN OldestMessageAge < 60 THEN CAST(OldestMessageAge AS NVARCHAR(20)) + 's'
                WHEN OldestMessageAge < 3600 THEN CAST(OldestMessageAge / 60 AS NVARCHAR(20)) + 'm'
                WHEN OldestMessageAge < 86400 THEN CAST(OldestMessageAge / 3600 AS NVARCHAR(20)) + 'h'
                ELSE CAST(OldestMessageAge / 86400 AS NVARCHAR(20)) + 'd'
            END AS OldestMessageAgeFormatted,
            ActiveConversations,
            ErrorConversations,
            Status,
            ActivationProcedure,
            IsEnqueueEnabled,
            IsRetentionEnabled,
            IsPoisonMessageHandlingEnabled,
            CreateDate,
            ModifyDate
        FROM #QueueStats
        WHERE (@IncludeEmptyQueues = 1 OR MessageCount > 0 OR MessageCount = -1)
        ORDER BY
            CASE Status
                WHEN 'Poison' THEN 1
                WHEN 'Error' THEN 2
                WHEN 'Backlog' THEN 3
                WHEN 'Active' THEN 4
                WHEN 'Idle' THEN 5
                WHEN 'Disabled' THEN 6
                WHEN 'Empty' THEN 7
                ELSE 8
            END,
            MessageCount DESC,
            QueueName;

        -- Return summary statistics
        SELECT
            COUNT(*) AS TotalQueues,
            SUM(CASE WHEN Status = 'Active' THEN 1 ELSE 0 END) AS ActiveQueues,
            SUM(CASE WHEN Status = 'Disabled' THEN 1 ELSE 0 END) AS DisabledQueues,
            SUM(CASE WHEN Status = 'Poison' THEN 1 ELSE 0 END) AS PoisonQueues,
            SUM(CASE WHEN Status = 'Backlog' THEN 1 ELSE 0 END) AS BacklogQueues,
            SUM(CASE WHEN Status = 'Error' THEN 1 ELSE 0 END) AS ErrorQueues,
            SUM(CASE WHEN MessageCount >= 0 THEN MessageCount ELSE 0 END) AS TotalMessages,
            SUM(ActiveConversations) AS TotalActiveConversations,
            SUM(ErrorConversations) AS TotalErrorConversations
        FROM #QueueStats;

        DROP TABLE #QueueStats;

    END TRY
    BEGIN CATCH
        SET @ErrorMessage = ERROR_MESSAGE();
        DECLARE @ErrorSeverity INT = ERROR_SEVERITY();
        DECLARE @ErrorState INT = ERROR_STATE();

        IF OBJECT_ID('tempdb..#QueueStats') IS NOT NULL
            DROP TABLE #QueueStats;

        RAISERROR(@ErrorMessage, @ErrorSeverity, @ErrorState);
    END CATCH
END
GO

PRINT 'Created procedure: usp_GetAllQueuesWithStats';

-- ============================================================================
-- Add extended properties for documentation
-- ============================================================================
IF NOT EXISTS (SELECT * FROM sys.extended_properties
               WHERE major_id = OBJECT_ID('dbo.usp_GetAllQueuesWithStats') AND name = 'MS_Description')
BEGIN
    EXEC sp_addextendedproperty
        @name = N'MS_Description',
        @value = N'Returns comprehensive statistics for all Service Broker queues including message counts, configuration settings, and health status.',
        @level0type = N'SCHEMA', @level0name = N'dbo',
        @level1type = N'PROCEDURE', @level1name = N'usp_GetAllQueuesWithStats';
    PRINT 'Added procedure description.';
END
GO

-- ============================================================================
-- Verification
-- ============================================================================
PRINT '';
PRINT '========================================';
PRINT 'Verification - usp_GetAllQueuesWithStats';
PRINT '========================================';
PRINT '';

SELECT
    p.name AS [Procedure Name],
    p.create_date AS [Created],
    p.modify_date AS [Last Modified]
FROM sys.procedures p
WHERE p.name = N'usp_GetAllQueuesWithStats';

PRINT '';
PRINT 'Parameters:';
PRINT '-----------';

SELECT
    par.name AS [Parameter],
    t.name AS [Type],
    CASE par.is_output WHEN 1 THEN 'Yes' ELSE 'No' END AS [Output]
FROM sys.parameters par
INNER JOIN sys.types t ON par.user_type_id = t.user_type_id
WHERE par.object_id = OBJECT_ID('dbo.usp_GetAllQueuesWithStats')
ORDER BY par.parameter_id;

PRINT '';
PRINT '========================================';
PRINT 'Return Result Sets:';
PRINT '========================================';
PRINT '';
PRINT '1. Queue Details:';
PRINT '   - QueueName, SchemaName, ServiceName';
PRINT '   - IsActivationEnabled, IsReceiveEnabled, MaxReaders';
PRINT '   - MessageCount, ReadyCount, ReceivedCount';
PRINT '   - OldestMessageAgeSeconds/Formatted';
PRINT '   - ActiveConversations, ErrorConversations';
PRINT '   - Status (Active, Idle, Disabled, Poison, Backlog, Error, Empty)';
PRINT '';
PRINT '2. Summary Statistics:';
PRINT '   - TotalQueues, ActiveQueues, DisabledQueues';
PRINT '   - PoisonQueues, BacklogQueues, ErrorQueues';
PRINT '   - TotalMessages, TotalActiveConversations';
PRINT '';
PRINT '========================================';
PRINT 'Usage Examples:';
PRINT '========================================';
PRINT '';
PRINT '-- Get all queues with stats';
PRINT 'EXEC dbo.usp_GetAllQueuesWithStats;';
PRINT '';
PRINT '-- Include system queues';
PRINT 'EXEC dbo.usp_GetAllQueuesWithStats @IncludeSystemQueues = 1;';
PRINT '';
PRINT '-- Only non-empty queues';
PRINT 'EXEC dbo.usp_GetAllQueuesWithStats @IncludeEmptyQueues = 0;';
PRINT '';
PRINT '========================================';
PRINT 'Script completed successfully.';
PRINT '========================================';
GO
