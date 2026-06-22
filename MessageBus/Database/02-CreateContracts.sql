/*
================================================================================
Script: 02-CreateContracts.sql
Purpose: Create Service Broker contracts for the Message Bus
Phase: 0 - SQL Server Service Broker Foundation
================================================================================
Prerequisites:
  - 00-EnableServiceBroker.sql
  - 01-CreateMessageTypes.sql
================================================================================
*/

USE [MessageBus]; -- Change to your target database name
GO

SET NOCOUNT ON;

PRINT '========================================';
PRINT 'Creating Service Broker Contracts';
PRINT '========================================';
PRINT '';

-- ============================================================================
-- Contract: MessageBusContract
-- Purpose: Standard request/response contract for two-way communication
-- Usage: Use this contract when you expect a response back from the target
-- ============================================================================
IF NOT EXISTS (SELECT * FROM sys.service_contracts WHERE name = N'MessageBusContract')
BEGIN
    CREATE CONTRACT [MessageBusContract]
    (
        -- Initiator sends request messages
        [RequestMessage] SENT BY INITIATOR,

        -- Target sends response messages
        [ResponseMessage] SENT BY TARGET,

        -- Either party can send error messages
        [ErrorMessage] SENT BY ANY,

        -- Either party can send acknowledgements
        [AcknowledgementMessage] SENT BY ANY
    );

    PRINT 'Created contract: MessageBusContract';
    PRINT '  - RequestMessage: SENT BY INITIATOR';
    PRINT '  - ResponseMessage: SENT BY TARGET';
    PRINT '  - ErrorMessage: SENT BY ANY';
    PRINT '  - AcknowledgementMessage: SENT BY ANY';
END
ELSE
BEGIN
    PRINT 'Contract already exists: MessageBusContract';
END
GO

PRINT '';

-- ============================================================================
-- Contract: OneWayContract
-- Purpose: Fire-and-forget contract for one-way communication
-- Usage: Use this contract when no response is expected (notifications, logs)
-- ============================================================================
IF NOT EXISTS (SELECT * FROM sys.service_contracts WHERE name = N'OneWayContract')
BEGIN
    CREATE CONTRACT [OneWayContract]
    (
        -- Only the initiator sends messages, no response expected
        [RequestMessage] SENT BY INITIATOR
    );

    PRINT 'Created contract: OneWayContract';
    PRINT '  - RequestMessage: SENT BY INITIATOR';
    PRINT '  - (Fire-and-forget, no response expected)';
END
ELSE
BEGIN
    PRINT 'Contract already exists: OneWayContract';
END
GO

-- ============================================================================
-- Verification: List all custom contracts and their message types
-- ============================================================================
PRINT '';
PRINT '========================================';
PRINT 'Verification - Contracts Created';
PRINT '========================================';
PRINT '';

-- Show contracts
SELECT
    c.name AS [Contract Name],
    c.service_contract_id AS [Contract ID]
FROM sys.service_contracts c
WHERE c.name IN ('MessageBusContract', 'OneWayContract')
ORDER BY c.name;

PRINT '';
PRINT 'Contract Message Type Mappings:';
PRINT '--------------------------------';

-- Show contract message type mappings
SELECT
    c.name AS [Contract],
    mt.name AS [Message Type],
    CASE cmu.is_sent_by_initiator
        WHEN 1 THEN
            CASE cmu.is_sent_by_target
                WHEN 1 THEN 'SENT BY ANY'
                ELSE 'SENT BY INITIATOR'
            END
        ELSE 'SENT BY TARGET'
    END AS [Sent By]
FROM sys.service_contracts c
INNER JOIN sys.service_contract_message_usages cmu
    ON c.service_contract_id = cmu.service_contract_id
INNER JOIN sys.service_message_types mt
    ON cmu.message_type_id = mt.message_type_id
WHERE c.name IN ('MessageBusContract', 'OneWayContract')
ORDER BY c.name, mt.name;

PRINT '';
PRINT '========================================';
PRINT 'Script completed successfully.';
PRINT '========================================';
GO
