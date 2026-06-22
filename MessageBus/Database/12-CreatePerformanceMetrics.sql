/*
================================================================================
Script: 12-CreatePerformanceMetrics.sql
Purpose: Create the PerformanceMetrics table for queue performance tracking
Phase: 0.5A - SQL Server Custom Tables
================================================================================
Prerequisites: Phase 0 scripts (00-07) must be run first
================================================================================
The PerformanceMetrics table stores periodic snapshots of queue performance
data for historical analysis, trending, and alerting.
================================================================================
*/

USE [MessageBus]; -- Change to your target database name
GO

SET NOCOUNT ON;

PRINT '========================================';
PRINT 'Creating PerformanceMetrics Table';
PRINT '========================================';
PRINT '';

-- ============================================================================
-- Table: PerformanceMetrics
-- Purpose: Store periodic queue performance snapshots
-- ============================================================================
IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = N'PerformanceMetrics' AND schema_id = SCHEMA_ID('dbo'))
BEGIN
    CREATE TABLE dbo.PerformanceMetrics (
        -- Primary key
        Id BIGINT IDENTITY(1,1) PRIMARY KEY,

        -- Collection timestamp
        CollectionTimestamp DATETIME2 NOT NULL DEFAULT SYSDATETIME(),

        -- Queue identification
        QueueName NVARCHAR(256) NOT NULL,

        -- Queue depth metrics
        MessageCount BIGINT NOT NULL,

        -- Throughput metrics (calculated from previous sample)
        MessagesEnqueuedPerSecond DECIMAL(18,2) NULL,
        MessagesReceivedPerSecond DECIMAL(18,2) NULL,

        -- Performance metrics
        AvgProcessingTimeMs DECIMAL(18,2) NULL,
        OldestMessageAgeSeconds INT NULL,

        -- Activation metrics
        ActivationCount INT NULL,

        -- Status flags
        IsDisabled BIT NOT NULL DEFAULT 0,
        IsPoisoned BIT NOT NULL DEFAULT 0,

        -- Indexes for common query patterns
        INDEX IX_Metrics_Timestamp (CollectionTimestamp DESC),
        INDEX IX_Metrics_Queue (QueueName, CollectionTimestamp DESC),
        INDEX IX_Metrics_QueueLatest (QueueName, CollectionTimestamp DESC) INCLUDE (MessageCount, IsDisabled, IsPoisoned)
    );

    PRINT 'Created table: dbo.PerformanceMetrics';
END
ELSE
BEGIN
    PRINT 'Table already exists: dbo.PerformanceMetrics';
END
GO

-- ============================================================================
-- Add extended properties for documentation
-- ============================================================================
IF NOT EXISTS (SELECT * FROM sys.extended_properties WHERE major_id = OBJECT_ID('dbo.PerformanceMetrics') AND name = 'MS_Description')
BEGIN
    EXEC sp_addextendedproperty
        @name = N'MS_Description',
        @value = N'Stores periodic performance metric snapshots for all Service Broker queues.',
        @level0type = N'SCHEMA', @level0name = N'dbo',
        @level1type = N'TABLE', @level1name = N'PerformanceMetrics';

    PRINT 'Added table description.';
END
GO

-- ============================================================================
-- Create procedure to clean up old metrics
-- ============================================================================
IF EXISTS (SELECT * FROM sys.procedures WHERE name = N'usp_CleanupPerformanceMetrics')
BEGIN
    DROP PROCEDURE [dbo].[usp_CleanupPerformanceMetrics];
END
GO

CREATE PROCEDURE [dbo].[usp_CleanupPerformanceMetrics]
    @RetentionDays INT = 30,  -- Default: keep 30 days of metrics
    @BatchSize INT = 10000    -- Delete in batches to avoid blocking
AS
BEGIN
    SET NOCOUNT ON;

    DECLARE @CutoffDate DATETIME2 = DATEADD(DAY, -@RetentionDays, SYSDATETIME());
    DECLARE @RowsDeleted INT = 1;
    DECLARE @TotalDeleted INT = 0;

    PRINT 'Cleaning up PerformanceMetrics records older than ' + CAST(@RetentionDays AS NVARCHAR(10)) + ' days...';
    PRINT 'Cutoff date: ' + CONVERT(NVARCHAR(30), @CutoffDate, 121);

    WHILE @RowsDeleted > 0
    BEGIN
        DELETE TOP (@BatchSize)
        FROM dbo.PerformanceMetrics
        WHERE CollectionTimestamp < @CutoffDate;

        SET @RowsDeleted = @@ROWCOUNT;
        SET @TotalDeleted = @TotalDeleted + @RowsDeleted;

        IF @RowsDeleted > 0
        BEGIN
            PRINT 'Deleted batch of ' + CAST(@RowsDeleted AS NVARCHAR(10)) + ' records...';
            -- Small delay to reduce lock contention
            WAITFOR DELAY '00:00:00.100';
        END
    END

    PRINT 'Cleanup complete. Total records deleted: ' + CAST(@TotalDeleted AS NVARCHAR(10));

    -- Return summary
    SELECT
        @TotalDeleted AS TotalRecordsDeleted,
        @CutoffDate AS CutoffDate,
        @RetentionDays AS RetentionDays;
END
GO

PRINT 'Created procedure: usp_CleanupPerformanceMetrics';

-- ============================================================================
-- Create a SQL Server Agent Job for automatic cleanup (optional - manual setup)
-- This creates the job definition but doesn't enable the SQL Server Agent
-- ============================================================================
PRINT '';
PRINT '========================================';
PRINT 'Cleanup Job Setup Instructions';
PRINT '========================================';
PRINT '';
PRINT 'To set up automatic cleanup, create a SQL Server Agent job that runs:';
PRINT '';
PRINT '  EXEC dbo.usp_CleanupPerformanceMetrics @RetentionDays = 30;';
PRINT '';
PRINT 'Recommended schedule: Daily at 2:00 AM';
PRINT '';

-- ============================================================================
-- Verification
-- ============================================================================
PRINT '';
PRINT '========================================';
PRINT 'Verification - PerformanceMetrics Table';
PRINT '========================================';
PRINT '';

SELECT
    c.name AS [Column Name],
    t.name AS [Data Type],
    CASE
        WHEN t.name IN ('nvarchar', 'varchar') THEN
            CASE WHEN c.max_length = -1 THEN 'MAX' ELSE CAST(c.max_length / 2 AS VARCHAR(10)) END
        WHEN t.name = 'decimal' THEN
            '(' + CAST(c.precision AS VARCHAR(3)) + ',' + CAST(c.scale AS VARCHAR(3)) + ')'
        ELSE ''
    END AS [Precision/Length],
    CASE c.is_nullable WHEN 1 THEN 'Yes' ELSE 'No' END AS [Nullable],
    CASE c.is_identity WHEN 1 THEN 'Yes' ELSE '' END AS [Identity],
    ISNULL(dc.definition, '') AS [Default]
FROM sys.columns c
INNER JOIN sys.types t ON c.user_type_id = t.user_type_id
LEFT JOIN sys.default_constraints dc ON c.default_object_id = dc.object_id
WHERE c.object_id = OBJECT_ID('dbo.PerformanceMetrics')
ORDER BY c.column_id;

PRINT '';
PRINT 'Indexes:';
PRINT '--------';

SELECT
    i.name AS [Index Name],
    CASE i.type WHEN 1 THEN 'Clustered' WHEN 2 THEN 'Non-Clustered' END AS [Type],
    STUFF((
        SELECT ', ' + c.name
        FROM sys.index_columns ic
        INNER JOIN sys.columns c ON ic.object_id = c.object_id AND ic.column_id = c.column_id
        WHERE ic.object_id = i.object_id AND ic.index_id = i.index_id AND ic.is_included_column = 0
        ORDER BY ic.key_ordinal
        FOR XML PATH('')
    ), 1, 2, '') AS [Key Columns],
    ISNULL(STUFF((
        SELECT ', ' + c.name
        FROM sys.index_columns ic
        INNER JOIN sys.columns c ON ic.object_id = c.object_id AND ic.column_id = c.column_id
        WHERE ic.object_id = i.object_id AND ic.index_id = i.index_id AND ic.is_included_column = 1
        ORDER BY ic.index_column_id
        FOR XML PATH('')
    ), 1, 2, ''), '') AS [Included Columns]
FROM sys.indexes i
WHERE i.object_id = OBJECT_ID('dbo.PerformanceMetrics')
  AND i.type > 0
ORDER BY i.index_id;

PRINT '';
PRINT '========================================';
PRINT 'Script completed successfully.';
PRINT '========================================';
GO
