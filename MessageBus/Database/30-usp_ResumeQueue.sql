/*
================================================================================
Script: 30-usp_ResumeQueue.sql
Purpose: Resume a paused Service Broker queue by enabling message receiving
Phase: 0.5C - Management Stored Procedures
================================================================================
Prerequisites:
  - Phase 0 scripts (00-07) must be run first
  - Phase 0.5A scripts (10-14) must be run first
  - Phase 0.5B scripts (20-24) must be run first
================================================================================
This procedure resumes a paused queue by setting STATUS = ON, which enables
message receiving and activation procedure execution.
================================================================================
*/

USE [MessageBus]; -- Change to your target database name
GO

SET NOCOUNT ON;

PRINT '========================================';
PRINT 'Creating usp_ResumeQueue Procedure';
PRINT '========================================';
PRINT '';

-- ============================================================================
-- Procedure: usp_ResumeQueue
-- Purpose: Resume a paused Service Broker queue by enabling message receiving
-- ============================================================================
IF EXISTS (SELECT * FROM sys.procedures WHERE name = N'usp_ResumeQueue' AND schema_id = SCHEMA_ID('dbo'))
BEGIN
    DROP PROCEDURE [dbo].[usp_ResumeQueue];
    PRINT 'Dropped existing procedure: usp_ResumeQueue';
END
GO

CREATE PROCEDURE [dbo].[usp_ResumeQueue]
    @QueueName NVARCHAR(256),
    @Reason NVARCHAR(500) = NULL,               -- Optional reason for resuming
    @ApplicationName NVARCHAR(256) = NULL       -- For audit purposes
AS
BEGIN
    SET NOCOUNT ON;

    DECLARE @ErrorMessage NVARCHAR(4000);
    DECLARE @ErrorSeverity INT;
    DECLARE @ErrorState INT;

    DECLARE @SQL NVARCHAR(500);
    DECLARE @QueueSchemaName NVARCHAR(128) = 'dbo';  -- Default schema
    DECLARE @IsCurrentlyEnabled BIT;
    DECLARE @MessageCount INT = 0;
    DECLARE @IsActivationEnabled BIT;
    DECLARE @ActivationProcedure NVARCHAR(256);

    BEGIN TRY
        -- Validate queue exists and get current status
        SELECT
            @IsCurrentlyEnabled = q.is_receive_enabled,
            @IsActivationEnabled = q.is_activation_enabled,
            @ActivationProcedure = q.activation_procedure
        FROM sys.service_queues q
        WHERE q.name = @QueueName;

        IF @IsCurrentlyEnabled IS NULL
        BEGIN
            RAISERROR('Queue [%s] does not exist.', 16, 1, @QueueName);
        END

        -- Check if already active
        IF @IsCurrentlyEnabled = 1
        BEGIN
            SELECT
                @QueueName AS QueueName,
                'Active' AS PreviousStatus,
                'Active' AS NewStatus,
                'Queue was already active' AS Message;
            RETURN;
        END

        -- Get current message count for logging
        SET @SQL = N'SELECT @CountOut = COUNT(*) FROM ' + QUOTENAME(@QueueSchemaName) + N'.' + QUOTENAME(@QueueName) + N' WITH (NOLOCK)';
        EXEC sp_executesql @SQL, N'@CountOut INT OUTPUT', @CountOut = @MessageCount OUTPUT;

        -- Resume the queue
        SET @SQL = N'ALTER QUEUE ' + QUOTENAME(@QueueSchemaName) + N'.' + QUOTENAME(@QueueName) + N' WITH STATUS = ON;';
        EXEC sp_executesql @SQL;

        -- Log the action to audit trail
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
            'QUEUE_RESUMED',
            @QueueName,
            NULL,
            NULL,
            'Queue resumed with ' + CAST(@MessageCount AS NVARCHAR(20)) + ' messages to process'
                + CASE WHEN @IsActivationEnabled = 1 THEN ' | Activation: ' + ISNULL(@ActivationProcedure, 'Enabled') ELSE ' | Activation: Disabled' END
                + CASE WHEN @Reason IS NOT NULL THEN ' | Reason: ' + @Reason ELSE '' END,
            ISNULL(@ApplicationName, APP_NAME())
        );

        -- Return success info
        SELECT
            @QueueName AS QueueName,
            'Paused' AS PreviousStatus,
            'Active' AS NewStatus,
            @MessageCount AS PendingMessages,
            @IsActivationEnabled AS IsActivationEnabled,
            @ActivationProcedure AS ActivationProcedure,
            @Reason AS Reason,
            CASE
                WHEN @MessageCount > 0 AND @IsActivationEnabled = 1
                    THEN 'Queue resumed successfully - activation procedure will begin processing ' + CAST(@MessageCount AS NVARCHAR(20)) + ' pending messages'
                WHEN @MessageCount > 0 AND @IsActivationEnabled = 0
                    THEN 'Queue resumed successfully - ' + CAST(@MessageCount AS NVARCHAR(20)) + ' messages ready for manual processing (activation disabled)'
                ELSE 'Queue resumed successfully - no pending messages'
            END AS Message;

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
                'QUEUE_RESUME_FAILED',
                @QueueName,
                NULL,
                NULL,
                'ERROR: ' + @ErrorMessage,
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

PRINT 'Created procedure: usp_ResumeQueue';

-- ============================================================================
-- Add extended properties for documentation
-- ============================================================================
IF NOT EXISTS (SELECT * FROM sys.extended_properties
               WHERE major_id = OBJECT_ID('dbo.usp_ResumeQueue') AND name = 'MS_Description')
BEGIN
    EXEC sp_addextendedproperty
        @name = N'MS_Description',
        @value = N'Resumes a paused Service Broker queue by enabling message receiving (STATUS = ON). If activation is enabled, the activation procedure will begin processing pending messages.',
        @level0type = N'SCHEMA', @level0name = N'dbo',
        @level1type = N'PROCEDURE', @level1name = N'usp_ResumeQueue';
    PRINT 'Added procedure description.';
END
GO

-- ============================================================================
-- Verification
-- ============================================================================
PRINT '';
PRINT '========================================';
PRINT 'Verification - usp_ResumeQueue';
PRINT '========================================';
PRINT '';

SELECT
    p.name AS [Procedure Name],
    p.create_date AS [Created],
    p.modify_date AS [Last Modified]
FROM sys.procedures p
WHERE p.name = N'usp_ResumeQueue';

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
WHERE par.object_id = OBJECT_ID('dbo.usp_ResumeQueue')
ORDER BY par.parameter_id;

PRINT '';
PRINT '========================================';
PRINT 'Usage Examples:';
PRINT '========================================';
PRINT '';
PRINT '-- Resume a queue';
PRINT 'EXEC dbo.usp_ResumeQueue @QueueName = ''MessageBusTargetQueue'';';
PRINT '';
PRINT '-- Resume with reason';
PRINT 'EXEC dbo.usp_ResumeQueue';
PRINT '    @QueueName = ''MessageBusTargetQueue'',';
PRINT '    @Reason = ''Maintenance complete - resuming normal operations'';';
PRINT '';
PRINT '========================================';
PRINT 'Script completed successfully.';
PRINT '========================================';
GO
