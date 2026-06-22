/*
================================================================================
Script: 06-EnableQueueActivation.sql
Purpose: Enable automatic activation on the target queue
Phase: 0 - SQL Server Service Broker Foundation
================================================================================
Prerequisites:
  - 00-EnableServiceBroker.sql
  - 01-CreateMessageTypes.sql
  - 02-CreateContracts.sql
  - 03-CreateQueues.sql
  - 04-CreateServices.sql
  - 05-CreateActivationProcedure.sql
================================================================================
This script configures the MessageBusTargetQueue to automatically invoke
the activation procedure when messages arrive.
================================================================================
*/

USE [MessageBus]; -- Change to your target database name
GO

SET NOCOUNT ON;

PRINT '========================================';
PRINT 'Enabling Queue Activation';
PRINT '========================================';
PRINT '';

-- ============================================================================
-- Enable Activation on MessageBusTargetQueue
-- ============================================================================
BEGIN TRY
    -- Check if the activation procedure exists
    IF NOT EXISTS (SELECT * FROM sys.procedures WHERE name = N'usp_MessageBusTargetActivation')
    BEGIN
        RAISERROR('Activation procedure usp_MessageBusTargetActivation does not exist. Run 05-CreateActivationProcedure.sql first.', 16, 1);
        RETURN;
    END

    -- Check if the queue exists
    IF NOT EXISTS (SELECT * FROM sys.service_queues WHERE name = N'MessageBusTargetQueue')
    BEGIN
        RAISERROR('Queue MessageBusTargetQueue does not exist. Run 03-CreateQueues.sql first.', 16, 1);
        RETURN;
    END

    -- Configure activation on the target queue
    ALTER QUEUE [MessageBusTargetQueue]
    WITH ACTIVATION (
        STATUS = ON,                                           -- Enable activation
        PROCEDURE_NAME = [dbo].[usp_MessageBusTargetActivation], -- Procedure to invoke
        MAX_QUEUE_READERS = 5,                                 -- Max concurrent readers
        EXECUTE AS SELF                                        -- Execute as queue owner
    );

    PRINT 'Activation enabled on MessageBusTargetQueue:';
    PRINT '  - STATUS = ON';
    PRINT '  - PROCEDURE_NAME = usp_MessageBusTargetActivation';
    PRINT '  - MAX_QUEUE_READERS = 5';
    PRINT '  - EXECUTE AS SELF';

END TRY
BEGIN CATCH
    PRINT 'ERROR enabling queue activation:';
    PRINT 'Error Number: ' + CAST(ERROR_NUMBER() AS NVARCHAR(10));
    PRINT 'Error Message: ' + ERROR_MESSAGE();
    RETURN;
END CATCH
GO

-- ============================================================================
-- Verification: Show queue activation configuration
-- ============================================================================
PRINT '';
PRINT '========================================';
PRINT 'Verification - Queue Activation Status';
PRINT '========================================';
PRINT '';

SELECT
    q.name AS [Queue Name],
    CASE q.is_activation_enabled
        WHEN 1 THEN 'Enabled'
        ELSE 'Disabled'
    END AS [Activation Status],
    q.activation_procedure AS [Activation Procedure],
    q.max_readers AS [Max Queue Readers],
    CASE q.execute_as_principal_id
        WHEN -2 THEN 'EXECUTE AS SELF'
        WHEN NULL THEN 'N/A'
        ELSE 'Principal ID: ' + CAST(q.execute_as_principal_id AS NVARCHAR(10))
    END AS [Execute As],
    CASE q.is_receive_enabled
        WHEN 1 THEN 'Enabled'
        ELSE 'Disabled'
    END AS [Receive Status],
    CASE q.is_enqueue_enabled
        WHEN 1 THEN 'Enabled'
        ELSE 'Disabled'
    END AS [Enqueue Status],
    CASE q.is_poison_message_handling_enabled
        WHEN 1 THEN 'Enabled'
        ELSE 'Disabled'
    END AS [Poison Message Handling]
FROM sys.service_queues q
WHERE q.name = 'MessageBusTargetQueue';

PRINT '';
PRINT '========================================';
PRINT 'How Activation Works';
PRINT '========================================';
PRINT '';
PRINT '1. When a message arrives in MessageBusTargetQueue:';
PRINT '   - Service Broker checks if activation is enabled';
PRINT '   - If enabled and no readers active, starts a reader';
PRINT '';
PRINT '2. A reader executes usp_MessageBusTargetActivation:';
PRINT '   - Procedure receives messages from queue';
PRINT '   - Processes each message based on type';
PRINT '   - Sends responses if required';
PRINT '';
PRINT '3. Service Broker scales readers (up to 5):';
PRINT '   - Adds readers when queue backlog grows';
PRINT '   - Removes idle readers when queue empties';
PRINT '';
PRINT '========================================';
PRINT 'Script completed successfully.';
PRINT '========================================';
GO
