/*
================================================================================
Script: 23-usp_PeekMessages.sql
Purpose: Non-destructive view of messages in a Service Broker queue
Phase: 0.5B - Core Stored Procedures
================================================================================
Prerequisites:
  - Phase 0 scripts (00-07) must be run first
  - Phase 0.5A scripts (10-14) must be run first
================================================================================
This procedure allows viewing messages in a queue WITHOUT consuming them.
Useful for monitoring, debugging, and administration.
================================================================================
*/

USE [MessageBus]; -- Change to your target database name
GO

SET NOCOUNT ON;

PRINT '========================================';
PRINT 'Creating usp_PeekMessages Procedure';
PRINT '========================================';
PRINT '';

-- ============================================================================
-- Procedure: usp_PeekMessages
-- Purpose: Non-destructive view of messages in a queue (READ-ONLY)
-- ============================================================================
IF EXISTS (SELECT * FROM sys.procedures WHERE name = N'usp_PeekMessages' AND schema_id = SCHEMA_ID('dbo'))
BEGIN
    DROP PROCEDURE [dbo].[usp_PeekMessages];
    PRINT 'Dropped existing procedure: usp_PeekMessages';
END
GO

CREATE PROCEDURE [dbo].[usp_PeekMessages]
    @QueueName NVARCHAR(256),
    @PageNumber INT = 1,                           -- For pagination (1-based)
    @PageSize INT = 25,                            -- Messages per page
    @StatusFilter NVARCHAR(50) = NULL,             -- 'Ready', 'Received', or NULL for all
    @MessageTypeFilter NVARCHAR(256) = NULL        -- Filter by message type name
AS
BEGIN
    SET NOCOUNT ON;

    DECLARE @ErrorMessage NVARCHAR(4000);
    DECLARE @SQL NVARCHAR(MAX);
    DECLARE @CountSQL NVARCHAR(MAX);
    DECLARE @QueueSchemaName NVARCHAR(128) = 'dbo';  -- Default schema
    DECLARE @Offset INT;
    DECLARE @TotalCount INT;

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

        -- Validate pagination parameters
        IF @PageNumber < 1
            SET @PageNumber = 1;

        IF @PageSize < 1 OR @PageSize > 1000
            SET @PageSize = 25;

        -- Calculate offset
        SET @Offset = (@PageNumber - 1) * @PageSize;

        -- First, get total count for pagination info
        SET @CountSQL = N'
            SELECT @TotalCountOut = COUNT(*)
            FROM ' + QUOTENAME(@QueueSchemaName) + N'.' + QUOTENAME(@QueueName) + N' WITH (NOLOCK)
            WHERE 1=1';

        -- Add status filter to count query
        IF @StatusFilter IS NOT NULL
        BEGIN
            SET @CountSQL = @CountSQL + N'
              AND status = CASE @StatusFilterIn
                  WHEN ''Ready'' THEN 1
                  WHEN ''Received'' THEN 2
                  ELSE status
              END';
        END

        -- Add message type filter to count query
        IF @MessageTypeFilter IS NOT NULL
        BEGIN
            SET @CountSQL = @CountSQL + N'
              AND message_type_name = @MessageTypeFilterIn';
        END

        -- Execute count query
        EXEC sp_executesql @CountSQL,
            N'@StatusFilterIn NVARCHAR(50), @MessageTypeFilterIn NVARCHAR(256), @TotalCountOut INT OUTPUT',
            @StatusFilterIn = @StatusFilter,
            @MessageTypeFilterIn = @MessageTypeFilter,
            @TotalCountOut = @TotalCount OUTPUT;

        -- Build main SELECT query
        -- Queue tables have these columns:
        --   status, priority, queuing_order, conversation_group_id,
        --   conversation_handle, message_sequence_number, service_name,
        --   service_contract_name, message_type_name, validation, message_body
        SET @SQL = N'
            SELECT
                q.conversation_handle AS ConversationHandle,
                ce.conversation_id AS ConversationId,
                q.conversation_group_id AS ConversationGroupId,
                q.message_sequence_number AS MessageSequenceNumber,
                q.message_type_name AS MessageTypeName,
                CASE q.status
                    WHEN 0 THEN ''Received''
                    WHEN 1 THEN ''Ready''
                    ELSE ''Unknown ('' + CAST(q.status AS NVARCHAR(5)) + '')''
                END AS Status,
                q.priority AS Priority,
                q.queuing_order AS QueuingOrder,
                q.service_name AS ServiceName,
                q.service_contract_name AS ContractName,
                q.validation AS Validation,
                DATALENGTH(q.message_body) AS MessageSizeBytes,
                LEFT(CAST(q.message_body AS NVARCHAR(MAX)), 500) AS MessageBodyPreview,
                ce.far_service AS FarService,
                CASE ce.state
                    WHEN ''SO'' THEN ''Starting Outbound''
                    WHEN ''SI'' THEN ''Starting Inbound''
                    WHEN ''CO'' THEN ''Conversing''
                    WHEN ''DI'' THEN ''Disconnected''
                    WHEN ''DO'' THEN ''Disconnected Outbound''
                    WHEN ''ER'' THEN ''Error''
                    WHEN ''CD'' THEN ''Closed''
                    ELSE ce.state
                END AS ConversationState,
                ce.lifetime AS ConversationLifetime
            FROM ' + QUOTENAME(@QueueSchemaName) + N'.' + QUOTENAME(@QueueName) + N' q WITH (NOLOCK)
            LEFT JOIN sys.conversation_endpoints ce WITH (NOLOCK)
                ON q.conversation_handle = ce.conversation_handle
            WHERE 1=1';

        -- Add status filter
        IF @StatusFilter IS NOT NULL
        BEGIN
            SET @SQL = @SQL + N'
              AND q.status = CASE @StatusFilterIn
                  WHEN ''Ready'' THEN 1
                  WHEN ''Received'' THEN 0
                  ELSE q.status
              END';
        END

        -- Add message type filter
        IF @MessageTypeFilter IS NOT NULL
        BEGIN
            SET @SQL = @SQL + N'
              AND q.message_type_name = @MessageTypeFilterIn';
        END

        -- Add ordering and pagination
        SET @SQL = @SQL + N'
            ORDER BY q.queuing_order ASC
            OFFSET @OffsetIn ROWS
            FETCH NEXT @PageSizeIn ROWS ONLY';

        -- Execute main query
        EXEC sp_executesql @SQL,
            N'@StatusFilterIn NVARCHAR(50), @MessageTypeFilterIn NVARCHAR(256), @OffsetIn INT, @PageSizeIn INT',
            @StatusFilterIn = @StatusFilter,
            @MessageTypeFilterIn = @MessageTypeFilter,
            @OffsetIn = @Offset,
            @PageSizeIn = @PageSize;

        -- Return pagination info
        SELECT
            @TotalCount AS TotalMessages,
            @PageNumber AS CurrentPage,
            @PageSize AS PageSize,
            CEILING(CAST(@TotalCount AS FLOAT) / @PageSize) AS TotalPages,
            CASE WHEN @Offset + @PageSize < @TotalCount THEN 1 ELSE 0 END AS HasNextPage,
            CASE WHEN @PageNumber > 1 THEN 1 ELSE 0 END AS HasPreviousPage;

    END TRY
    BEGIN CATCH
        SET @ErrorMessage = ERROR_MESSAGE();
        DECLARE @ErrorSeverity INT = ERROR_SEVERITY();
        DECLARE @ErrorState INT = ERROR_STATE();
        RAISERROR(@ErrorMessage, @ErrorSeverity, @ErrorState);
    END CATCH
END
GO

PRINT 'Created procedure: usp_PeekMessages';

-- ============================================================================
-- Add extended properties for documentation
-- ============================================================================
IF NOT EXISTS (SELECT * FROM sys.extended_properties
               WHERE major_id = OBJECT_ID('dbo.usp_PeekMessages') AND name = 'MS_Description')
BEGIN
    EXEC sp_addextendedproperty
        @name = N'MS_Description',
        @value = N'Non-destructive view of messages in a Service Broker queue. Supports pagination and filtering by status and message type. Does NOT consume messages.',
        @level0type = N'SCHEMA', @level0name = N'dbo',
        @level1type = N'PROCEDURE', @level1name = N'usp_PeekMessages';
    PRINT 'Added procedure description.';
END
GO

-- ============================================================================
-- Verification
-- ============================================================================
PRINT '';
PRINT '========================================';
PRINT 'Verification - usp_PeekMessages';
PRINT '========================================';
PRINT '';

SELECT
    p.name AS [Procedure Name],
    p.create_date AS [Created],
    p.modify_date AS [Last Modified]
FROM sys.procedures p
WHERE p.name = N'usp_PeekMessages';

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
WHERE par.object_id = OBJECT_ID('dbo.usp_PeekMessages')
ORDER BY par.parameter_id;

PRINT '';
PRINT '========================================';
PRINT 'Usage Examples:';
PRINT '========================================';
PRINT '';
PRINT '-- View first 25 messages in a queue:';
PRINT 'EXEC dbo.usp_PeekMessages @QueueName = ''MessageBusTargetQueue'';';
PRINT '';
PRINT '-- View page 2 with 10 messages per page:';
PRINT 'EXEC dbo.usp_PeekMessages @QueueName = ''MessageBusTargetQueue'', @PageNumber = 2, @PageSize = 10;';
PRINT '';
PRINT '-- View only Ready messages:';
PRINT 'EXEC dbo.usp_PeekMessages @QueueName = ''MessageBusTargetQueue'', @StatusFilter = ''Ready'';';
PRINT '';
PRINT '-- Filter by message type:';
PRINT 'EXEC dbo.usp_PeekMessages @QueueName = ''MessageBusTargetQueue'', @MessageTypeFilter = ''//MessageBus/RequestMessage'';';
PRINT '';
PRINT '========================================';
PRINT 'Script completed successfully.';
PRINT '========================================';
GO
