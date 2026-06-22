/*
================================================================================
Script: 04-CreateServices.sql
Purpose: Create Service Broker services for the Message Bus
Phase: 0 - SQL Server Service Broker Foundation
================================================================================
Prerequisites:
  - 00-EnableServiceBroker.sql
  - 01-CreateMessageTypes.sql
  - 02-CreateContracts.sql
  - 03-CreateQueues.sql
================================================================================
*/

USE [MessageBus]; -- Change to your target database name
GO

SET NOCOUNT ON;

PRINT '========================================';
PRINT 'Creating Service Broker Services';
PRINT '========================================';
PRINT '';

-- ============================================================================
-- Service: MessageBusInitiatorService
-- Purpose: Service that initiates conversations (sends requests)
-- Queue: MessageBusInitiatorQueue
-- Contracts: MessageBusContract, OneWayContract
-- ============================================================================
IF NOT EXISTS (SELECT * FROM sys.services WHERE name = N'MessageBusInitiatorService')
BEGIN
    CREATE SERVICE [MessageBusInitiatorService]
    ON QUEUE [MessageBusInitiatorQueue]
    (
        [MessageBusContract],
        [OneWayContract]
    );

    PRINT 'Created service: MessageBusInitiatorService';
    PRINT '  - Queue: MessageBusInitiatorQueue';
    PRINT '  - Contracts: MessageBusContract, OneWayContract';
END
ELSE
BEGIN
    PRINT 'Service already exists: MessageBusInitiatorService';
END
GO

PRINT '';

-- ============================================================================
-- Service: MessageBusTargetService
-- Purpose: Service that receives and processes requests (target of conversations)
-- Queue: MessageBusTargetQueue
-- Contracts: MessageBusContract, OneWayContract
-- ============================================================================
IF NOT EXISTS (SELECT * FROM sys.services WHERE name = N'MessageBusTargetService')
BEGIN
    CREATE SERVICE [MessageBusTargetService]
    ON QUEUE [MessageBusTargetQueue]
    (
        [MessageBusContract],
        [OneWayContract]
    );

    PRINT 'Created service: MessageBusTargetService';
    PRINT '  - Queue: MessageBusTargetQueue';
    PRINT '  - Contracts: MessageBusContract, OneWayContract';
END
ELSE
BEGIN
    PRINT 'Service already exists: MessageBusTargetService';
END
GO

-- ============================================================================
-- Verification: List all custom services and their configuration
-- ============================================================================
PRINT '';
PRINT '========================================';
PRINT 'Verification - Services Created';
PRINT '========================================';
PRINT '';

-- Show services and their queues
SELECT
    s.name AS [Service Name],
    s.service_id AS [Service ID],
    q.name AS [Queue Name]
FROM sys.services s
INNER JOIN sys.service_queues q
    ON s.service_queue_id = q.object_id
WHERE s.name IN ('MessageBusInitiatorService', 'MessageBusTargetService')
ORDER BY s.name;

PRINT '';
PRINT 'Service Contract Mappings:';
PRINT '--------------------------';

-- Show service contract mappings
SELECT
    s.name AS [Service],
    c.name AS [Contract]
FROM sys.services s
INNER JOIN sys.service_contract_usages scu
    ON s.service_id = scu.service_id
INNER JOIN sys.service_contracts c
    ON scu.service_contract_id = c.service_contract_id
WHERE s.name IN ('MessageBusInitiatorService', 'MessageBusTargetService')
ORDER BY s.name, c.name;

PRINT '';
PRINT '========================================';
PRINT 'Service Broker Infrastructure Summary';
PRINT '========================================';
PRINT '';
PRINT 'Message Flow:';
PRINT '  1. Client calls stored procedure';
PRINT '  2. Procedure initiates dialog with MessageBusTargetService';
PRINT '  3. Message sent to MessageBusTargetQueue';
PRINT '  4. Activation procedure processes message';
PRINT '  5. Response sent back to MessageBusInitiatorQueue';
PRINT '';
PRINT '========================================';
PRINT 'Script completed successfully.';
PRINT '========================================';
GO
