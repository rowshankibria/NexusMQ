/*
================================================================================
Script: 03-CreateQueues.sql
Purpose: Create Service Broker queues for the Message Bus
Phase: 0 - SQL Server Service Broker Foundation
================================================================================
Prerequisites:
  - 00-EnableServiceBroker.sql
  - 01-CreateMessageTypes.sql
  - 02-CreateContracts.sql
================================================================================
Note: Activation will be configured later in 06-EnableQueueActivation.sql
================================================================================
*/

USE [MessageBus]; -- Change to your target database name
GO

SET NOCOUNT ON;

PRINT '========================================';
PRINT 'Creating Service Broker Queues';
PRINT '========================================';
PRINT '';

-- ============================================================================
-- Queue: MessageBusInitiatorQueue
-- Purpose: Receives responses for conversations initiated by this service
-- ============================================================================
BEGIN TRY
    IF NOT EXISTS (SELECT * FROM sys.service_queues WHERE name = N'MessageBusInitiatorQueue')
    BEGIN
        CREATE QUEUE [MessageBusInitiatorQueue]
        WITH
            STATUS = ON,                           -- Queue is active and can receive messages
            RETENTION = OFF,                       -- Don't retain messages after processing
            POISON_MESSAGE_HANDLING (STATUS = ON); -- Auto-disable queue after 5 rollbacks

        PRINT 'Created queue: MessageBusInitiatorQueue';
        PRINT '  - STATUS = ON';
        PRINT '  - RETENTION = OFF';
        PRINT '  - POISON_MESSAGE_HANDLING = ON';
    END
    ELSE
    BEGIN
        PRINT 'Queue already exists: MessageBusInitiatorQueue';

        -- Ensure queue is enabled
        IF EXISTS (SELECT * FROM sys.service_queues WHERE name = N'MessageBusInitiatorQueue' AND is_receive_enabled = 0)
        BEGIN
            ALTER QUEUE [MessageBusInitiatorQueue] WITH STATUS = ON;
            PRINT '  - Queue re-enabled (was disabled)';
        END
    END
END TRY
BEGIN CATCH
    PRINT 'ERROR creating MessageBusInitiatorQueue:';
    PRINT 'Error Number: ' + CAST(ERROR_NUMBER() AS NVARCHAR(10));
    PRINT 'Error Message: ' + ERROR_MESSAGE();
END CATCH
GO

PRINT '';

-- ============================================================================
-- Queue: MessageBusTargetQueue
-- Purpose: Receives requests from initiators for processing
-- Note: Activation procedure will be attached in a later script
-- ============================================================================
BEGIN TRY
    IF NOT EXISTS (SELECT * FROM sys.service_queues WHERE name = N'MessageBusTargetQueue')
    BEGIN
        CREATE QUEUE [MessageBusTargetQueue]
        WITH
            STATUS = ON,                           -- Queue is active and can receive messages
            RETENTION = OFF,                       -- Don't retain messages after processing
            POISON_MESSAGE_HANDLING (STATUS = ON); -- Auto-disable queue after 5 rollbacks

        PRINT 'Created queue: MessageBusTargetQueue';
        PRINT '  - STATUS = ON';
        PRINT '  - RETENTION = OFF';
        PRINT '  - POISON_MESSAGE_HANDLING = ON';
        PRINT '  - Note: Activation will be configured in 06-EnableQueueActivation.sql';
    END
    ELSE
    BEGIN
        PRINT 'Queue already exists: MessageBusTargetQueue';

        -- Ensure queue is enabled
        IF EXISTS (SELECT * FROM sys.service_queues WHERE name = N'MessageBusTargetQueue' AND is_receive_enabled = 0)
        BEGIN
            ALTER QUEUE [MessageBusTargetQueue] WITH STATUS = ON;
            PRINT '  - Queue re-enabled (was disabled)';
        END
    END
END TRY
BEGIN CATCH
    PRINT 'ERROR creating MessageBusTargetQueue:';
    PRINT 'Error Number: ' + CAST(ERROR_NUMBER() AS NVARCHAR(10));
    PRINT 'Error Message: ' + ERROR_MESSAGE();
END CATCH
GO

-- ============================================================================
-- Verification: List all custom queues and their configuration
-- ============================================================================
PRINT '';
PRINT '========================================';
PRINT 'Verification - Queues Created';
PRINT '========================================';
PRINT '';

SELECT
    q.name AS [Queue Name],
    CASE q.is_receive_enabled
        WHEN 1 THEN 'Enabled'
        ELSE 'Disabled'
    END AS [Receive Status],
    CASE q.is_enqueue_enabled
        WHEN 1 THEN 'Enabled'
        ELSE 'Disabled'
    END AS [Enqueue Status],
    CASE q.is_retention_enabled
        WHEN 1 THEN 'ON'
        ELSE 'OFF'
    END AS [Retention],
    CASE q.is_poison_message_handling_enabled
        WHEN 1 THEN 'ON'
        ELSE 'OFF'
    END AS [Poison Message Handling],
    CASE
        WHEN q.activation_procedure IS NOT NULL THEN q.activation_procedure
        ELSE '(Not configured)'
    END AS [Activation Procedure],
    ISNULL(q.max_readers, 0) AS [Max Queue Readers]
FROM sys.service_queues q
WHERE q.name IN ('MessageBusInitiatorQueue', 'MessageBusTargetQueue')
ORDER BY q.name;

PRINT '';
PRINT '========================================';
PRINT 'Script completed successfully.';
PRINT '========================================';
GO
