/*
================================================================================
Script: 31-usp_GetConversationTrace.sql
Purpose: Get detailed trace information for a Service Broker conversation
Phase: 0.5C - Management Stored Procedures
================================================================================
Prerequisites:
  - Phase 0 scripts (00-07) must be run first
  - Phase 0.5A scripts (10-14) must be run first
  - Phase 0.5B scripts (20-24) must be run first
================================================================================
This procedure returns comprehensive information about a conversation including
metadata, message history from audit trail, and state information.
================================================================================
*/

USE [MessageBus]; -- Change to your target database name
GO

SET NOCOUNT ON;

PRINT '========================================';
PRINT 'Creating usp_GetConversationTrace Procedure';
PRINT '========================================';
PRINT '';

-- ============================================================================
-- Procedure: usp_GetConversationTrace
-- Purpose: Get detailed trace information for a Service Broker conversation
-- ============================================================================
IF EXISTS (SELECT * FROM sys.procedures WHERE name = N'usp_GetConversationTrace' AND schema_id = SCHEMA_ID('dbo'))
BEGIN
    DROP PROCEDURE [dbo].[usp_GetConversationTrace];
    PRINT 'Dropped existing procedure: usp_GetConversationTrace';
END
GO

CREATE PROCEDURE [dbo].[usp_GetConversationTrace]
    @ConversationHandle UNIQUEIDENTIFIER = NULL,
    @ConversationId UNIQUEIDENTIFIER = NULL,
    @IncludeDeadLetterHistory BIT = 1,          -- Include dead letter queue records
    @IncludeTransmissionQueue BIT = 1           -- Include transmission queue info
AS
BEGIN
    SET NOCOUNT ON;

    DECLARE @ErrorMessage NVARCHAR(4000);
    DECLARE @ErrorSeverity INT;
    DECLARE @ErrorState INT;

    -- Working variables
    DECLARE @ActualConversationHandle UNIQUEIDENTIFIER;
    DECLARE @ActualConversationId UNIQUEIDENTIFIER;

    BEGIN TRY
        -- Validate that at least one identifier is provided
        IF @ConversationHandle IS NULL AND @ConversationId IS NULL
        BEGIN
            RAISERROR('Either @ConversationHandle or @ConversationId must be provided.', 16, 1);
        END

        -- Resolve conversation handle/ID
        IF @ConversationHandle IS NOT NULL
        BEGIN
            SET @ActualConversationHandle = @ConversationHandle;

            -- Try to get conversation ID from endpoints
            SELECT @ActualConversationId = conversation_id
            FROM sys.conversation_endpoints
            WHERE conversation_handle = @ConversationHandle;

            -- If not found in endpoints, try audit trail
            IF @ActualConversationId IS NULL
            BEGIN
                SELECT TOP 1 @ActualConversationId = ConversationId
                FROM dbo.MessageAuditTrail
                WHERE ConversationHandle = @ConversationHandle
                  AND ConversationId IS NOT NULL;
            END
        END
        ELSE
        BEGIN
            SET @ActualConversationId = @ConversationId;

            -- Try to get conversation handle
            SELECT TOP 1 @ActualConversationHandle = conversation_handle
            FROM sys.conversation_endpoints
            WHERE conversation_id = @ConversationId;

            -- If not found in endpoints, try audit trail
            IF @ActualConversationHandle IS NULL
            BEGIN
                SELECT TOP 1 @ActualConversationHandle = ConversationHandle
                FROM dbo.MessageAuditTrail
                WHERE ConversationId = @ConversationId;
            END
        END

        -- ================================================================
        -- Result Set 1: Conversation Metadata
        -- ================================================================
        SELECT
            'CONVERSATION_METADATA' AS ResultSetType,
            ce.conversation_handle AS ConversationHandle,
            ce.conversation_id AS ConversationId,
            ce.is_initiator AS IsInitiator,
            ce.state AS StateCode,
            CASE ce.state
                WHEN 'SO' THEN 'Started Outbound'
                WHEN 'SI' THEN 'Started Inbound'
                WHEN 'CO' THEN 'Conversing'
                WHEN 'DI' THEN 'Disconnected Inbound'
                WHEN 'DO' THEN 'Disconnected Outbound'
                WHEN 'ER' THEN 'Error'
                WHEN 'CD' THEN 'Closed'
                ELSE 'Unknown (' + ISNULL(ce.state, 'NULL') + ')'
            END AS StateDescription,
            s.name AS ServiceName,
            ce.far_service AS FarServiceName,
            ce.far_broker_instance AS FarBrokerInstance,
            ce.principal_id AS PrincipalId,
            ce.lifetime AS LifetimeExpiresAt,
            CASE
                WHEN ce.lifetime < GETUTCDATE() THEN 'Expired'
                ELSE CAST(DATEDIFF(MINUTE, GETUTCDATE(), ce.lifetime) AS NVARCHAR(20)) + ' minutes remaining'
            END AS LifetimeStatus,
            ce.receive_sequence AS ReceiveSequence,
            ce.send_sequence AS SendSequence,
            ce.receive_sequence_frag AS ReceiveSequenceFrag,
            ce.send_sequence_frag AS SendSequenceFrag
        FROM sys.conversation_endpoints ce
        LEFT JOIN sys.services s ON ce.service_id = s.service_id
        WHERE ce.conversation_handle = @ActualConversationHandle
           OR ce.conversation_id = @ActualConversationId;

        -- If no active endpoint found, return info from audit trail
        IF @@ROWCOUNT = 0
        BEGIN
            SELECT
                'CONVERSATION_METADATA' AS ResultSetType,
                @ActualConversationHandle AS ConversationHandle,
                @ActualConversationId AS ConversationId,
                NULL AS IsInitiator,
                'HIST' AS StateCode,
                'Historical (conversation ended)' AS StateDescription,
                MAX(mat.ServiceName) AS ServiceName,
                NULL AS FarServiceName,
                NULL AS FarBrokerInstance,
                NULL AS PrincipalId,
                NULL AS LifetimeExpiresAt,
                'Conversation has ended' AS LifetimeStatus,
                NULL AS ReceiveSequence,
                NULL AS SendSequence,
                NULL AS ReceiveSequenceFrag,
                NULL AS SendSequenceFrag
            FROM dbo.MessageAuditTrail mat
            WHERE mat.ConversationHandle = @ActualConversationHandle
               OR mat.ConversationId = @ActualConversationId;
        END

        -- ================================================================
        -- Result Set 2: Message Timeline from Audit Trail
        -- ================================================================
        SELECT
            'MESSAGE_TIMELINE' AS ResultSetType,
            mat.Id AS AuditId,
            mat.OperationTimestamp,
            mat.Operation,
            mat.QueueName,
            mat.ServiceName,
            mat.MessageTypeName,
            mat.MessageSequenceNumber,
            mat.MessageBodyPreview,
            mat.MessageSizeBytes,
            mat.ApplicationName,
            mat.UserName,
            mat.HostName,
            ROW_NUMBER() OVER (ORDER BY mat.OperationTimestamp) AS SequenceNumber
        FROM dbo.MessageAuditTrail mat
        WHERE mat.ConversationHandle = @ActualConversationHandle
           OR mat.ConversationId = @ActualConversationId
        ORDER BY mat.OperationTimestamp;

        -- ================================================================
        -- Result Set 3: Dead Letter Queue History (if requested)
        -- ================================================================
        IF @IncludeDeadLetterHistory = 1
        BEGIN
            SELECT
                'DEADLETTER_HISTORY' AS ResultSetType,
                dlq.Id AS DeadLetterId,
                dlq.ConversationHandle,
                dlq.ConversationId,
                dlq.SourceQueueName,
                dlq.ServiceName,
                dlq.MessageTypeName,
                dlq.ErrorMessage,
                dlq.ErrorNumber,
                dlq.RetryCount,
                dlq.MaxRetries,
                dlq.OriginalEnqueueTime,
                dlq.MovedToDeadLetterAt,
                dlq.LastRetryAt,
                dlq.ResolvedAt,
                dlq.ResolutionNotes,
                dlq.ResolvedBy,
                CASE
                    WHEN dlq.ResolvedAt IS NOT NULL THEN 'Resolved'
                    WHEN dlq.RetryCount >= dlq.MaxRetries THEN 'Max Retries Exceeded'
                    ELSE 'Pending'
                END AS Status
            FROM dbo.DeadLetterQueue dlq
            WHERE dlq.ConversationHandle = @ActualConversationHandle
               OR dlq.ConversationId = @ActualConversationId
            ORDER BY dlq.MovedToDeadLetterAt;
        END

        -- ================================================================
        -- Result Set 4: Transmission Queue Status (if requested)
        -- ================================================================
        IF @IncludeTransmissionQueue = 1
        BEGIN
            SELECT
                'TRANSMISSION_QUEUE' AS ResultSetType,
                tq.conversation_handle AS ConversationHandle,
                tq.to_service_name AS ToServiceName,
                tq.to_broker_instance AS ToBrokerInstance,
                tq.from_service_name AS FromServiceName,
                tq.service_contract_name AS ContractName,
                tq.enqueue_time AS EnqueueTime,
                tq.message_sequence_number AS MessageSequenceNumber,
                tq.message_type_name AS MessageTypeName,
                tq.is_conversation_error AS IsConversationError,
                tq.is_end_of_dialog AS IsEndOfDialog,
                tq.transmission_status AS TransmissionStatus,
                DATALENGTH(tq.message_body) AS MessageSizeBytes
            FROM sys.transmission_queue tq
            WHERE tq.conversation_handle = @ActualConversationHandle;
        END

        -- ================================================================
        -- Result Set 5: Conversation Summary Statistics
        -- ================================================================
        SELECT
            'SUMMARY_STATISTICS' AS ResultSetType,
            @ActualConversationHandle AS ConversationHandle,
            @ActualConversationId AS ConversationId,
            COUNT(*) AS TotalAuditRecords,
            SUM(CASE WHEN mat.Operation = 'SEND' THEN 1 ELSE 0 END) AS SendCount,
            SUM(CASE WHEN mat.Operation = 'RECEIVE' THEN 1 ELSE 0 END) AS ReceiveCount,
            SUM(CASE WHEN mat.Operation = 'ERROR' THEN 1 ELSE 0 END) AS ErrorCount,
            SUM(CASE WHEN mat.Operation = 'END_CONVERSATION' THEN 1 ELSE 0 END) AS EndConversationCount,
            SUM(CASE WHEN mat.Operation LIKE '%RETRY%' THEN 1 ELSE 0 END) AS RetryCount,
            SUM(CASE WHEN mat.Operation LIKE '%DEADLETTER%' THEN 1 ELSE 0 END) AS DeadLetterCount,
            MIN(mat.OperationTimestamp) AS FirstActivity,
            MAX(mat.OperationTimestamp) AS LastActivity,
            DATEDIFF(SECOND, MIN(mat.OperationTimestamp), MAX(mat.OperationTimestamp)) AS DurationSeconds,
            SUM(ISNULL(mat.MessageSizeBytes, 0)) AS TotalBytesProcessed
        FROM dbo.MessageAuditTrail mat
        WHERE mat.ConversationHandle = @ActualConversationHandle
           OR mat.ConversationId = @ActualConversationId;

    END TRY
    BEGIN CATCH
        SET @ErrorMessage = ERROR_MESSAGE();
        SET @ErrorSeverity = ERROR_SEVERITY();
        SET @ErrorState = ERROR_STATE();

        RAISERROR(@ErrorMessage, @ErrorSeverity, @ErrorState);
    END CATCH
END
GO

PRINT 'Created procedure: usp_GetConversationTrace';

-- ============================================================================
-- Add extended properties for documentation
-- ============================================================================
IF NOT EXISTS (SELECT * FROM sys.extended_properties
               WHERE major_id = OBJECT_ID('dbo.usp_GetConversationTrace') AND name = 'MS_Description')
BEGIN
    EXEC sp_addextendedproperty
        @name = N'MS_Description',
        @value = N'Returns comprehensive trace information for a Service Broker conversation including metadata, message history, dead letter records, and transmission queue status.',
        @level0type = N'SCHEMA', @level0name = N'dbo',
        @level1type = N'PROCEDURE', @level1name = N'usp_GetConversationTrace';
    PRINT 'Added procedure description.';
END
GO

-- ============================================================================
-- Verification
-- ============================================================================
PRINT '';
PRINT '========================================';
PRINT 'Verification - usp_GetConversationTrace';
PRINT '========================================';
PRINT '';

SELECT
    p.name AS [Procedure Name],
    p.create_date AS [Created],
    p.modify_date AS [Last Modified]
FROM sys.procedures p
WHERE p.name = N'usp_GetConversationTrace';

PRINT '';
PRINT 'Parameters:';
PRINT '-----------';

SELECT
    par.name AS [Parameter],
    t.name AS [Type],
    CASE par.is_output WHEN 1 THEN 'Yes' ELSE 'No' END AS [Output]
FROM sys.parameters par
INNER JOIN sys.types t ON par.user_type_id = t.user_type_id
WHERE par.object_id = OBJECT_ID('dbo.usp_GetConversationTrace')
ORDER BY par.parameter_id;

PRINT '';
PRINT '========================================';
PRINT 'Return Result Sets:';
PRINT '========================================';
PRINT '';
PRINT '1. CONVERSATION_METADATA:';
PRINT '   - Conversation handle, ID, state';
PRINT '   - Service names (local and far)';
PRINT '   - Lifetime and sequence numbers';
PRINT '';
PRINT '2. MESSAGE_TIMELINE:';
PRINT '   - Chronological list of all operations';
PRINT '   - SEND, RECEIVE, ERROR, etc.';
PRINT '   - Message previews and sizes';
PRINT '';
PRINT '3. DEADLETTER_HISTORY (optional):';
PRINT '   - Any dead letter records for this conversation';
PRINT '   - Retry attempts and resolution status';
PRINT '';
PRINT '4. TRANSMISSION_QUEUE (optional):';
PRINT '   - Pending messages in transmission queue';
PRINT '   - Transmission status and errors';
PRINT '';
PRINT '5. SUMMARY_STATISTICS:';
PRINT '   - Counts by operation type';
PRINT '   - Duration and total bytes processed';
PRINT '';
PRINT '========================================';
PRINT 'Usage Examples:';
PRINT '========================================';
PRINT '';
PRINT '-- Trace by conversation handle';
PRINT 'EXEC dbo.usp_GetConversationTrace';
PRINT '    @ConversationHandle = ''12345678-1234-1234-1234-123456789ABC'';';
PRINT '';
PRINT '-- Trace by conversation ID';
PRINT 'EXEC dbo.usp_GetConversationTrace';
PRINT '    @ConversationId = ''87654321-4321-4321-4321-CBA987654321'';';
PRINT '';
PRINT '-- Trace without dead letter/transmission info';
PRINT 'EXEC dbo.usp_GetConversationTrace';
PRINT '    @ConversationHandle = ''12345678-1234-1234-1234-123456789ABC'',';
PRINT '    @IncludeDeadLetterHistory = 0,';
PRINT '    @IncludeTransmissionQueue = 0;';
PRINT '';
PRINT '========================================';
PRINT 'Script completed successfully.';
PRINT '========================================';
GO
