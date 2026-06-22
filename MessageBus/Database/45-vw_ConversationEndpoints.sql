/*
    45-vw_ConversationEndpoints.sql
    Service Broker Message Bus - Conversation Endpoints View

    Purpose: Provides detailed information about all conversation endpoints
             with human-readable state descriptions
*/

IF OBJECT_ID('dbo.vw_ConversationEndpoints', 'V') IS NOT NULL
    DROP VIEW dbo.vw_ConversationEndpoints;
GO

CREATE VIEW dbo.vw_ConversationEndpoints AS
SELECT
    ce.conversation_handle,
    ce.conversation_id,
    ce.conversation_group_id,
    CASE ce.state
        WHEN 'SO' THEN 'Started Outbound'
        WHEN 'SI' THEN 'Started Inbound'
        WHEN 'CO' THEN 'Conversing'
        WHEN 'DI' THEN 'Disconnected Inbound'
        WHEN 'DO' THEN 'Disconnected Outbound'
        WHEN 'ER' THEN 'Error'
        WHEN 'CD' THEN 'Closed'
    END AS StateDescription,
    s.name AS LocalServiceName,
    ce.far_service AS RemoteServiceName,
    ce.is_initiator,
    ce.principal_id,
    ce.send_sequence,
    ce.receive_sequence,
    ce.lifetime
FROM sys.conversation_endpoints ce
LEFT JOIN sys.services s ON ce.service_id = s.service_id;
GO

PRINT 'Created view: dbo.vw_ConversationEndpoints';
GO
