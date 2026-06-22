/*
================================================================================
Script: 33-usp_GetDialogErrors.sql
Purpose: Get conversations that are in error or disconnected states
Phase: 0.5D - Diagnostics Stored Procedures
================================================================================
Prerequisites: Phase 0 scripts (00-07) must be run first
================================================================================
This procedure identifies conversations in problematic states:
- ER: Error state - conversation encountered an error
- CD: Closed on Disconnect - conversation was closed due to disconnect
- DI: Disconnected Inbound - inbound side disconnected
These conversations may need cleanup or investigation.
================================================================================
*/

USE [MessageBus]; -- Change to your target database name
GO

SET NOCOUNT ON;

PRINT '========================================';
PRINT 'Creating usp_GetDialogErrors';
PRINT '========================================';
PRINT '';

-- ============================================================================
-- Drop existing procedure if it exists
-- ============================================================================
IF EXISTS (SELECT * FROM sys.procedures WHERE name = N'usp_GetDialogErrors')
BEGIN
    DROP PROCEDURE [dbo].[usp_GetDialogErrors];
    PRINT 'Dropped existing procedure.';
END
GO

-- ============================================================================
-- Procedure: usp_GetDialogErrors
-- Purpose: Returns conversations in error or disconnected states
-- ============================================================================
CREATE PROCEDURE [dbo].[usp_GetDialogErrors]
    @IncludeAllErrorStates BIT = 1,    -- Include CD, DI states in addition to ER
    @MinAgeSeconds INT = 0,             -- Minimum age of error
    @ServiceNameFilter NVARCHAR(256) = NULL  -- Filter by service name
AS
BEGIN
    SET NOCOUNT ON;

    DECLARE @CurrentTime DATETIME = GETDATE();

    -- Main query: Get all conversations in error/problematic states
    SELECT
        -- Conversation identification
        ce.conversation_handle,
        ce.conversation_id,

        -- State information
        ce.state,
        ce.state_desc,
        CASE ce.state
            WHEN 'ER' THEN 'Error - Conversation failed'
            WHEN 'CD' THEN 'Closed on Disconnect - Remote endpoint disconnected'
            WHEN 'DI' THEN 'Disconnected Inbound - Inbound side disconnected'
            WHEN 'DO' THEN 'Disconnected Outbound - Outbound side disconnected'
            ELSE ce.state_desc
        END AS state_description,

        -- Service information
        ce.far_service,
        ce.far_broker_instance,
        ce.is_initiator,

        -- Timing information
        ce.lifetime AS conversation_lifetime,
        DATEDIFF(SECOND, ce.lifetime, @CurrentTime) AS seconds_since_lifetime,

        -- Security
        ce.principal_id,
        ce.security_timestamp,

        -- Associated transmission queue status (if any)
        tq.transmission_status,
        tq.enqueue_time AS transmission_enqueue_time,
        CASE
            WHEN tq.transmission_status IS NOT NULL THEN
                DATEDIFF(SECOND, tq.enqueue_time, @CurrentTime)
            ELSE NULL
        END AS transmission_stuck_seconds,

        -- Additional context from transmission queue
        tq.to_service_name,
        tq.message_type_name,
        DATALENGTH(tq.message_body) AS pending_message_size

    FROM sys.conversation_endpoints ce
    LEFT JOIN sys.transmission_queue tq
        ON ce.conversation_handle = tq.conversation_handle
    WHERE
        -- Filter by error states
        (
            ce.state = 'ER'  -- Error state (always included)
            OR (@IncludeAllErrorStates = 1 AND ce.state IN ('CD', 'DI', 'DO'))
        )
        -- Filter by minimum age
        AND DATEDIFF(SECOND, ce.lifetime, @CurrentTime) >= @MinAgeSeconds
        -- Filter by service name if provided
        AND (@ServiceNameFilter IS NULL OR ce.far_service = @ServiceNameFilter)
    ORDER BY
        ce.state,
        ce.lifetime DESC;

    -- Return summary by state
    SELECT
        ce.state,
        ce.state_desc,
        COUNT(*) AS conversation_count,
        MIN(ce.lifetime) AS oldest_error,
        MAX(ce.lifetime) AS newest_error,
        COUNT(tq.conversation_handle) AS with_pending_transmission
    FROM sys.conversation_endpoints ce
    LEFT JOIN sys.transmission_queue tq
        ON ce.conversation_handle = tq.conversation_handle
    WHERE ce.state IN ('ER', 'CD', 'DI', 'DO')
    GROUP BY ce.state, ce.state_desc
    ORDER BY ce.state;

    -- Return error patterns (common transmission status messages)
    SELECT TOP 10
        tq.transmission_status,
        COUNT(*) AS occurrence_count,
        MIN(tq.enqueue_time) AS first_occurrence,
        MAX(tq.enqueue_time) AS last_occurrence
    FROM sys.transmission_queue tq
    INNER JOIN sys.conversation_endpoints ce
        ON tq.conversation_handle = ce.conversation_handle
    WHERE
        ce.state IN ('ER', 'CD', 'DI', 'DO')
        AND tq.transmission_status IS NOT NULL
        AND tq.transmission_status != ''
    GROUP BY tq.transmission_status
    ORDER BY COUNT(*) DESC;

END
GO

PRINT 'Created procedure: usp_GetDialogErrors';

-- ============================================================================
-- Verification and Test
-- ============================================================================
PRINT '';
PRINT '========================================';
PRINT 'Verification';
PRINT '========================================';
PRINT '';

-- Verify procedure exists
IF EXISTS (SELECT * FROM sys.procedures WHERE name = N'usp_GetDialogErrors')
BEGIN
    PRINT 'SUCCESS: Procedure usp_GetDialogErrors created.';

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
    WHERE p.object_id = OBJECT_ID('dbo.usp_GetDialogErrors')
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
PRINT '-- Get all dialog errors (all error states):';
PRINT 'EXEC dbo.usp_GetDialogErrors;';
PRINT '';
PRINT '-- Get only strict ER (error) state conversations:';
PRINT 'EXEC dbo.usp_GetDialogErrors @IncludeAllErrorStates = 0;';
PRINT '';
PRINT '-- Get errors older than 1 hour:';
PRINT 'EXEC dbo.usp_GetDialogErrors @MinAgeSeconds = 3600;';
PRINT '';
PRINT '-- Get errors for a specific service:';
PRINT 'EXEC dbo.usp_GetDialogErrors @ServiceNameFilter = N''RequestService'';';
PRINT '';
PRINT '========================================';
PRINT 'Script completed successfully.';
PRINT '========================================';
GO
