/*
    44-vw_MessageThroughput.sql
    Service Broker Message Bus - Message Throughput View

    Purpose: Shows message throughput metrics for the last 24 hours
             including enqueue/receive rates and processing times
*/

IF OBJECT_ID('dbo.vw_MessageThroughput', 'V') IS NOT NULL
    DROP VIEW dbo.vw_MessageThroughput;
GO

CREATE VIEW dbo.vw_MessageThroughput AS
SELECT
    QueueName,
    CollectionTimestamp,
    MessageCount,
    MessagesEnqueuedPerSecond,
    MessagesReceivedPerSecond,
    AvgProcessingTimeMs
FROM dbo.PerformanceMetrics
WHERE CollectionTimestamp >= DATEADD(HOUR, -24, GETDATE());
GO

PRINT 'Created view: dbo.vw_MessageThroughput';
GO
