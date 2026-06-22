/*
================================================================================
Script: 07-TestServiceBroker.sql
Purpose: Test the Service Broker infrastructure
Phase: 0 - SQL Server Service Broker Foundation
================================================================================
Prerequisites: All previous scripts (00-06) must be run first
================================================================================
This script sends a test message through the Service Broker infrastructure
and verifies that responses are received correctly.
================================================================================
*/

USE [MessageBus]; -- Change to your target database name
GO

SET NOCOUNT ON;

PRINT '========================================';
PRINT 'Service Broker Integration Test';
PRINT '========================================';
PRINT '';
PRINT 'Starting test at: ' + CONVERT(NVARCHAR(30), GETDATE(), 121);
PRINT '';

-- ============================================================================
-- Pre-flight checks
-- ============================================================================
PRINT '--- Pre-flight Checks ---';
PRINT '';

-- Check Service Broker is enabled
DECLARE @IsBrokerEnabled BIT;
SELECT @IsBrokerEnabled = is_broker_enabled FROM sys.databases WHERE name = DB_NAME();

IF @IsBrokerEnabled = 0
BEGIN
    PRINT 'ERROR: Service Broker is not enabled on this database.';
    PRINT 'Run 00-EnableServiceBroker.sql first.';
    RETURN;
END
PRINT 'Service Broker: ENABLED';

-- Check services exist
IF NOT EXISTS (SELECT * FROM sys.services WHERE name = 'MessageBusInitiatorService')
BEGIN
    PRINT 'ERROR: MessageBusInitiatorService does not exist.';
    RETURN;
END
PRINT 'MessageBusInitiatorService: EXISTS';

IF NOT EXISTS (SELECT * FROM sys.services WHERE name = 'MessageBusTargetService')
BEGIN
    PRINT 'ERROR: MessageBusTargetService does not exist.';
    RETURN;
END
PRINT 'MessageBusTargetService: EXISTS';

-- Check queues are enabled
IF EXISTS (SELECT * FROM sys.service_queues WHERE name = 'MessageBusTargetQueue' AND is_receive_enabled = 0)
BEGIN
    PRINT 'WARNING: MessageBusTargetQueue is disabled (possibly due to poison messages).';
    PRINT 'Re-enabling queue...';
    ALTER QUEUE [MessageBusTargetQueue] WITH STATUS = ON;
END
PRINT 'MessageBusTargetQueue: READY';

PRINT '';
PRINT '--- Sending Test Message ---';
PRINT '';

-- ============================================================================
-- Test 1: Send a message and wait for response
-- ============================================================================
DECLARE @ConversationHandle UNIQUEIDENTIFIER;
DECLARE @TestMessageXML XML;
DECLARE @ResponseMessageBody VARBINARY(MAX);
DECLARE @ResponseMessageType NVARCHAR(256);
DECLARE @ResponseXML XML;

-- Create test message
SET @TestMessageXML = (
    SELECT
        'TEST-' + CAST(NEWID() AS NVARCHAR(36)) AS MessageId,
        'TestRequest' AS MessageType,
        GETUTCDATE() AS Timestamp,
        'This is a test message from the integration test script' AS Content,
        DB_NAME() AS SourceDatabase,
        SYSTEM_USER AS SourceUser
    FOR XML PATH('Request'), TYPE
);

PRINT 'Test Message:';
PRINT CAST(@TestMessageXML AS NVARCHAR(MAX));
PRINT '';

BEGIN TRY
    BEGIN TRANSACTION;

    -- Begin dialog conversation
    BEGIN DIALOG CONVERSATION @ConversationHandle
        FROM SERVICE [MessageBusInitiatorService]
        TO SERVICE N'MessageBusTargetService'
        ON CONTRACT [MessageBusContract]
        WITH ENCRYPTION = OFF;

    PRINT 'Conversation started: ' + CAST(@ConversationHandle AS NVARCHAR(50));

    -- Send the test message
    SEND ON CONVERSATION @ConversationHandle
        MESSAGE TYPE [RequestMessage]
        (@TestMessageXML);

    PRINT 'Message sent successfully.';
    PRINT '';

    COMMIT TRANSACTION;

    -- Wait for response (with timeout)
    PRINT '--- Waiting for Response (30 seconds max) ---';
    PRINT '';

    DECLARE @StartTime DATETIME = GETDATE();
    DECLARE @Timeout INT = 30000; -- 30 seconds

    WAITFOR (
        RECEIVE TOP(1)
            @ResponseMessageType = message_type_name,
            @ResponseMessageBody = message_body
        FROM [MessageBusInitiatorQueue]
        WHERE conversation_handle = @ConversationHandle
    ), TIMEOUT @Timeout;

    IF @ResponseMessageType IS NOT NULL
    BEGIN
        PRINT 'Response received!';
        PRINT 'Message Type: ' + @ResponseMessageType;
        PRINT 'Response Time: ' + CAST(DATEDIFF(MILLISECOND, @StartTime, GETDATE()) AS NVARCHAR(10)) + ' ms';
        PRINT '';

        IF @ResponseMessageBody IS NOT NULL
        BEGIN
            SET @ResponseXML = CAST(@ResponseMessageBody AS XML);
            PRINT 'Response Body:';
            PRINT CAST(@ResponseXML AS NVARCHAR(MAX));
        END

        -- Clean up - end conversation
        END CONVERSATION @ConversationHandle;
        PRINT '';
        PRINT 'Conversation ended cleanly.';
    END
    ELSE
    BEGIN
        PRINT 'WARNING: No response received within timeout period.';
        PRINT 'This could indicate:';
        PRINT '  1. Activation procedure is not running';
        PRINT '  2. Queue is disabled';
        PRINT '  3. Message processing error';
        PRINT '';

        -- Check queue status
        SELECT
            name AS QueueName,
            is_receive_enabled AS ReceiveEnabled,
            is_activation_enabled AS ActivationEnabled
        FROM sys.service_queues
        WHERE name IN ('MessageBusInitiatorQueue', 'MessageBusTargetQueue');

        -- End conversation with error
        END CONVERSATION @ConversationHandle WITH CLEANUP;
    END

END TRY
BEGIN CATCH
    IF @@TRANCOUNT > 0
        ROLLBACK TRANSACTION;

    PRINT 'ERROR during test:';
    PRINT 'Error Number: ' + CAST(ERROR_NUMBER() AS NVARCHAR(10));
    PRINT 'Error Message: ' + ERROR_MESSAGE();
    PRINT 'Error Line: ' + CAST(ERROR_LINE() AS NVARCHAR(10));
END CATCH;

PRINT '';
PRINT '========================================';
PRINT 'Queue Status After Test';
PRINT '========================================';
PRINT '';

-- Show queue message counts
SELECT
    q.name AS [Queue Name],
    p.rows AS [Messages in Queue]
FROM sys.service_queues q
INNER JOIN sys.internal_tables it ON q.object_id = it.parent_object_id
INNER JOIN sys.partitions p ON it.object_id = p.object_id
WHERE q.name IN ('MessageBusInitiatorQueue', 'MessageBusTargetQueue')
  AND p.index_id IN (0, 1);

PRINT '';
PRINT '========================================';
PRINT 'Active Conversations';
PRINT '========================================';
PRINT '';

-- Show active conversations (if any remain)
SELECT
    ce.conversation_handle AS [Conversation Handle],
    ce.state_desc AS [State],
    s1.name AS [From Service],
    s2.name AS [To Service],
    ce.lifetime AS [Expires]
FROM sys.conversation_endpoints ce
LEFT JOIN sys.services s1 ON ce.service_id = s1.service_id
LEFT JOIN sys.services s2 ON ce.far_service = s2.name
WHERE s1.name IN ('MessageBusInitiatorService', 'MessageBusTargetService')
   OR s2.name IN ('MessageBusInitiatorService', 'MessageBusTargetService');

PRINT '';
PRINT '========================================';
PRINT 'Test completed at: ' + CONVERT(NVARCHAR(30), GETDATE(), 121);
PRINT '========================================';
GO

-- ============================================================================
-- Cleanup Script (optional - run separately if needed)
-- ============================================================================
/*
-- Use this to clean up stuck conversations
DECLARE @handle UNIQUEIDENTIFIER;
DECLARE cleanup_cursor CURSOR FOR
    SELECT conversation_handle
    FROM sys.conversation_endpoints
    WHERE far_service IN ('MessageBusInitiatorService', 'MessageBusTargetService');

OPEN cleanup_cursor;
FETCH NEXT FROM cleanup_cursor INTO @handle;

WHILE @@FETCH_STATUS = 0
BEGIN
    END CONVERSATION @handle WITH CLEANUP;
    FETCH NEXT FROM cleanup_cursor INTO @handle;
END

CLOSE cleanup_cursor;
DEALLOCATE cleanup_cursor;

PRINT 'Cleanup complete.';
*/
GO
