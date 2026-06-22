/*
    40-vw_QueueStatus.sql
    Service Broker Message Bus - Queue Status View

    Purpose: Provides a consolidated view of all Service Broker queues
             with their current status and configuration
*/

IF OBJECT_ID('dbo.vw_QueueStatus', 'V') IS NOT NULL
    DROP VIEW dbo.vw_QueueStatus;
GO

CREATE VIEW dbo.vw_QueueStatus AS
SELECT
    q.name AS QueueName,
    SCHEMA_NAME(q.schema_id) AS SchemaName,
    s.name AS ServiceName,
    q.is_activation_enabled AS IsActivationEnabled,
    q.is_receive_enabled AS IsReceiveEnabled,
    q.max_readers AS MaxReaders,
    q.activation_procedure AS ActivationProcedure,
    CASE
        WHEN q.is_receive_enabled = 0 THEN 'Disabled'
        WHEN q.is_poison_message_handling_enabled = 1 THEN 'Poison'
        ELSE 'Active'
    END AS Status
FROM sys.service_queues q
LEFT JOIN sys.services s ON q.object_id = s.service_queue_id
WHERE q.is_ms_shipped = 0;
GO

PRINT 'Created view: dbo.vw_QueueStatus';
GO
