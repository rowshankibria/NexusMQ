/*
================================================================================
Script: 32-usp_GetTransmissionQueueStatus.sql
Purpose: Get status of messages in the Service Broker transmission queue
Phase: 0.5D - Diagnostics Stored Procedures
================================================================================
Prerequisites: Phase 0 scripts (00-07) must be run first
================================================================================
The transmission queue (sys.transmission_queue) holds messages that are waiting
to be delivered to their target services. Messages may be stuck here due to:
- Network issues
- Target service/queue disabled
- Security/authentication problems
- Route configuration issues
================================================================================
*/

USE [MessageBus]; -- Change to your target database name
GO

SET NOCOUNT ON;

PRINT '========================================';
PRINT 'Creating usp_GetTransmissionQueueStatus';
PRINT '========================================';
PRINT '';

-- ============================================================================
-- Drop existing procedure if it exists
-- ============================================================================
IF EXISTS (SELECT * FROM sys.procedures WHERE name = N'usp_GetTransmissionQueueStatus')
BEGIN
    DROP PROCEDURE [dbo].[usp_GetTransmissionQueueStatus];
    PRINT 'Dropped existing procedure.';
END
GO

-- ============================================================================
-- Procedure: usp_GetTransmissionQueueStatus
-- Purpose: Returns all messages currently in the transmission queue
-- ============================================================================
CREATE PROCEDURE [dbo].[usp_GetTransmissionQueueStatus]
    @MinStuckSeconds INT = 0,              -- Filter: minimum seconds in queue
    @ServiceNameFilter NVARCHAR(256) = NULL -- Filter: specific target service
AS
BEGIN
    SET NOCOUNT ON;

    DECLARE @CurrentTime DATETIME = GETDATE();

    SELECT
        -- Conversation identification
        tq.conversation_handle,
        tq.conversation_id,

        -- Service routing information
        tq.to_service_name,
        tq.to_broker_instance,
        tq.from_service_name,

        -- Contract and message type
        tq.service_contract_name,
        tq.message_type_name,

        -- Timing information
        tq.enqueue_time,
        DATEDIFF(SECOND, tq.enqueue_time, @CurrentTime) AS stuck_seconds,
        DATEDIFF(MINUTE, tq.enqueue_time, @CurrentTime) AS stuck_minutes,

        -- Status information (contains error details if delivery failed)
        tq.transmission_status,
        CASE
            WHEN tq.transmission_status IS NULL OR tq.transmission_status = '' THEN 'Pending'
            WHEN tq.transmission_status LIKE '%dialog%' THEN 'Dialog Error'
            WHEN tq.transmission_status LIKE '%route%' THEN 'Routing Error'
            WHEN tq.transmission_status LIKE '%security%' THEN 'Security Error'
            WHEN tq.transmission_status LIKE '%connection%' THEN 'Connection Error'
            ELSE 'Error'
        END AS status_category,

        -- Message priority and sequence
        tq.priority,
        tq.message_sequence_number,

        -- Message body (may be NULL for some message types)
        tq.message_body,
        CASE
            WHEN tq.message_body IS NOT NULL THEN DATALENGTH(tq.message_body)
            ELSE 0
        END AS message_body_size,

        -- Is this a conversation-ending message?
        tq.is_conversation_error,
        tq.is_end_of_dialog

    FROM sys.transmission_queue tq
    WHERE
        -- Filter by minimum time stuck
        DATEDIFF(SECOND, tq.enqueue_time, @CurrentTime) >= @MinStuckSeconds
        -- Filter by service name if provided
        AND (@ServiceNameFilter IS NULL OR tq.to_service_name = @ServiceNameFilter)
    ORDER BY
        tq.enqueue_time ASC; -- Oldest first

    -- Return summary counts
    SELECT
        COUNT(*) AS total_messages,
        COUNT(CASE WHEN DATEDIFF(MINUTE, enqueue_time, @CurrentTime) > 5 THEN 1 END) AS stuck_over_5min,
        COUNT(CASE WHEN DATEDIFF(MINUTE, enqueue_time, @CurrentTime) > 30 THEN 1 END) AS stuck_over_30min,
        COUNT(CASE WHEN DATEDIFF(HOUR, enqueue_time, @CurrentTime) > 1 THEN 1 END) AS stuck_over_1hour,
        COUNT(CASE WHEN transmission_status IS NOT NULL AND transmission_status != '' THEN 1 END) AS with_errors,
        MIN(enqueue_time) AS oldest_message_time,
        DATEDIFF(SECOND, MIN(enqueue_time), @CurrentTime) AS oldest_message_age_seconds
    FROM sys.transmission_queue;

END
GO

PRINT 'Created procedure: usp_GetTransmissionQueueStatus';

-- ============================================================================
-- Verification and Test
-- ============================================================================
PRINT '';
PRINT '========================================';
PRINT 'Verification';
PRINT '========================================';
PRINT '';

-- Verify procedure exists
IF EXISTS (SELECT * FROM sys.procedures WHERE name = N'usp_GetTransmissionQueueStatus')
BEGIN
    PRINT 'SUCCESS: Procedure usp_GetTransmissionQueueStatus created.';

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
    WHERE p.object_id = OBJECT_ID('dbo.usp_GetTransmissionQueueStatus')
    ORDER BY p.parameter_id;
END
ELSE
BEGIN
    PRINT 'ERROR: Procedure was not created.';
END

PRINT '';
PRINT '========================================';
PRINT 'Usage Examples';
PRINT '========================================';
PRINT '';
PRINT '-- Get all messages in transmission queue:';
PRINT 'EXEC dbo.usp_GetTransmissionQueueStatus;';
PRINT '';
PRINT '-- Get messages stuck for more than 60 seconds:';
PRINT 'EXEC dbo.usp_GetTransmissionQueueStatus @MinStuckSeconds = 60;';
PRINT '';
PRINT '-- Get messages for a specific target service:';
PRINT 'EXEC dbo.usp_GetTransmissionQueueStatus @ServiceNameFilter = N''RequestService'';';
PRINT '';
PRINT '========================================';
PRINT 'Script completed successfully.';
PRINT '========================================';
GO
