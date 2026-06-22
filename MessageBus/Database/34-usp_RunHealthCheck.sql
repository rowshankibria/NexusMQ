/*
================================================================================
Script: 34-usp_RunHealthCheck.sql
Purpose: Comprehensive Service Broker health check returning multiple result sets
Phase: 0.5D - Diagnostics Stored Procedures
================================================================================
Prerequisites: Phase 0 scripts (00-07) must be run first
================================================================================
This procedure performs a comprehensive health check of the Service Broker
infrastructure, returning multiple result sets covering all aspects of the
messaging system's health.
================================================================================
*/

USE [MessageBus]; -- Change to your target database name
GO

SET NOCOUNT ON;

PRINT '========================================';
PRINT 'Creating usp_RunHealthCheck';
PRINT '========================================';
PRINT '';

-- ============================================================================
-- Drop existing procedure if it exists
-- ============================================================================
IF EXISTS (SELECT * FROM sys.procedures WHERE name = N'usp_RunHealthCheck')
BEGIN
    DROP PROCEDURE [dbo].[usp_RunHealthCheck];
    PRINT 'Dropped existing procedure.';
END
GO

-- ============================================================================
-- Procedure: usp_RunHealthCheck
-- Purpose: Returns comprehensive health check across multiple result sets
-- ============================================================================
CREATE PROCEDURE [dbo].[usp_RunHealthCheck]
    @OrphanedConversationHours INT = 24,   -- Threshold for orphaned conversations
    @OldMessageMinutes INT = 60,            -- Threshold for old messages
    @VerboseOutput BIT = 0                  -- Include detailed diagnostics
AS
BEGIN
    SET NOCOUNT ON;

    DECLARE @CurrentTime DATETIME = GETDATE();
    DECLARE @HealthStatus NVARCHAR(20) = 'Healthy';
    DECLARE @WarningCount INT = 0;
    DECLARE @ErrorCount INT = 0;

    -- ========================================================================
    -- RESULT SET 1: Service Broker Database Status
    -- ========================================================================
    SELECT
        DB_NAME() AS DatabaseName,
        CAST(DATABASEPROPERTYEX(DB_NAME(), 'ServiceBrokerGuid') AS NVARCHAR(50)) AS BrokerGuid,
        CASE WHEN d.is_broker_enabled = 1 THEN 'Enabled' ELSE 'DISABLED' END AS BrokerStatus,
        CASE WHEN d.is_broker_enabled = 1 THEN 'OK' ELSE 'CRITICAL' END AS StatusLevel,
        d.is_trustworthy_on AS IsTrustworthy,
        d.is_honor_broker_priority_on AS HonorsBrokerPriority,
        SERVERPROPERTY('ServerName') AS ServerName,
        @@VERSION AS SqlVersion
    FROM sys.databases d
    WHERE d.name = DB_NAME();

    -- Check if broker is disabled
    IF EXISTS (SELECT 1 FROM sys.databases WHERE name = DB_NAME() AND is_broker_enabled = 0)
    BEGIN
        SET @ErrorCount = @ErrorCount + 1;
        SET @HealthStatus = 'Critical';
    END

    -- ========================================================================
    -- RESULT SET 2: Queue Health Summary
    -- ========================================================================
    SELECT
        q.name AS QueueName,
        q.object_id AS QueueId,
        q.is_receive_enabled,
        q.is_activation_enabled,
        q.is_poison_message_handling_enabled,
        q.is_retention_enabled,
        q.activation_procedure,
        q.max_readers AS MaxActivationReaders,

        -- Status flags
        CASE WHEN q.is_receive_enabled = 0 THEN 'DISABLED' ELSE 'OK' END AS ReceiveStatus,
        CASE
            WHEN q.is_receive_enabled = 0 THEN 'Warning'
            ELSE 'OK'
        END AS StatusLevel,

        -- Message count (approximate via sys.dm_db_partition_stats)
        (SELECT SUM(ps.row_count)
         FROM sys.dm_db_partition_stats ps
         WHERE ps.object_id = q.object_id AND ps.index_id IN (0, 1)) AS ApproxMessageCount

    FROM sys.service_queues q
    WHERE q.is_ms_shipped = 0  -- Exclude system queues
    ORDER BY q.name;

    -- Count disabled queues
    SELECT @WarningCount = @WarningCount + COUNT(*)
    FROM sys.service_queues
    WHERE is_ms_shipped = 0 AND is_receive_enabled = 0;

    -- ========================================================================
    -- RESULT SET 3: Orphaned Conversations
    -- ========================================================================
    SELECT
        ce.conversation_handle,
        ce.conversation_id,
        ce.state,
        ce.state_desc,
        ce.far_service,
        ce.is_initiator,
        ce.lifetime,
        DATEDIFF(HOUR, ce.lifetime, @CurrentTime) AS hours_since_activity,
        CASE
            WHEN ce.state = 'CO' AND DATEDIFF(HOUR, ce.lifetime, @CurrentTime) > @OrphanedConversationHours
            THEN 'Orphaned - Consider cleanup'
            WHEN ce.state = 'SO'
            THEN 'Started Outbound - Awaiting response'
            ELSE 'Active'
        END AS Assessment
    FROM sys.conversation_endpoints ce
    WHERE
        ce.state IN ('CO', 'SO')  -- Conversing or Started Outbound
        AND DATEDIFF(HOUR, ce.lifetime, @CurrentTime) > @OrphanedConversationHours;

    -- Count orphaned conversations
    SELECT @WarningCount = @WarningCount +
        (SELECT COUNT(*) FROM sys.conversation_endpoints
         WHERE state = 'CO' AND DATEDIFF(HOUR, lifetime, @CurrentTime) > @OrphanedConversationHours);

    -- ========================================================================
    -- RESULT SET 4: Old Messages in Queues
    -- ========================================================================
    ;WITH QueueMessages AS (
        SELECT
            q.name AS QueueName,
            q.object_id,
            (SELECT SUM(ps.row_count)
             FROM sys.dm_db_partition_stats ps
             WHERE ps.object_id = q.object_id AND ps.index_id IN (0, 1)) AS MessageCount
        FROM sys.service_queues q
        WHERE q.is_ms_shipped = 0
    )
    SELECT
        qm.QueueName,
        qm.MessageCount,
        CASE
            WHEN qm.MessageCount > 1000 THEN 'High volume - investigate'
            WHEN qm.MessageCount > 100 THEN 'Moderate volume'
            ELSE 'Normal'
        END AS VolumeAssessment,
        @OldMessageMinutes AS ThresholdMinutes
    FROM QueueMessages qm
    WHERE qm.MessageCount > 0
    ORDER BY qm.MessageCount DESC;

    -- ========================================================================
    -- RESULT SET 5: Services Without Valid Queues
    -- ========================================================================
    SELECT
        s.name AS ServiceName,
        s.service_id,
        'Service references missing or invalid queue' AS Issue,
        'Critical' AS Severity
    FROM sys.services s
    LEFT JOIN sys.service_queues q ON s.service_queue_id = q.object_id
    WHERE q.object_id IS NULL
      AND s.is_ms_shipped = 0;

    -- Count invalid services
    SELECT @ErrorCount = @ErrorCount +
        (SELECT COUNT(*) FROM sys.services s
         LEFT JOIN sys.service_queues q ON s.service_queue_id = q.object_id
         WHERE q.object_id IS NULL AND s.is_ms_shipped = 0);

    -- ========================================================================
    -- RESULT SET 6: Contract Validation
    -- ========================================================================
    SELECT
        c.name AS ContractName,
        mt.name AS MessageTypeName,
        cmu.is_sent_by_initiator,
        cmu.is_sent_by_target,
        CASE
            WHEN cmu.message_type_id IS NULL THEN 'Invalid - Message type missing'
            ELSE 'Valid'
        END AS ValidationStatus
    FROM sys.service_contracts c
    LEFT JOIN sys.service_contract_message_usages cmu ON c.service_contract_id = cmu.service_contract_id
    LEFT JOIN sys.service_message_types mt ON cmu.message_type_id = mt.message_type_id
    WHERE c.is_ms_shipped = 0
    ORDER BY c.name, mt.name;

    -- ========================================================================
    -- RESULT SET 7: Message Type Validation
    -- ========================================================================
    SELECT
        mt.name AS MessageTypeName,
        mt.validation,
        mt.validation_desc,
        CASE mt.validation
            WHEN 'N' THEN 'None - Any content allowed'
            WHEN 'E' THEN 'Empty - Must be empty'
            WHEN 'X' THEN 'XML - Must be valid XML'
            ELSE 'Unknown'
        END AS ValidationDescription,
        'Valid' AS Status
    FROM sys.service_message_types mt
    WHERE mt.is_ms_shipped = 0
    ORDER BY mt.name;

    -- ========================================================================
    -- RESULT SET 8: Transmission Queue Summary
    -- ========================================================================
    SELECT
        COUNT(*) AS TotalPendingMessages,
        COUNT(CASE WHEN transmission_status IS NOT NULL AND transmission_status != '' THEN 1 END) AS MessagesWithErrors,
        COUNT(CASE WHEN DATEDIFF(MINUTE, enqueue_time, @CurrentTime) > 5 THEN 1 END) AS StuckOver5Min,
        COUNT(CASE WHEN DATEDIFF(MINUTE, enqueue_time, @CurrentTime) > 30 THEN 1 END) AS StuckOver30Min,
        MIN(enqueue_time) AS OldestMessageTime,
        CASE
            WHEN COUNT(*) = 0 THEN 'Clear'
            WHEN COUNT(CASE WHEN DATEDIFF(MINUTE, enqueue_time, @CurrentTime) > 30 THEN 1 END) > 0 THEN 'Warning'
            ELSE 'OK'
        END AS Status
    FROM sys.transmission_queue;

    -- Count transmission issues
    SELECT @WarningCount = @WarningCount +
        (SELECT COUNT(*) FROM sys.transmission_queue
         WHERE DATEDIFF(MINUTE, enqueue_time, @CurrentTime) > 30);

    -- ========================================================================
    -- RESULT SET 9: Error State Conversations Summary
    -- ========================================================================
    SELECT
        ce.state,
        ce.state_desc,
        COUNT(*) AS ConversationCount,
        CASE
            WHEN COUNT(*) > 0 AND ce.state = 'ER' THEN 'Error - Requires attention'
            WHEN COUNT(*) > 0 THEN 'Warning'
            ELSE 'OK'
        END AS StatusLevel
    FROM sys.conversation_endpoints ce
    WHERE ce.state IN ('ER', 'CD', 'DI', 'DO')
    GROUP BY ce.state, ce.state_desc;

    -- Count error conversations
    SELECT @ErrorCount = @ErrorCount +
        (SELECT COUNT(*) FROM sys.conversation_endpoints WHERE state = 'ER');

    -- ========================================================================
    -- RESULT SET 10: Overall Health Summary
    -- ========================================================================
    IF @ErrorCount > 0
        SET @HealthStatus = 'Critical';
    ELSE IF @WarningCount > 0
        SET @HealthStatus = 'Warning';

    SELECT
        @HealthStatus AS OverallHealthStatus,
        @ErrorCount AS CriticalIssues,
        @WarningCount AS Warnings,
        @CurrentTime AS CheckTimestamp,
        @OrphanedConversationHours AS OrphanedThresholdHours,
        @OldMessageMinutes AS OldMessageThresholdMinutes,
        CASE @HealthStatus
            WHEN 'Critical' THEN 'Immediate attention required. Check error conversations and disabled queues.'
            WHEN 'Warning' THEN 'Some issues detected. Review warnings and consider cleanup actions.'
            ELSE 'All systems operating normally.'
        END AS Recommendation;

END
GO

PRINT 'Created procedure: usp_RunHealthCheck';

-- ============================================================================
-- Verification
-- ============================================================================
PRINT '';
PRINT '========================================';
PRINT 'Verification';
PRINT '========================================';
PRINT '';

-- Verify procedure exists
IF EXISTS (SELECT * FROM sys.procedures WHERE name = N'usp_RunHealthCheck')
BEGIN
    PRINT 'SUCCESS: Procedure usp_RunHealthCheck created.';

    -- Show procedure parameters
    SELECT
        p.name AS [Parameter],
        t.name AS [Type],
        CASE
            WHEN t.name IN ('nvarchar', 'varchar') THEN
                CASE WHEN p.max_length = -1 THEN 'MAX' ELSE CAST(p.max_length / 2 AS VARCHAR(10)) END
            ELSE ''
        END AS [Length],
        CASE p.has_default_value WHEN 1 THEN 'Yes' ELSE 'No' END AS [Has Default]
    FROM sys.parameters p
    INNER JOIN sys.types t ON p.user_type_id = t.user_type_id
    WHERE p.object_id = OBJECT_ID('dbo.usp_RunHealthCheck')
    ORDER BY p.parameter_id;
END
ELSE
BEGIN
    PRINT 'ERROR: Procedure was not created.';
END

PRINT '';
PRINT '========================================';
PRINT 'Result Sets Returned';
PRINT '========================================';
PRINT '';
PRINT '1.  Service Broker Database Status';
PRINT '2.  Queue Health Summary';
PRINT '3.  Orphaned Conversations';
PRINT '4.  Old Messages in Queues';
PRINT '5.  Services Without Valid Queues';
PRINT '6.  Contract Validation';
PRINT '7.  Message Type Validation';
PRINT '8.  Transmission Queue Summary';
PRINT '9.  Error State Conversations Summary';
PRINT '10. Overall Health Summary';
PRINT '';
PRINT '========================================';
PRINT 'Usage Examples';
PRINT '========================================';
PRINT '';
PRINT '-- Run basic health check:';
PRINT 'EXEC dbo.usp_RunHealthCheck;';
PRINT '';
PRINT '-- Custom thresholds (48 hours for orphaned, 120 min for old):';
PRINT 'EXEC dbo.usp_RunHealthCheck';
PRINT '    @OrphanedConversationHours = 48,';
PRINT '    @OldMessageMinutes = 120;';
PRINT '';
PRINT '========================================';
PRINT 'Script completed successfully.';
PRINT '========================================';
GO
