/*
================================================================================
Script: 35-usp_CollectPerformanceMetrics.sql
Purpose: Collect and store performance metrics for all Service Broker queues
Phase: 0.5D - Diagnostics Stored Procedures
================================================================================
Prerequisites:
  - Phase 0 scripts (00-07) must be run first
  - 12-CreatePerformanceMetrics.sql must be run first
================================================================================
This procedure is designed to be called periodically by a background job
(e.g., SQL Server Agent job every minute) to collect performance snapshots
for trend analysis and alerting.
================================================================================
*/

USE [MessageBus]; -- Change to your target database name
GO

SET NOCOUNT ON;

PRINT '========================================';
PRINT 'Creating usp_CollectPerformanceMetrics';
PRINT '========================================';
PRINT '';

-- ============================================================================
-- Drop existing procedure if it exists
-- ============================================================================
IF EXISTS (SELECT * FROM sys.procedures WHERE name = N'usp_CollectPerformanceMetrics')
BEGIN
    DROP PROCEDURE [dbo].[usp_CollectPerformanceMetrics];
    PRINT 'Dropped existing procedure.';
END
GO

-- ============================================================================
-- Procedure: usp_CollectPerformanceMetrics
-- Purpose: Collects current metrics and stores them in PerformanceMetrics table
-- ============================================================================
CREATE PROCEDURE [dbo].[usp_CollectPerformanceMetrics]
    @CalculateThroughput BIT = 1,   -- Calculate messages/second from previous sample
    @QueueNameFilter NVARCHAR(256) = NULL  -- Optional: collect only for specific queue
AS
BEGIN
    SET NOCOUNT ON;

    DECLARE @CurrentTime DATETIME2 = SYSDATETIME();
    DECLARE @RowsInserted INT = 0;

    -- ========================================================================
    -- Collect metrics for each queue
    -- ========================================================================
    INSERT INTO dbo.PerformanceMetrics (
        CollectionTimestamp,
        QueueName,
        MessageCount,
        MessagesEnqueuedPerSecond,
        MessagesReceivedPerSecond,
        AvgProcessingTimeMs,
        OldestMessageAgeSeconds,
        ActivationCount,
        IsDisabled,
        IsPoisoned
    )
    SELECT
        @CurrentTime AS CollectionTimestamp,
        q.name AS QueueName,

        -- Current message count from partition stats
        ISNULL((
            SELECT SUM(ps.row_count)
            FROM sys.dm_db_partition_stats ps
            WHERE ps.object_id = q.object_id
              AND ps.index_id IN (0, 1)
        ), 0) AS MessageCount,

        -- Throughput calculation (messages/second since last collection)
        CASE WHEN @CalculateThroughput = 1 THEN
            (
                SELECT TOP 1
                    CASE
                        WHEN DATEDIFF(SECOND, prev.CollectionTimestamp, @CurrentTime) > 0 THEN
                            CAST(
                                (ISNULL((
                                    SELECT SUM(ps.row_count)
                                    FROM sys.dm_db_partition_stats ps
                                    WHERE ps.object_id = q.object_id
                                      AND ps.index_id IN (0, 1)
                                ), 0) - prev.MessageCount)
                                / NULLIF(CAST(DATEDIFF(SECOND, prev.CollectionTimestamp, @CurrentTime) AS DECIMAL(18,2)), 0)
                            AS DECIMAL(18,2))
                        ELSE NULL
                    END
                FROM dbo.PerformanceMetrics prev
                WHERE prev.QueueName = q.name
                ORDER BY prev.CollectionTimestamp DESC
            )
        ELSE NULL END AS MessagesEnqueuedPerSecond,

        -- Received per second (would need message audit trail to calculate accurately)
        NULL AS MessagesReceivedPerSecond,

        -- Average processing time (would need message audit trail)
        NULL AS AvgProcessingTimeMs,

        -- Oldest message age (estimate based on queue having messages)
        CASE
            WHEN ISNULL((
                SELECT SUM(ps.row_count)
                FROM sys.dm_db_partition_stats ps
                WHERE ps.object_id = q.object_id
                  AND ps.index_id IN (0, 1)
            ), 0) > 0 THEN
                -- Check transmission queue for this service's messages
                (
                    SELECT DATEDIFF(SECOND, MIN(tq.enqueue_time), @CurrentTime)
                    FROM sys.transmission_queue tq
                    INNER JOIN sys.services s ON tq.from_service_name = s.name
                    WHERE s.service_queue_id = q.object_id
                )
            ELSE 0
        END AS OldestMessageAgeSeconds,

        -- Activation count (current activation procedures running)
        NULL AS ActivationCount,

        -- Is queue disabled?
        CASE WHEN q.is_receive_enabled = 0 THEN 1 ELSE 0 END AS IsDisabled,

        -- Is queue in poison message state?
        -- A queue is considered "poisoned" if activation is enabled but no readers
        -- and there are messages in the queue. This is a heuristic.
        CASE
            WHEN q.is_receive_enabled = 0
                 AND q.is_activation_enabled = 1
                 AND q.is_poison_message_handling_enabled = 1
                 AND ISNULL((
                     SELECT SUM(ps.row_count)
                     FROM sys.dm_db_partition_stats ps
                     WHERE ps.object_id = q.object_id
                       AND ps.index_id IN (0, 1)
                 ), 0) > 0
            THEN 1
            ELSE 0
        END AS IsPoisoned

    FROM sys.service_queues q
    WHERE
        q.is_ms_shipped = 0  -- Exclude system queues
        AND (@QueueNameFilter IS NULL OR q.name = @QueueNameFilter);

    SET @RowsInserted = @@ROWCOUNT;

    -- ========================================================================
    -- Return collection summary
    -- ========================================================================
    SELECT
        @CurrentTime AS CollectionTimestamp,
        @RowsInserted AS QueuesCollected,
        'Success' AS Status;

    -- Return the metrics just collected
    SELECT
        QueueName,
        MessageCount,
        MessagesEnqueuedPerSecond,
        OldestMessageAgeSeconds,
        IsDisabled,
        IsPoisoned
    FROM dbo.PerformanceMetrics
    WHERE CollectionTimestamp = @CurrentTime
    ORDER BY QueueName;

END
GO

PRINT 'Created procedure: usp_CollectPerformanceMetrics';

-- ============================================================================
-- Verification
-- ============================================================================
PRINT '';
PRINT '========================================';
PRINT 'Verification';
PRINT '========================================';
PRINT '';

-- Verify procedure exists
IF EXISTS (SELECT * FROM sys.procedures WHERE name = N'usp_CollectPerformanceMetrics')
BEGIN
    PRINT 'SUCCESS: Procedure usp_CollectPerformanceMetrics created.';

    -- Show procedure parameters
    SELECT
        p.name AS [Parameter],
        t.name AS [Type],
        CASE
            WHEN t.name IN ('nvarchar', 'varchar') THEN
                CASE WHEN p.max_length = -1 THEN 'MAX' ELSE CAST(p.max_length / 2 AS VARCHAR(10)) END
            ELSE ''
        END AS [Length],
        CASE p.has_default_value WHEN 1 THEN 'Yes' ELSE 'No' END AS [Has Default]
    FROM sys.parameters p
    INNER JOIN sys.types t ON p.user_type_id = t.user_type_id
    WHERE p.object_id = OBJECT_ID('dbo.usp_CollectPerformanceMetrics')
    ORDER BY p.parameter_id;
END
ELSE
BEGIN
    PRINT 'ERROR: Procedure was not created.';
END

PRINT '';
PRINT '========================================';
PRINT 'SQL Agent Job Setup';
PRINT '========================================';
PRINT '';
PRINT 'To set up automatic metric collection, create a SQL Server Agent job:';
PRINT '';
PRINT 'Job Name: MessageBus_CollectMetrics';
PRINT 'Schedule: Every 1 minute';
PRINT 'Step Command:';
PRINT '  EXEC dbo.usp_CollectPerformanceMetrics;';
PRINT '';
PRINT 'Also schedule the cleanup job:';
PRINT '  EXEC dbo.usp_CleanupPerformanceMetrics @RetentionDays = 30;';
PRINT '  Schedule: Daily at 2:00 AM';
PRINT '';
PRINT '========================================';
PRINT 'Usage Examples';
PRINT '========================================';
PRINT '';
PRINT '-- Collect metrics for all queues:';
PRINT 'EXEC dbo.usp_CollectPerformanceMetrics;';
PRINT '';
PRINT '-- Collect metrics without throughput calculation:';
PRINT 'EXEC dbo.usp_CollectPerformanceMetrics @CalculateThroughput = 0;';
PRINT '';
PRINT '-- Collect metrics for a specific queue:';
PRINT 'EXEC dbo.usp_CollectPerformanceMetrics @QueueNameFilter = N''RequestQueue'';';
PRINT '';
PRINT '========================================';
PRINT 'Script completed successfully.';
PRINT '========================================';
GO
