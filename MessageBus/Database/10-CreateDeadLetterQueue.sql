/*
================================================================================
Script: 10-CreateDeadLetterQueue.sql
Purpose: Create the DeadLetterQueue table for storing failed messages
Phase: 0.5A - SQL Server Custom Tables
================================================================================
Prerequisites: Phase 0 scripts (00-07) must be run first
================================================================================
The DeadLetterQueue stores messages that could not be processed after multiple
retry attempts. This allows for manual review, troubleshooting, and potential
retry of failed messages.
================================================================================
*/

USE [MessageBus]; -- Change to your target database name
GO

SET NOCOUNT ON;

PRINT '========================================';
PRINT 'Creating DeadLetterQueue Table';
PRINT '========================================';
PRINT '';

-- ============================================================================
-- Table: DeadLetterQueue
-- Purpose: Store messages that failed processing for manual review/retry
-- ============================================================================
IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = N'DeadLetterQueue' AND schema_id = SCHEMA_ID('dbo'))
BEGIN
    CREATE TABLE dbo.DeadLetterQueue (
        -- Primary key
        Id BIGINT IDENTITY(1,1) PRIMARY KEY,

        -- Conversation identifiers
        ConversationHandle UNIQUEIDENTIFIER NOT NULL,
        ConversationId UNIQUEIDENTIFIER NULL,

        -- Source information
        SourceQueueName NVARCHAR(256) NOT NULL,
        ServiceName NVARCHAR(256) NULL,
        MessageTypeName NVARCHAR(256) NOT NULL,

        -- Message content
        MessageBody VARBINARY(MAX) NULL,
        MessageBodyText AS (CAST(MessageBody AS NVARCHAR(MAX))) PERSISTED,

        -- Error details
        ErrorMessage NVARCHAR(MAX) NULL,
        ErrorNumber INT NULL,

        -- Retry tracking
        RetryCount INT NOT NULL DEFAULT 0,
        MaxRetries INT NOT NULL DEFAULT 5,

        -- Timestamps
        OriginalEnqueueTime DATETIME2 NULL,
        MovedToDeadLetterAt DATETIME2 NOT NULL DEFAULT SYSDATETIME(),
        LastRetryAt DATETIME2 NULL,

        -- Resolution tracking
        ResolvedAt DATETIME2 NULL,
        ResolutionNotes NVARCHAR(MAX) NULL,
        ResolvedBy NVARCHAR(256) NULL,

        -- Indexes for common query patterns
        INDEX IX_DeadLetterQueue_ConversationHandle (ConversationHandle),
        INDEX IX_DeadLetterQueue_MovedAt (MovedToDeadLetterAt),
        INDEX IX_DeadLetterQueue_SourceQueue (SourceQueueName),
        INDEX IX_DeadLetterQueue_Unresolved (ResolvedAt) WHERE ResolvedAt IS NULL
    );

    PRINT 'Created table: dbo.DeadLetterQueue';
END
ELSE
BEGIN
    PRINT 'Table already exists: dbo.DeadLetterQueue';
END
GO

-- ============================================================================
-- Add extended properties for documentation
-- ============================================================================
IF NOT EXISTS (SELECT * FROM sys.extended_properties WHERE major_id = OBJECT_ID('dbo.DeadLetterQueue') AND name = 'MS_Description')
BEGIN
    EXEC sp_addextendedproperty
        @name = N'MS_Description',
        @value = N'Stores messages that failed processing after maximum retry attempts for manual review and potential retry.',
        @level0type = N'SCHEMA', @level0name = N'dbo',
        @level1type = N'TABLE', @level1name = N'DeadLetterQueue';

    PRINT 'Added table description.';
END
GO

-- ============================================================================
-- Verification
-- ============================================================================
PRINT '';
PRINT '========================================';
PRINT 'Verification - DeadLetterQueue Table';
PRINT '========================================';
PRINT '';

SELECT
    c.name AS [Column Name],
    t.name AS [Data Type],
    CASE
        WHEN t.name IN ('nvarchar', 'varchar', 'char', 'nchar') THEN
            CASE WHEN c.max_length = -1 THEN 'MAX' ELSE CAST(c.max_length / 2 AS VARCHAR(10)) END
        WHEN t.name IN ('varbinary', 'binary') THEN
            CASE WHEN c.max_length = -1 THEN 'MAX' ELSE CAST(c.max_length AS VARCHAR(10)) END
        ELSE ''
    END AS [Length],
    CASE c.is_nullable WHEN 1 THEN 'Yes' ELSE 'No' END AS [Nullable],
    CASE c.is_identity WHEN 1 THEN 'Yes' ELSE '' END AS [Identity],
    CASE c.is_computed WHEN 1 THEN 'Yes' ELSE '' END AS [Computed],
    ISNULL(dc.definition, '') AS [Default]
FROM sys.columns c
INNER JOIN sys.types t ON c.user_type_id = t.user_type_id
LEFT JOIN sys.default_constraints dc ON c.default_object_id = dc.object_id
WHERE c.object_id = OBJECT_ID('dbo.DeadLetterQueue')
ORDER BY c.column_id;

PRINT '';
PRINT 'Indexes:';
PRINT '--------';

SELECT
    i.name AS [Index Name],
    CASE i.type
        WHEN 0 THEN 'Heap'
        WHEN 1 THEN 'Clustered'
        WHEN 2 THEN 'Non-Clustered'
    END AS [Type],
    CASE i.is_unique WHEN 1 THEN 'Yes' ELSE 'No' END AS [Unique],
    STUFF((
        SELECT ', ' + c.name
        FROM sys.index_columns ic
        INNER JOIN sys.columns c ON ic.object_id = c.object_id AND ic.column_id = c.column_id
        WHERE ic.object_id = i.object_id AND ic.index_id = i.index_id
        ORDER BY ic.key_ordinal
        FOR XML PATH('')
    ), 1, 2, '') AS [Columns],
    ISNULL(i.filter_definition, '') AS [Filter]
FROM sys.indexes i
WHERE i.object_id = OBJECT_ID('dbo.DeadLetterQueue')
  AND i.type > 0
ORDER BY i.index_id;

PRINT '';
PRINT '========================================';
PRINT 'Script completed successfully.';
PRINT '========================================';
GO
