/*
================================================================================
Script: 36-usp_GetPerformanceMetrics.sql
Purpose: Retrieve historical performance metrics with filtering and aggregation
Phase: 0.5D - Diagnostics Stored Procedures
================================================================================
Prerequisites:
  - Phase 0 scripts (00-07) must be run first
  - 12-CreatePerformanceMetrics.sql must be run first
  - 35-usp_CollectPerformanceMetrics.sql for populating data
================================================================================
This procedure retrieves historical performance metrics with flexible filtering
options for trend analysis and dashboard displays.
================================================================================
*/

USE [MessageBus]; -- Change to your target database name
GO

SET NOCOUNT ON;

PRINT '========================================';
PRINT 'Creating usp_GetPerformanceMetrics';
PRINT '========================================';
PRINT '';

-- ============================================================================
-- Drop existing procedure if it exists
-- ============================================================================
IF EXISTS (SELECT * FROM sys.procedures WHERE name = N'usp_GetPerformanceMetrics')
BEGIN
    DROP PROCEDURE [dbo].[usp_GetPerformanceMetrics];
    PRINT 'Dropped existing procedure.';
END
GO

-- ============================================================================
-- Procedure: usp_GetPerformanceMetrics
-- Purpose: Retrieve performance metrics with filtering and optional aggregation
-- ============================================================================
CREATE PROCEDURE [dbo].[usp_GetPerformanceMetrics]
    @QueueName NVARCHAR(256) = NULL,    -- Filter by specific queue (NULL = all)
    @HoursBack INT = 24,                 -- How many hours of history
    @AggregationMinutes INT = 0,         -- 0 = no aggregation, >0 = aggregate by N minutes
    @OnlyDisabled BIT = 0,               -- Only show periods where queue was disabled
    @OnlyPoisoned BIT = 0,               -- Only show periods where queue was poisoned
    @TopN INT = 1000                     -- Limit results (0 = no limit)
AS
BEGIN
    SET NOCOUNT ON;

    DECLARE @StartTime DATETIME2 = DATEADD(HOUR, -@HoursBack, SYSDATETIME());

    -- ========================================================================
    -- Raw data retrieval (no aggregation)
    -- ========================================================================
    IF @AggregationMinutes = 0
    BEGIN
        IF @TopN > 0
        BEGIN
            SELECT TOP (@TopN)
                pm.Id,
                pm.CollectionTimestamp,
                pm.QueueName,
                pm.MessageCount,
                pm.MessagesEnqueuedPerSecond,
                pm.MessagesReceivedPerSecond,
                pm.AvgProcessingTimeMs,
                pm.OldestMessageAgeSeconds,
                pm.ActivationCount,
                pm.IsDisabled,
                pm.IsPoisoned
            FROM dbo.PerformanceMetrics pm
            WHERE
                (@QueueName IS NULL OR pm.QueueName = @QueueName)
                AND pm.CollectionTimestamp >= @StartTime
                AND (@OnlyDisabled = 0 OR pm.IsDisabled = 1)
                AND (@OnlyPoisoned = 0 OR pm.IsPoisoned = 1)
            ORDER BY pm.CollectionTimestamp DESC;
        END
        ELSE
        BEGIN
            SELECT
                pm.Id,
                pm.CollectionTimestamp,
                pm.QueueName,
                pm.MessageCount,
                pm.MessagesEnqueuedPerSecond,
                pm.MessagesReceivedPerSecond,
                pm.AvgProcessingTimeMs,
                pm.OldestMessageAgeSeconds,
                pm.ActivationCount,
                pm.IsDisabled,
                pm.IsPoisoned
            FROM dbo.PerformanceMetrics pm
            WHERE
                (@QueueName IS NULL OR pm.QueueName = @QueueName)
                AND pm.CollectionTimestamp >= @StartTime
                AND (@OnlyDisabled = 0 OR pm.IsDisabled = 1)
                AND (@OnlyPoisoned = 0 OR pm.IsPoisoned = 1)
            ORDER BY pm.CollectionTimestamp DESC;
        END
    END
    -- ========================================================================
    -- Aggregated data retrieval
    -- ========================================================================
    ELSE
    BEGIN
        ;WITH AggregatedMetrics AS (
            SELECT
                pm.QueueName,
                -- Create time buckets based on aggregation interval
                DATEADD(MINUTE,
                    (DATEDIFF(MINUTE, '2000-01-01', pm.CollectionTimestamp) / @AggregationMinutes) * @AggregationMinutes,
                    '2000-01-01') AS TimeBucket,

                -- Aggregations
                AVG(CAST(pm.MessageCount AS FLOAT)) AS AvgMessageCount,
                MAX(pm.MessageCount) AS MaxMessageCount,
                MIN(pm.MessageCount) AS MinMessageCount,

                AVG(pm.MessagesEnqueuedPerSecond) AS AvgEnqueuedPerSecond,
                MAX(pm.MessagesEnqueuedPerSecond) AS MaxEnqueuedPerSecond,

                AVG(pm.MessagesReceivedPerSecond) AS AvgReceivedPerSecond,
                MAX(pm.MessagesReceivedPerSecond) AS MaxReceivedPerSecond,

                AVG(pm.AvgProcessingTimeMs) AS AvgProcessingTimeMs,
                MAX(pm.AvgProcessingTimeMs) AS MaxProcessingTimeMs,

                AVG(CAST(pm.OldestMessageAgeSeconds AS FLOAT)) AS AvgOldestMessageAge,
                MAX(pm.OldestMessageAgeSeconds) AS MaxOldestMessageAge,

                -- Count occurrences of disabled/poisoned states in the bucket
                SUM(CASE WHEN pm.IsDisabled = 1 THEN 1 ELSE 0 END) AS DisabledCount,
                SUM(CASE WHEN pm.IsPoisoned = 1 THEN 1 ELSE 0 END) AS PoisonedCount,
                COUNT(*) AS SampleCount

            FROM dbo.PerformanceMetrics pm
            WHERE
                (@QueueName IS NULL OR pm.QueueName = @QueueName)
                AND pm.CollectionTimestamp >= @StartTime
            GROUP BY
                pm.QueueName,
                DATEADD(MINUTE,
                    (DATEDIFF(MINUTE, '2000-01-01', pm.CollectionTimestamp) / @AggregationMinutes) * @AggregationMinutes,
                    '2000-01-01')
        )
        SELECT
            am.QueueName,
            am.TimeBucket,
            CAST(am.AvgMessageCount AS BIGINT) AS AvgMessageCount,
            am.MaxMessageCount,
            am.MinMessageCount,
            CAST(am.AvgEnqueuedPerSecond AS DECIMAL(18,2)) AS AvgEnqueuedPerSecond,
            CAST(am.MaxEnqueuedPerSecond AS DECIMAL(18,2)) AS MaxEnqueuedPerSecond,
            CAST(am.AvgReceivedPerSecond AS DECIMAL(18,2)) AS AvgReceivedPerSecond,
            CAST(am.MaxReceivedPerSecond AS DECIMAL(18,2)) AS MaxReceivedPerSecond,
            CAST(am.AvgProcessingTimeMs AS DECIMAL(18,2)) AS AvgProcessingTimeMs,
            CAST(am.MaxProcessingTimeMs AS DECIMAL(18,2)) AS MaxProcessingTimeMs,
            CAST(am.AvgOldestMessageAge AS INT) AS AvgOldestMessageAgeSeconds,
            am.MaxOldestMessageAge AS MaxOldestMessageAgeSeconds,
            am.DisabledCount,
            am.PoisonedCount,
            am.SampleCount,
            @AggregationMinutes AS AggregationMinutes
        FROM AggregatedMetrics am
        WHERE
            (@OnlyDisabled = 0 OR am.DisabledCount > 0)
            AND (@OnlyPoisoned = 0 OR am.PoisonedCount > 0)
        ORDER BY am.QueueName, am.TimeBucket DESC;
    END

    -- ========================================================================
    -- Summary statistics
    -- ========================================================================
    SELECT
        pm.QueueName,
        COUNT(*) AS TotalSamples,
        MIN(pm.CollectionTimestamp) AS EarliestSample,
        MAX(pm.CollectionTimestamp) AS LatestSample,
        AVG(CAST(pm.MessageCount AS FLOAT)) AS AvgMessageCount,
        MAX(pm.MessageCount) AS PeakMessageCount,
        AVG(pm.MessagesEnqueuedPerSecond) AS AvgThroughput,
        SUM(CASE WHEN pm.IsDisabled = 1 THEN 1 ELSE 0 END) AS DisabledSamples,
        SUM(CASE WHEN pm.IsPoisoned = 1 THEN 1 ELSE 0 END) AS PoisonedSamples,
        CAST(100.0 * SUM(CASE WHEN pm.IsDisabled = 1 THEN 1 ELSE 0 END) / NULLIF(COUNT(*), 0) AS DECIMAL(5,2)) AS DisabledPercent,
        CAST(100.0 * SUM(CASE WHEN pm.IsPoisoned = 1 THEN 1 ELSE 0 END) / NULLIF(COUNT(*), 0) AS DECIMAL(5,2)) AS PoisonedPercent
    FROM dbo.PerformanceMetrics pm
    WHERE
        (@QueueName IS NULL OR pm.QueueName = @QueueName)
        AND pm.CollectionTimestamp >= @StartTime
    GROUP BY pm.QueueName
    ORDER BY pm.QueueName;

END
GO

PRINT 'Created procedure: usp_GetPerformanceMetrics';

-- ============================================================================
-- Verification
-- ============================================================================
PRINT '';
PRINT '========================================';
PRINT 'Verification';
PRINT '========================================';
PRINT '';

-- Verify procedure exists
IF EXISTS (SELECT * FROM sys.procedures WHERE name = N'usp_GetPerformanceMetrics')
BEGIN
    PRINT 'SUCCESS: Procedure usp_GetPerformanceMetrics created.';

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
    WHERE p.object_id = OBJECT_ID('dbo.usp_GetPerformanceMetrics')
    ORDER BY p.parameter_id;
END
ELSE
BEGIN
    PRINT 'ERROR: Procedure was not created.';
END

PRINT '';
PRINT '========================================';
PRINT 'Usage Examples';
PRINT '========================================';
PRINT '';
PRINT '-- Get all metrics from the last 24 hours:';
PRINT 'EXEC dbo.usp_GetPerformanceMetrics;';
PRINT '';
PRINT '-- Get metrics for a specific queue:';
PRINT 'EXEC dbo.usp_GetPerformanceMetrics @QueueName = N''RequestQueue'';';
PRINT '';
PRINT '-- Get metrics from the last 48 hours:';
PRINT 'EXEC dbo.usp_GetPerformanceMetrics @HoursBack = 48;';
PRINT '';
PRINT '-- Get aggregated metrics (hourly buckets):';
PRINT 'EXEC dbo.usp_GetPerformanceMetrics @AggregationMinutes = 60;';
PRINT '';
PRINT '-- Get 5-minute aggregations for the last 6 hours:';
PRINT 'EXEC dbo.usp_GetPerformanceMetrics';
PRINT '    @HoursBack = 6,';
PRINT '    @AggregationMinutes = 5;';
PRINT '';
PRINT '-- Get only periods when queue was disabled:';
PRINT 'EXEC dbo.usp_GetPerformanceMetrics @OnlyDisabled = 1;';
PRINT '';
PRINT '-- Get only periods when queue was poisoned:';
PRINT 'EXEC dbo.usp_GetPerformanceMetrics @OnlyPoisoned = 1;';
PRINT '';
PRINT '-- Get top 100 most recent metrics:';
PRINT 'EXEC dbo.usp_GetPerformanceMetrics @TopN = 100;';
PRINT '';
PRINT '========================================';
PRINT 'Script completed successfully.';
PRINT '========================================';
GO
