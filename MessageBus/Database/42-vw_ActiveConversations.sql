/*
    42-vw_ActiveConversations.sql
    Service Broker Message Bus - Active Conversations View

    Purpose: Shows all currently active conversations with their state,
             services, and timing information
*/

IF OBJECT_ID('dbo.vw_ActiveConversations', 'V') IS NOT NULL
    DROP VIEW dbo.vw_ActiveConversations;
GO

CREATE VIEW dbo.vw_ActiveConversations AS
SELECT
    ce.conversation_handle AS ConversationHandle,
    ce.conversation_id AS ConversationId,
    ce.state_desc AS State,
    ce.far_service AS FarService,
    ce.far_broker_instance AS FarBrokerInstance,
    s.name AS LocalService,
    ce.is_initiator AS IsInitiator,
    ce.send_sequence AS SendSequence,
    ce.receive_sequence AS ReceiveSequence,
    ce.lifetime AS Lifetime,
    DATEDIFF(SECOND, GETDATE(), ce.lifetime) AS SecondsRemaining
FROM sys.conversation_endpoints ce
JOIN sys.services s ON ce.service_id = s.service_id
WHERE ce.state NOT IN ('CD', 'ER', 'DI');
GO

PRINT 'Created view: dbo.vw_ActiveConversations';
GO
