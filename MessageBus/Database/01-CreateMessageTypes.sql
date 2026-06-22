/*
================================================================================
Script: 01-CreateMessageTypes.sql
Purpose: Create Service Broker message types for the Message Bus
Phase: 0 - SQL Server Service Broker Foundation
================================================================================
Prerequisites: 00-EnableServiceBroker.sql must be run first
================================================================================
*/

USE [MessageBus]; -- Change to your target database name
GO

SET NOCOUNT ON;

PRINT '========================================';
PRINT 'Creating Service Broker Message Types';
PRINT '========================================';
PRINT '';

-- ============================================================================
-- Message Type: RequestMessage
-- Purpose: Primary message type for sending requests from initiator to target
-- Validation: WELL_FORMED_XML ensures message body is valid XML
-- ============================================================================
IF NOT EXISTS (SELECT * FROM sys.service_message_types WHERE name = N'RequestMessage')
BEGIN
    CREATE MESSAGE TYPE [RequestMessage]
    VALIDATION = WELL_FORMED_XML;

    PRINT 'Created message type: RequestMessage (VALIDATION = WELL_FORMED_XML)';
END
ELSE
BEGIN
    PRINT 'Message type already exists: RequestMessage';
END
GO

-- ============================================================================
-- Message Type: ResponseMessage
-- Purpose: Message type for sending responses from target back to initiator
-- Validation: WELL_FORMED_XML ensures message body is valid XML
-- ============================================================================
IF NOT EXISTS (SELECT * FROM sys.service_message_types WHERE name = N'ResponseMessage')
BEGIN
    CREATE MESSAGE TYPE [ResponseMessage]
    VALIDATION = WELL_FORMED_XML;

    PRINT 'Created message type: ResponseMessage (VALIDATION = WELL_FORMED_XML)';
END
ELSE
BEGIN
    PRINT 'Message type already exists: ResponseMessage';
END
GO

-- ============================================================================
-- Message Type: ErrorMessage
-- Purpose: Message type for communicating errors between services
-- Validation: WELL_FORMED_XML for structured error information
-- ============================================================================
IF NOT EXISTS (SELECT * FROM sys.service_message_types WHERE name = N'ErrorMessage')
BEGIN
    CREATE MESSAGE TYPE [ErrorMessage]
    VALIDATION = WELL_FORMED_XML;

    PRINT 'Created message type: ErrorMessage (VALIDATION = WELL_FORMED_XML)';
END
ELSE
BEGIN
    PRINT 'Message type already exists: ErrorMessage';
END
GO

-- ============================================================================
-- Message Type: AcknowledgementMessage
-- Purpose: Message type for acknowledging receipt of messages
-- Validation: WELL_FORMED_XML for structured acknowledgement data
-- ============================================================================
IF NOT EXISTS (SELECT * FROM sys.service_message_types WHERE name = N'AcknowledgementMessage')
BEGIN
    CREATE MESSAGE TYPE [AcknowledgementMessage]
    VALIDATION = WELL_FORMED_XML;

    PRINT 'Created message type: AcknowledgementMessage (VALIDATION = WELL_FORMED_XML)';
END
ELSE
BEGIN
    PRINT 'Message type already exists: AcknowledgementMessage';
END
GO

-- ============================================================================
-- Verification: List all custom message types
-- ============================================================================
PRINT '';
PRINT '========================================';
PRINT 'Verification - Message Types Created';
PRINT '========================================';

SELECT
    name AS [Message Type Name],
    message_type_id AS [ID],
    CASE validation
        WHEN 'N' THEN 'NONE'
        WHEN 'X' THEN 'WELL_FORMED_XML'
        WHEN 'E' THEN 'VALID_XML WITH SCHEMA COLLECTION'
    END AS [Validation],
    validation_desc AS [Validation Description]
FROM sys.service_message_types
WHERE name IN (
    'RequestMessage',
    'ResponseMessage',
    'ErrorMessage',
    'AcknowledgementMessage'
)
ORDER BY name;

PRINT '';
PRINT '========================================';
PRINT 'Script completed successfully.';
PRINT '========================================';
GO
