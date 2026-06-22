/*
================================================================================
Script: 11-CreateMessageAuditTrail.sql
Purpose: Create the MessageAuditTrail table for tracking all message operations
Phase: 0.5A - SQL Server Custom Tables
================================================================================
Prerequisites: Phase 0 scripts (00-07) must be run first
================================================================================
The MessageAuditTrail provides a complete audit log of all message operations
(SEND, RECEIVE, END_CONVERSATION) for debugging, compliance, and monitoring.
================================================================================
*/

USE [MessageBus]; -- Change to your target database name
GO

SET NOCOUNT ON;

PRINT '========================================';
PRINT 'Creating MessageAuditTrail Table';
PRINT '========================================';
PRINT '';

-- ============================================================================
-- Table: MessageAuditTrail
-- Purpose: Audit log for all message bus operations
-- ============================================================================
IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = N'MessageAuditTrail' AND schema_id = SCHEMA_ID('dbo'))
BEGIN
    CREATE TABLE dbo.MessageAuditTrail (
        -- Primary key
        Id BIGINT IDENTITY(1,1) PRIMARY KEY,

        -- Conversation identifiers
        ConversationHandle UNIQUEIDENTIFIER NOT NULL,
        ConversationId UNIQUEIDENTIFIER NULL,

        -- Operation details
        Operation NVARCHAR(50) NOT NULL, -- 'SEND', 'RECEIVE', 'END_CONVERSATION', 'ERROR'
        QueueName NVARCHAR(256) NOT NULL,
        ServiceName NVARCHAR(256) NULL,
        MessageTypeName NVARCHAR(256) NULL,

        -- Message metadata
        MessageSequenceNumber BIGINT NULL,
        MessageBodyPreview NVARCHAR(500) NULL, -- First 500 chars for quick view
        MessageSizeBytes INT NULL,

        -- Timestamp
        OperationTimestamp DATETIME2 NOT NULL DEFAULT SYSDATETIME(),

        -- Context information
        ApplicationName NVARCHAR(256) NULL,
        UserName NVARCHAR(256) NULL DEFAULT SUSER_SNAME(),
        HostName NVARCHAR(256) NULL DEFAULT HOST_NAME(),

        -- Indexes for common query patterns
        INDEX IX_Audit_ConversationHandle (ConversationHandle),
        INDEX IX_Audit_Timestamp (OperationTimestamp DESC),
        INDEX IX_Audit_Queue (QueueName, OperationTimestamp DESC),
        INDEX IX_Audit_Operation (Operation, OperationTimestamp DESC)
    );

    PRINT 'Created table: dbo.MessageAuditTrail';
END
ELSE
BEGIN
    PRINT 'Table already exists: dbo.MessageAuditTrail';
END
GO

-- ============================================================================
-- Add extended properties for documentation
-- ============================================================================
IF NOT EXISTS (SELECT * FROM sys.extended_properties WHERE major_id = OBJECT_ID('dbo.MessageAuditTrail') AND name = 'MS_Description')
BEGIN
    EXEC sp_addextendedproperty
        @name = N'MS_Description',
        @value = N'Audit trail for all Service Broker message operations including SEND, RECEIVE, and END_CONVERSATION.',
        @level0type = N'SCHEMA', @level0name = N'dbo',
        @level1type = N'TABLE', @level1name = N'MessageAuditTrail';

    PRINT 'Added table description.';
END
GO

-- ============================================================================
-- Create procedure to clean up old audit records
-- ============================================================================
IF EXISTS (SELECT * FROM sys.procedures WHERE name = N'usp_CleanupAuditTrail')
BEGIN
    DROP PROCEDURE [dbo].[usp_CleanupAuditTrail];
END
GO

CREATE PROCEDURE [dbo].[usp_CleanupAuditTrail]
    @RetentionDays INT = 90,  -- Default: keep 90 days of audit data
    @BatchSize INT = 10000    -- Delete in batches to avoid blocking
AS
BEGIN
    SET NOCOUNT ON;

    DECLARE @CutoffDate DATETIME2 = DATEADD(DAY, -@RetentionDays, SYSDATETIME());
    DECLARE @RowsDeleted INT = 1;
    DECLARE @TotalDeleted INT = 0;

    PRINT 'Cleaning up MessageAuditTrail records older than ' + CAST(@RetentionDays AS NVARCHAR(10)) + ' days...';
    PRINT 'Cutoff date: ' + CONVERT(NVARCHAR(30), @CutoffDate, 121);

    WHILE @RowsDeleted > 0
    BEGIN
        DELETE TOP (@BatchSize)
        FROM dbo.MessageAuditTrail
        WHERE OperationTimestamp < @CutoffDate;

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

PRINT 'Created procedure: usp_CleanupAuditTrail';

-- ============================================================================
-- Verification
-- ============================================================================
PRINT '';
PRINT '========================================';
PRINT 'Verification - MessageAuditTrail Table';
PRINT '========================================';
PRINT '';

SELECT
    c.name AS [Column Name],
    t.name AS [Data Type],
    CASE
        WHEN t.name IN ('nvarchar', 'varchar', 'char', 'nchar') THEN
            CASE WHEN c.max_length = -1 THEN 'MAX' ELSE CAST(c.max_length / 2 AS VARCHAR(10)) END
        ELSE ''
    END AS [Length],
    CASE c.is_nullable WHEN 1 THEN 'Yes' ELSE 'No' END AS [Nullable],
    CASE c.is_identity WHEN 1 THEN 'Yes' ELSE '' END AS [Identity],
    ISNULL(dc.definition, '') AS [Default]
FROM sys.columns c
INNER JOIN sys.types t ON c.user_type_id = t.user_type_id
LEFT JOIN sys.default_constraints dc ON c.default_object_id = dc.object_id
WHERE c.object_id = OBJECT_ID('dbo.MessageAuditTrail')
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
        WHERE ic.object_id = i.object_id AND ic.index_id = i.index_id
        ORDER BY ic.key_ordinal
        FOR XML PATH('')
    ), 1, 2, '') AS [Columns]
FROM sys.indexes i
WHERE i.object_id = OBJECT_ID('dbo.MessageAuditTrail')
  AND i.type > 0
ORDER BY i.index_id;

PRINT '';
PRINT '========================================';
PRINT 'Script completed successfully.';
PRINT '========================================';
GO
