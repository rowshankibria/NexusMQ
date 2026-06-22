/*
    41-vw_ServiceBrokerHealth.sql
    Service Broker Message Bus - Service Broker Health View

    Purpose: Provides an overall health summary of Service Broker
             including queue counts, conversation states, and transmission queue depth
*/

IF OBJECT_ID('dbo.vw_ServiceBrokerHealth', 'V') IS NOT NULL
    DROP VIEW dbo.vw_ServiceBrokerHealth;
GO

CREATE VIEW dbo.vw_ServiceBrokerHealth AS
SELECT
    d.name AS DatabaseName,
    d.is_broker_enabled AS IsBrokerEnabled,
    d.service_broker_guid AS BrokerGuid,
    (SELECT COUNT(*) FROM sys.service_queues WHERE is_ms_shipped = 0) AS TotalQueues,
    (SELECT COUNT(*) FROM sys.service_queues WHERE is_receive_enabled = 0 AND is_ms_shipped = 0) AS DisabledQueues,
    (SELECT COUNT(*) FROM sys.services WHERE is_ms_shipped = 0) AS TotalServices,
    (SELECT COUNT(*) FROM sys.conversation_endpoints WHERE state = 'CO') AS OpenConversations,
    (SELECT COUNT(*) FROM sys.conversation_endpoints WHERE state IN ('ER', 'CD', 'DI')) AS ErrorConversations,
    (SELECT COUNT(*) FROM sys.transmission_queue) AS TransmissionQueueDepth
FROM sys.databases d
WHERE d.name = DB_NAME();
GO

PRINT 'Created view: dbo.vw_ServiceBrokerHealth';
GO
