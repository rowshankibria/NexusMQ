/*
================================================================================
Script: 20-usp_SendMessage.sql
Purpose: Send messages through Service Broker with full audit support
Phase: 0.5B - Core Stored Procedures
================================================================================
Prerequisites:
  - Phase 0 scripts (00-07) must be run first
  - Phase 0.5A scripts (10-14) must be run first
================================================================================
This procedure creates new dialogs or reuses existing ones to send messages
through Service Broker, with full audit trail logging.
================================================================================
*/

USE [MessageBus]; -- Change to your target database name
GO

SET NOCOUNT ON;

PRINT '========================================';
PRINT 'Creating usp_SendMessage Procedure';
PRINT '========================================';
PRINT '';

-- ============================================================================
-- Procedure: usp_SendMessage
-- Purpose: Send a message through Service Broker with audit logging
-- ============================================================================
IF EXISTS (SELECT * FROM sys.procedures WHERE name = N'usp_SendMessage' AND schema_id = SCHEMA_ID('dbo'))
BEGIN
    DROP PROCEDURE [dbo].[usp_SendMessage];
    PRINT 'Dropped existing procedure: usp_SendMessage';
END
GO

CREATE PROCEDURE [dbo].[usp_SendMessage]
    @InitiatorService NVARCHAR(256),
    @TargetService NVARCHAR(256),
    @ContractName NVARCHAR(256),
    @MessageTypeName NVARCHAR(256),
    @MessageBody NVARCHAR(MAX),
    @Priority TINYINT = 5,
    @DialogHandle UNIQUEIDENTIFIER = NULL OUTPUT,      -- Return for continuing conversations
    @ConversationGroup UNIQUEIDENTIFIER = NULL,        -- Optional conversation group
    @DialogLifetime INT = 3600,                        -- seconds (default 1 hour)
    @UseExistingDialog BIT = 0,                        -- If 1, uses @DialogHandle to continue existing dialog
    @ApplicationName NVARCHAR(256) = NULL              -- For audit purposes
AS
BEGIN
    SET NOCOUNT ON;
    SET XACT_ABORT ON;

    DECLARE @ErrorNumber INT;
    DECLARE @ErrorMessage NVARCHAR(4000);
    DECLARE @ErrorSeverity INT;
    DECLARE @ErrorState INT;
    DECLARE @ErrorProcedure NVARCHAR(128);
    DECLARE @ErrorLine INT;
    DECLARE @ConversationId UNIQUEIDENTIFIER;
    DECLARE @MessageSizeBytes INT;
    DECLARE @MessageBodyPreview NVARCHAR(500);
    DECLARE @NewDialogCreated BIT = 0;

    -- Calculate message metadata
    SET @MessageSizeBytes = DATALENGTH(@MessageBody);
    SET @MessageBodyPreview = LEFT(@MessageBody, 500);

    BEGIN TRY
        BEGIN TRANSACTION;

        -- Validate that the initiator service exists
        IF NOT EXISTS (SELECT 1 FROM sys.services WHERE name = @InitiatorService)
        BEGIN
            RAISERROR('Initiator service [%s] does not exist.', 16, 1, @InitiatorService);
        END

        -- Validate that the target service exists (for local services)
        -- Note: For remote services, this check would fail, so we only check local
        IF NOT EXISTS (SELECT 1 FROM sys.services WHERE name = @TargetService)
        BEGIN
            -- Log a warning but don't fail - it might be a remote service
            PRINT 'Warning: Target service [' + @TargetService + '] not found locally. Assuming remote service.';
        END

        -- Validate contract exists
        IF NOT EXISTS (SELECT 1 FROM sys.service_contracts WHERE name = @ContractName)
        BEGIN
            RAISERROR('Contract [%s] does not exist.', 16, 1, @ContractName);
        END

        -- Validate message type exists
        IF NOT EXISTS (SELECT 1 FROM sys.service_message_types WHERE name = @MessageTypeName)
        BEGIN
            RAISERROR('Message type [%s] does not exist.', 16, 1, @MessageTypeName);
        END

        -- Create new dialog or use existing one
        IF @UseExistingDialog = 0 OR @DialogHandle IS NULL
        BEGIN
            -- Create new dialog
            IF @ConversationGroup IS NOT NULL
            BEGIN
                -- Use specified conversation group
                BEGIN DIALOG @DialogHandle
                    FROM SERVICE @InitiatorService
                    TO SERVICE @TargetService
                    ON CONTRACT @ContractName
                    WITH ENCRYPTION = OFF,
                         LIFETIME = @DialogLifetime,
                         RELATED_CONVERSATION_GROUP = @ConversationGroup;
            END
            ELSE
            BEGIN
                -- Let SQL Server assign conversation group
                BEGIN DIALOG @DialogHandle
                    FROM SERVICE @InitiatorService
                    TO SERVICE @TargetService
                    ON CONTRACT @ContractName
                    WITH ENCRYPTION = OFF,
                         LIFETIME = @DialogLifetime;
            END

            SET @NewDialogCreated = 1;
        END
        ELSE
        BEGIN
            -- Validate the existing dialog is still valid
            IF NOT EXISTS (
                SELECT 1
                FROM sys.conversation_endpoints
                WHERE conversation_handle = @DialogHandle
                  AND state NOT IN ('CD', 'ER', 'DI') -- Not Closed, Error, or Disconnected
            )
            BEGIN
                RAISERROR('The specified dialog handle is no longer valid or is in an error state.', 16, 1);
            END
        END

        -- Get conversation ID for audit
        SELECT @ConversationId = conversation_id
        FROM sys.conversation_endpoints
        WHERE conversation_handle = @DialogHandle;

        -- Send the message with priority (note: priority is set at dialog level, not message level in Service Broker)
        -- For actual priority handling, messages would need custom routing based on message content
        SEND ON CONVERSATION @DialogHandle
            MESSAGE TYPE @MessageTypeName (@MessageBody);

        -- Audit the send operation
        INSERT INTO dbo.MessageAuditTrail (
            ConversationHandle,
            ConversationId,
            Operation,
            QueueName,
            ServiceName,
            MessageTypeName,
            MessageBodyPreview,
            MessageSizeBytes,
            ApplicationName
        )
        VALUES (
            @DialogHandle,
            @ConversationId,
            'SEND',
            @InitiatorService + ' -> ' + @TargetService,  -- Store route info
            @InitiatorService,
            @MessageTypeName,
            @MessageBodyPreview,
            @MessageSizeBytes,
            ISNULL(@ApplicationName, APP_NAME())
        );

        COMMIT TRANSACTION;

        -- Return success info
        SELECT
            @DialogHandle AS DialogHandle,
            @ConversationId AS ConversationId,
            @NewDialogCreated AS NewDialogCreated,
            @MessageSizeBytes AS MessageSizeBytes,
            'Message sent successfully' AS Status;

    END TRY
    BEGIN CATCH
        -- Capture error details
        SET @ErrorNumber = ERROR_NUMBER();
        SET @ErrorMessage = ERROR_MESSAGE();
        SET @ErrorSeverity = ERROR_SEVERITY();
        SET @ErrorState = ERROR_STATE();
        SET @ErrorProcedure = ERROR_PROCEDURE();
        SET @ErrorLine = ERROR_LINE();

        IF @@TRANCOUNT > 0
            ROLLBACK TRANSACTION;

        -- Log the error to audit trail
        BEGIN TRY
            INSERT INTO dbo.MessageAuditTrail (
                ConversationHandle,
                ConversationId,
                Operation,
                QueueName,
                ServiceName,
                MessageTypeName,
                MessageBodyPreview,
                MessageSizeBytes,
                ApplicationName
            )
            VALUES (
                ISNULL(@DialogHandle, NEWID()),
                @ConversationId,
                'ERROR',
                @InitiatorService + ' -> ' + @TargetService,
                @InitiatorService,
                @MessageTypeName,
                'ERROR: ' + @ErrorMessage,
                @MessageSizeBytes,
                ISNULL(@ApplicationName, APP_NAME())
            );
        END TRY
        BEGIN CATCH
            -- Ignore errors in error logging
            PRINT 'Warning: Could not log error to audit trail';
        END CATCH

        -- Re-throw the error
        DECLARE @FullErrorMessage NVARCHAR(4000);
        SET @FullErrorMessage = 'Error in usp_SendMessage: ' + @ErrorMessage
            + ' (Error ' + CAST(@ErrorNumber AS NVARCHAR(10))
            + ' at line ' + CAST(@ErrorLine AS NVARCHAR(10)) + ')';

        RAISERROR(@FullErrorMessage, @ErrorSeverity, @ErrorState);
    END CATCH
END
GO

PRINT 'Created procedure: usp_SendMessage';

-- ============================================================================
-- Add extended properties for documentation
-- ============================================================================
IF NOT EXISTS (SELECT * FROM sys.extended_properties
               WHERE major_id = OBJECT_ID('dbo.usp_SendMessage') AND name = 'MS_Description')
BEGIN
    EXEC sp_addextendedproperty
        @name = N'MS_Description',
        @value = N'Sends a message through Service Broker, creating a new dialog or using an existing one. Includes full audit trail logging.',
        @level0type = N'SCHEMA', @level0name = N'dbo',
        @level1type = N'PROCEDURE', @level1name = N'usp_SendMessage';
    PRINT 'Added procedure description.';
END
GO

-- ============================================================================
-- Verification
-- ============================================================================
PRINT '';
PRINT '========================================';
PRINT 'Verification - usp_SendMessage';
PRINT '========================================';
PRINT '';

SELECT
    p.name AS [Procedure Name],
    p.create_date AS [Created],
    p.modify_date AS [Last Modified]
FROM sys.procedures p
WHERE p.name = N'usp_SendMessage';

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
WHERE par.object_id = OBJECT_ID('dbo.usp_SendMessage')
ORDER BY par.parameter_id;

PRINT '';
PRINT '========================================';
PRINT 'Script completed successfully.';
PRINT '========================================';
GO
