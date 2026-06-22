/*
================================================================================
Script: 05-CreateActivationProcedure.sql
Purpose: Create the internal activation procedure for processing messages
Phase: 0 - SQL Server Service Broker Foundation
================================================================================
Prerequisites:
  - 00-EnableServiceBroker.sql
  - 01-CreateMessageTypes.sql
  - 02-CreateContracts.sql
  - 03-CreateQueues.sql
  - 04-CreateServices.sql
================================================================================
This procedure is automatically invoked by Service Broker when messages arrive
in the MessageBusTargetQueue. It processes messages and handles responses.
================================================================================
*/

USE [MessageBus]; -- Change to your target database name
GO

SET NOCOUNT ON;

PRINT '========================================';
PRINT 'Creating Activation Procedure';
PRINT '========================================';
PRINT '';

-- ============================================================================
-- Procedure: usp_MessageBusTargetActivation
-- Purpose: Internal activation procedure called by Service Broker
-- ============================================================================

IF EXISTS (SELECT * FROM sys.procedures WHERE name = N'usp_MessageBusTargetActivation')
BEGIN
    DROP PROCEDURE [dbo].[usp_MessageBusTargetActivation];
    PRINT 'Dropped existing procedure: usp_MessageBusTargetActivation';
END
GO

CREATE PROCEDURE [dbo].[usp_MessageBusTargetActivation]
AS
BEGIN
    SET NOCOUNT ON;

    DECLARE @ConversationHandle UNIQUEIDENTIFIER;
    DECLARE @MessageTypeName NVARCHAR(256);
    DECLARE @MessageBody VARBINARY(MAX);
    DECLARE @MessageBodyXML XML;
    DECLARE @ErrorMessage NVARCHAR(4000);
    DECLARE @ErrorSeverity INT;
    DECLARE @ErrorState INT;

    -- Process messages in a loop until the queue is empty
    WHILE (1 = 1)
    BEGIN
        BEGIN TRY
            BEGIN TRANSACTION;

            -- Wait for a message with a 5 second timeout
            -- WAITFOR is important to prevent busy-waiting when queue is empty
            WAITFOR (
                RECEIVE TOP(1)
                    @ConversationHandle = conversation_handle,
                    @MessageTypeName = message_type_name,
                    @MessageBody = message_body
                FROM [MessageBusTargetQueue]
            ), TIMEOUT 5000;

            -- If no message received, exit the loop
            IF @ConversationHandle IS NULL
            BEGIN
                ROLLBACK TRANSACTION;
                BREAK;
            END

            -- Process message based on type
            -- ================================================================
            -- Handle RequestMessage
            -- ================================================================
            IF @MessageTypeName = N'RequestMessage'
            BEGIN
                BEGIN TRY
                    -- Convert to XML for processing
                    SET @MessageBodyXML = CAST(@MessageBody AS XML);

                    -- ========================================================
                    -- PLACEHOLDER: Add your message processing logic here
                    -- This is where you would:
                    --   1. Parse the request XML
                    --   2. Perform the requested operation
                    --   3. Build the response
                    -- ========================================================

                    -- Example: Log the received message (for debugging)
                    -- In production, you would route to appropriate handlers

                    -- Send acknowledgement/response back to initiator
                    DECLARE @ResponseXML XML;
                    SET @ResponseXML = (
                        SELECT
                            GETUTCDATE() AS ProcessedAt,
                            'Message received and processed successfully' AS Status,
                            @MessageBodyXML AS OriginalRequest
                        FOR XML PATH('Response'), TYPE
                    );

                    -- Send response message
                    SEND ON CONVERSATION @ConversationHandle
                        MESSAGE TYPE [ResponseMessage]
                        (@ResponseXML);

                    -- End the conversation from the target side
                    END CONVERSATION @ConversationHandle;

                END TRY
                BEGIN CATCH
                    -- Build error response
                    DECLARE @ErrorXML XML;
                    SET @ErrorXML = (
                        SELECT
                            ERROR_NUMBER() AS ErrorNumber,
                            ERROR_MESSAGE() AS ErrorMessage,
                            ERROR_SEVERITY() AS Severity,
                            ERROR_STATE() AS State,
                            ERROR_PROCEDURE() AS ErrorProcedure,
                            ERROR_LINE() AS ErrorLine,
                            GETUTCDATE() AS ErrorTime
                        FOR XML PATH('Error'), TYPE
                    );

                    -- Send error message back to initiator
                    SEND ON CONVERSATION @ConversationHandle
                        MESSAGE TYPE [ErrorMessage]
                        (@ErrorXML);

                    -- End conversation with error
                    END CONVERSATION @ConversationHandle
                        WITH ERROR = 500 DESCRIPTION = N'Error processing request';
                END CATCH
            END

            -- ================================================================
            -- Handle ErrorMessage
            -- ================================================================
            ELSE IF @MessageTypeName = N'ErrorMessage'
            BEGIN
                -- Log the error (in production, write to error log table)
                SET @MessageBodyXML = CAST(@MessageBody AS XML);

                -- For now, just end the conversation
                END CONVERSATION @ConversationHandle;
            END

            -- ================================================================
            -- Handle AcknowledgementMessage
            -- ================================================================
            ELSE IF @MessageTypeName = N'AcknowledgementMessage'
            BEGIN
                -- Process acknowledgement if needed
                -- Usually just continue processing
                NULL;
            END

            -- ================================================================
            -- Handle End Dialog message (conversation ended by initiator)
            -- ================================================================
            ELSE IF @MessageTypeName = N'http://schemas.microsoft.com/SQL/ServiceBroker/EndDialog'
            BEGIN
                -- Clean up - end conversation on our side
                END CONVERSATION @ConversationHandle;
            END

            -- ================================================================
            -- Handle Dialog Timer message
            -- ================================================================
            ELSE IF @MessageTypeName = N'http://schemas.microsoft.com/SQL/ServiceBroker/DialogTimer'
            BEGIN
                -- Handle timeout - end conversation
                END CONVERSATION @ConversationHandle;
            END

            -- ================================================================
            -- Handle Error message (Service Broker error)
            -- ================================================================
            ELSE IF @MessageTypeName = N'http://schemas.microsoft.com/SQL/ServiceBroker/Error'
            BEGIN
                -- Log Service Broker error and end conversation
                END CONVERSATION @ConversationHandle;
            END

            -- ================================================================
            -- Handle unknown message types
            -- ================================================================
            ELSE
            BEGIN
                -- Unknown message type - log and end conversation
                END CONVERSATION @ConversationHandle
                    WITH ERROR = 400 DESCRIPTION = N'Unknown message type received';
            END

            COMMIT TRANSACTION;

        END TRY
        BEGIN CATCH
            -- Handle any errors that occurred outside message processing
            SET @ErrorMessage = ERROR_MESSAGE();
            SET @ErrorSeverity = ERROR_SEVERITY();
            SET @ErrorState = ERROR_STATE();

            IF @@TRANCOUNT > 0
                ROLLBACK TRANSACTION;

            -- Log the error (in production, write to error log table)
            -- RAISERROR would cause the transaction to roll back,
            -- which is handled by poison message handling after 5 attempts

            -- Re-throw to trigger poison message handling if persistent
            RAISERROR(@ErrorMessage, @ErrorSeverity, @ErrorState);

            -- Exit the loop on error
            BREAK;
        END CATCH

        -- Reset variables for next iteration
        SET @ConversationHandle = NULL;
        SET @MessageTypeName = NULL;
        SET @MessageBody = NULL;
        SET @MessageBodyXML = NULL;
    END
END
GO

PRINT 'Created procedure: usp_MessageBusTargetActivation';
PRINT '';

-- ============================================================================
-- Verification
-- ============================================================================
PRINT '========================================';
PRINT 'Verification - Procedure Created';
PRINT '========================================';
PRINT '';

SELECT
    SCHEMA_NAME(schema_id) + '.' + name AS [Procedure Name],
    create_date AS [Created],
    modify_date AS [Modified]
FROM sys.procedures
WHERE name = 'usp_MessageBusTargetActivation';

PRINT '';
PRINT 'Procedure Details:';
PRINT '  - Handles RequestMessage: Process and send ResponseMessage';
PRINT '  - Handles ErrorMessage: Log and end conversation';
PRINT '  - Handles AcknowledgementMessage: Continue processing';
PRINT '  - Handles EndDialog: Clean up conversation';
PRINT '  - Handles DialogTimer: Timeout handling';
PRINT '  - Handles Service Broker Errors: Log and end conversation';
PRINT '  - Includes TRY/CATCH for error handling';
PRINT '  - Transaction management for message processing';
PRINT '';
PRINT '========================================';
PRINT 'Script completed successfully.';
PRINT '========================================';
GO
