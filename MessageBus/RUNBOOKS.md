# Service Broker Message Bus - Operational Runbooks

This document contains operational runbooks for common scenarios and issues in the Service Broker Message Bus application.

---

## Table of Contents

1. [Runbook 1: Queue Disabled Due to Poison Message](#runbook-1-queue-disabled-due-to-poison-message)
2. [Runbook 2: Messages Stuck in Transmission Queue](#runbook-2-messages-stuck-in-transmission-queue)
3. [Runbook 3: Consumer Service Crash with Queue Backup](#runbook-3-consumer-service-crash-with-queue-backup)
4. [Runbook 4: Test Message Publishing](#runbook-4-test-message-publishing)
5. [Runbook 5: High-Volume Testing](#runbook-5-high-volume-testing)

---

## Runbook 1: Queue Disabled Due to Poison Message

### Symptoms
- Queue shows "Disabled" status in dashboard
- Messages are accumulating but not being processed
- Alert triggered for queue disabled state
- Error in logs: "Queue has been disabled due to poison message"

### Impact
- **Severity:** High
- **Services Affected:** Any service depending on the disabled queue
- **User Impact:** Message processing halted for affected queue

### Root Cause
A poison message (a message that repeatedly fails processing) has exceeded the retry threshold, causing SQL Server Service Broker to automatically disable the queue to prevent infinite retry loops.

### Diagnosis Steps

#### Step 1: Identify the Disabled Queue

**Via UI:**
1. Navigate to Dashboard
2. Look for queues with "Disabled" status badge (red)
3. Or navigate to Queue Explorer and filter by "Disabled"

**Via SQL:**
```sql
-- Find disabled queues
SELECT name, is_receive_enabled, is_enqueue_enabled
FROM sys.service_queues
WHERE is_receive_enabled = 0 OR is_enqueue_enabled = 0;
```

**Via API:**
```bash
curl -X GET "http://localhost:5000/api/queues" \
  -H "X-API-Key: your-api-key" | jq '.[] | select(.isReceiveEnabled == false)'
```

#### Step 2: Identify the Poison Message

**Via UI:**
1. Navigate to Poison Messages
2. Filter by the disabled queue name
3. View the most recent poison message

**Via SQL:**
```sql
-- View poison messages for the queue
SELECT TOP 10
    conversation_handle,
    message_type_name,
    message_body,
    queuing_order,
    service_name
FROM [YourQueueName]
ORDER BY queuing_order;

-- Check dead letter queue
SELECT * FROM dbo.DeadLetterQueue
WHERE SourceQueueName = 'YourQueueName'
ORDER BY CreatedAt DESC;
```

#### Step 3: Analyze the Error

**Via UI:**
1. Click on the poison message to view details
2. Review the error trace and stack trace
3. Check retry history for patterns

**Via SQL:**
```sql
-- Check message audit trail for errors
SELECT TOP 10 *
FROM dbo.MessageAuditTrail
WHERE ConversationHandle = 'poison-message-conversation-handle'
ORDER BY Timestamp DESC;
```

### Resolution Steps

#### Option A: Retry the Poison Message

**If the underlying issue has been fixed:**

**Via UI:**
1. Navigate to Poison Messages
2. Select the poison message
3. Click "Retry" button
4. Confirm the retry action
5. The queue will be automatically re-enabled

**Via API:**
```bash
curl -X POST "http://localhost:5000/api/poison-messages/{id}/retry" \
  -H "X-API-Key: your-api-key"
```

**Via SQL:**
```sql
-- Re-enable the queue
ALTER QUEUE [YourQueueName] WITH STATUS = ON;

-- The message will be reprocessed when the activation procedure runs
```

#### Option B: Move to Dead Letter Queue

**If the message cannot be processed and should be archived:**

**Via UI:**
1. Navigate to Poison Messages
2. Select the poison message
3. Click "Purge" button
4. Add resolution notes
5. Confirm the action

**Via API:**
```bash
curl -X POST "http://localhost:5000/api/poison-messages/{id}/purge" \
  -H "X-API-Key: your-api-key" \
  -H "Content-Type: application/json" \
  -d '{"reason": "Manual purge - data format incompatible"}'
```

**Via SQL:**
```sql
-- Execute the move to dead letter procedure
EXEC dbo.usp_MoveToDeadLetter
    @ConversationHandle = 'conversation-handle-guid',
    @Reason = 'Manual purge - data format incompatible';
```

#### Option C: Manually Re-enable Queue

**If you need to re-enable without processing the poison message:**

```sql
-- Re-enable receive and enqueue
ALTER QUEUE [YourQueueName] WITH STATUS = ON;

-- Verify
SELECT name, is_receive_enabled, is_enqueue_enabled
FROM sys.service_queues
WHERE name = 'YourQueueName';
```

### Prevention
- Implement proper message validation before sending
- Add robust error handling in activation procedures
- Configure appropriate retry policies
- Monitor queue health metrics proactively
- Set up alerts for poison message occurrences

### Verification
After resolution:
1. Verify queue status is "Active" in Dashboard
2. Confirm messages are being processed
3. Check no new poison messages are occurring
4. Review message throughput metrics

---

## Runbook 2: Messages Stuck in Transmission Queue

### Symptoms
- Messages accumulating in transmission queue
- "Transmission Queue" count increasing on Dashboard
- Delayed message delivery between services
- Dialog errors showing connectivity issues

### Impact
- **Severity:** Medium to High
- **Services Affected:** Cross-service communication
- **User Impact:** Delayed or failed message delivery

### Root Cause Possibilities
1. Network connectivity issues between SQL Server instances
2. Target service unavailable
3. Certificate/authentication issues
4. Firewall blocking Service Broker ports (default: 4022)
5. Database or service endpoint misconfiguration

### Diagnosis Steps

#### Step 1: Check Transmission Queue Status

**Via UI:**
1. Navigate to Diagnostics
2. Select "Transmission Queue" tab
3. Review entries with transmission_status not empty

**Via API:**
```bash
curl -X GET "http://localhost:5000/api/diagnostics/transmission-queue" \
  -H "X-API-Key: your-api-key"
```

**Via SQL:**
```sql
-- View transmission queue with details
SELECT
    conversation_handle,
    to_service_name,
    service_contract_name,
    transmission_status,
    is_conversation_error,
    enqueue_time,
    message_type_name
FROM sys.transmission_queue
ORDER BY enqueue_time;
```

#### Step 2: Check for Dialog Errors

**Via UI:**
1. Navigate to Diagnostics
2. Select "Dialog Errors" tab
3. Review recent errors

**Via SQL:**
```sql
-- Check conversation endpoints for errors
SELECT
    ce.conversation_handle,
    ce.state_desc,
    ce.far_service,
    ce.far_broker_instance,
    ce.lifetime
FROM sys.conversation_endpoints ce
WHERE ce.state_desc LIKE '%ERROR%';

-- Check for broker errors
SELECT * FROM sys.transmission_queue
WHERE transmission_status IS NOT NULL;
```

#### Step 3: Verify Network Connectivity

```powershell
# Test connectivity to remote broker
Test-NetConnection -ComputerName "remote-sql-server" -Port 4022

# Check if Service Broker endpoint is listening
netstat -an | findstr "4022"
```

### Resolution Steps

#### Option A: Force Delivery of Stuck Messages

**Via UI:**
1. Navigate to Diagnostics > Transmission Queue
2. Select stuck messages
3. Click "Force Delivery" (if available)

**Via SQL:**
```sql
-- End and restart conversation
DECLARE @handle uniqueidentifier;
SELECT @handle = conversation_handle
FROM sys.transmission_queue
WHERE enqueue_time < DATEADD(HOUR, -1, GETUTCDATE());

IF @handle IS NOT NULL
BEGIN
    END CONVERSATION @handle WITH CLEANUP;
END
```

#### Option B: Fix Connectivity Issues

1. **Verify Service Broker endpoint:**
```sql
-- Check endpoint status
SELECT name, state_desc, port
FROM sys.service_broker_endpoints;

-- Start endpoint if stopped
ALTER ENDPOINT ServiceBrokerEndpoint STATE = STARTED;
```

2. **Check firewall rules:**
```powershell
# Windows Firewall
Get-NetFirewallRule -DisplayName "*Service Broker*"

# Add rule if needed
New-NetFirewallRule -DisplayName "SQL Service Broker" -Direction Inbound -LocalPort 4022 -Protocol TCP -Action Allow
```

3. **Verify certificates (if using certificate authentication):**
```sql
-- Check certificate expiration
SELECT name, expiry_date, start_date
FROM sys.certificates
WHERE name LIKE '%Broker%';
```

#### Option C: Clear Error Conversations

```sql
-- End conversations with errors
DECLARE @handle uniqueidentifier;

DECLARE error_cursor CURSOR FOR
SELECT conversation_handle
FROM sys.conversation_endpoints
WHERE state_desc LIKE '%ERROR%';

OPEN error_cursor;
FETCH NEXT FROM error_cursor INTO @handle;

WHILE @@FETCH_STATUS = 0
BEGIN
    END CONVERSATION @handle WITH CLEANUP;
    FETCH NEXT FROM error_cursor INTO @handle;
END;

CLOSE error_cursor;
DEALLOCATE error_cursor;
```

### Verification
1. Transmission queue count should decrease
2. Check Diagnostics dashboard for cleared errors
3. Verify message delivery to target services
4. Monitor for new stuck messages

---

## Runbook 3: Consumer Service Crash with Queue Backup

### Symptoms
- Consumer application/service has crashed or stopped
- Messages accumulating in queue (high queue depth)
- Queue depth warning alert triggered
- No message processing activity

### Impact
- **Severity:** High
- **Services Affected:** All services sending to the affected queue
- **User Impact:** Messages not being processed, potential data delays

### Diagnosis Steps

#### Step 1: Confirm Queue Backup

**Via UI:**
1. Navigate to Dashboard
2. Look for queues with high message counts
3. Check "Messages/min" rate - should be near zero if consumer stopped

**Via API:**
```bash
curl -X GET "http://localhost:5000/api/queues/{queueName}" \
  -H "X-API-Key: your-api-key"
```

**Via SQL:**
```sql
-- Check queue depth and age
SELECT
    q.name,
    p.rows as message_count
FROM sys.service_queues q
JOIN sys.partitions p ON q.object_id = p.object_id
WHERE q.name NOT LIKE 'sys%'
ORDER BY p.rows DESC;
```

#### Step 2: Check Activation Procedure Status

```sql
-- Check if activation is enabled and procedure exists
SELECT
    name,
    activation_procedure,
    is_activation_enabled,
    max_queue_readers,
    execute_as_principal_id
FROM sys.service_queues
WHERE name = 'YourQueueName';

-- Check for running activation procedures
SELECT
    r.session_id,
    r.status,
    r.command,
    r.wait_type,
    t.text as query_text
FROM sys.dm_exec_requests r
CROSS APPLY sys.dm_exec_sql_text(r.sql_handle) t
WHERE t.text LIKE '%activation%';
```

#### Step 3: Check for Errors in Activation

```sql
-- Check SQL Server error log for activation errors
EXEC xp_readerrorlog 0, 1, N'activation';

-- Check for errors in queue
SELECT * FROM [YourQueueName]
WHERE message_type_name = 'http://schemas.microsoft.com/SQL/ServiceBroker/Error';
```

### Resolution Steps

#### Option A: Restart Activation Processing

```sql
-- Disable and re-enable activation
ALTER QUEUE [YourQueueName] WITH ACTIVATION (STATUS = OFF);
WAITFOR DELAY '00:00:05';
ALTER QUEUE [YourQueueName] WITH ACTIVATION (STATUS = ON);
```

#### Option B: Manually Process Messages

If activation procedure has issues:

```sql
-- Create a manual processing loop
DECLARE @conversation_handle UNIQUEIDENTIFIER;
DECLARE @message_body VARBINARY(MAX);
DECLARE @message_type NVARCHAR(256);

WHILE EXISTS (SELECT 1 FROM [YourQueueName])
BEGIN
    BEGIN TRY
        BEGIN TRANSACTION;

        WAITFOR (
            RECEIVE TOP(1)
                @conversation_handle = conversation_handle,
                @message_body = message_body,
                @message_type = message_type_name
            FROM [YourQueueName]
        ), TIMEOUT 5000;

        IF @conversation_handle IS NOT NULL
        BEGIN
            -- Process message or log for manual review
            INSERT INTO dbo.MessageAuditTrail (ConversationHandle, MessageType, ProcessedAt)
            VALUES (@conversation_handle, @message_type, GETUTCDATE());

            -- End conversation if needed
            IF @message_type = 'http://schemas.microsoft.com/SQL/ServiceBroker/EndDialog'
                END CONVERSATION @conversation_handle;
        END

        COMMIT;
    END TRY
    BEGIN CATCH
        ROLLBACK;
        -- Log error and continue
        PRINT 'Error processing message: ' + ERROR_MESSAGE();
    END CATCH
END
```

#### Option C: Increase Queue Readers

```sql
-- Increase max queue readers for faster processing
ALTER QUEUE [YourQueueName]
WITH ACTIVATION (
    MAX_QUEUE_READERS = 10  -- Increase from default
);
```

### Prevention
- Implement monitoring for queue depth thresholds
- Set up alerts for consumer service health
- Use multiple queue readers for high-volume queues
- Implement circuit breaker patterns in consumers

### Verification
1. Queue depth decreasing over time
2. Messages/min rate increasing
3. Consumer service logs showing processing activity
4. No new errors in activation

---

## Runbook 4: Test Message Publishing

### Purpose
Test the message publishing flow to verify the system is working correctly.

### Prerequisites
- API is running and accessible
- Database connection is valid
- Target queue exists and is enabled

### Test Steps

#### Step 1: Verify System Health

**Via UI:**
1. Navigate to Dashboard
2. Confirm overall system status is "Healthy"
3. Verify target queue is "Active"

**Via API:**
```bash
curl -X GET "http://localhost:5000/api/health" \
  -H "X-API-Key: your-api-key"
```

#### Step 2: Send a Test Message

**Via UI:**
1. Navigate to Message Sender (Advanced mode required)
2. Select target queue/service
3. Enter test message body:
   ```json
   {
     "testId": "test-001",
     "timestamp": "2024-01-15T10:00:00Z",
     "message": "This is a test message"
   }
   ```
4. Click "Send"
5. Note the returned conversation handle

**Via API:**
```bash
curl -X POST "http://localhost:5000/api/messages/send" \
  -H "X-API-Key: your-api-key" \
  -H "Content-Type: application/json" \
  -d '{
    "targetService": "MessageBusTargetService",
    "messageType": "MessageBusDefaultMessageType",
    "messageBody": "{\"testId\":\"test-001\",\"timestamp\":\"2024-01-15T10:00:00Z\",\"message\":\"This is a test message\"}",
    "priority": 5
  }'
```

#### Step 3: Verify Message Delivery

**Via UI:**
1. Navigate to Queue Explorer
2. Select the target queue
3. Click "Peek Messages"
4. Verify test message is visible

**Via SQL:**
```sql
-- Check the target queue
SELECT TOP 5
    conversation_handle,
    message_type_name,
    CAST(message_body AS NVARCHAR(MAX)) as body,
    queuing_order
FROM [YourTargetQueue];
```

#### Step 4: Verify Message Processing

**Via UI:**
1. Navigate to Conversation Trace
2. Search for the conversation handle
3. Verify message flow in timeline

**Via API:**
```bash
curl -X GET "http://localhost:5000/api/conversations/{conversation-handle}/trace" \
  -H "X-API-Key: your-api-key"
```

### Expected Results
- Message sends successfully (HTTP 200/201)
- Message appears in target queue
- Conversation trace shows message flow
- No errors in diagnostics

### Troubleshooting
If message doesn't appear:
1. Check transmission queue for stuck messages
2. Verify service configuration
3. Check activation procedure status
4. Review error logs

---

## Runbook 5: High-Volume Testing

### Purpose
Test system performance under high message volume to validate capacity and identify bottlenecks.

### Prerequisites
- Dedicated test environment (not production)
- Monitoring configured
- Baseline metrics collected

### Pre-Test Checklist
- [ ] Backup database before testing
- [ ] Clear existing test data
- [ ] Reset performance counters
- [ ] Notify stakeholders of testing window

### Test Steps

#### Step 1: Prepare Test Data

**Via API (Bulk Send):**
```bash
curl -X POST "http://localhost:5000/api/messages/send-bulk" \
  -H "X-API-Key: your-api-key" \
  -H "Content-Type: application/json" \
  -d '{
    "targetService": "MessageBusTargetService",
    "messageType": "MessageBusDefaultMessageType",
    "messageBodyTemplate": "{\"testId\":\"{{index}}\",\"timestamp\":\"{{timestamp}}\",\"data\":\"test-payload-data\"}",
    "count": 1000,
    "batchSize": 100
  }'
```

**Via SQL (Direct Insert):**
```sql
-- Generate test messages
DECLARE @i INT = 1;
DECLARE @batchSize INT = 100;
DECLARE @totalMessages INT = 10000;

WHILE @i <= @totalMessages
BEGIN
    BEGIN TRANSACTION;

    DECLARE @batch INT = 1;
    WHILE @batch <= @batchSize AND @i <= @totalMessages
    BEGIN
        EXEC dbo.usp_SendMessage
            @TargetService = 'MessageBusTargetService',
            @MessageType = 'MessageBusDefaultMessageType',
            @MessageBody = '{"testId": "' + CAST(@i AS VARCHAR) + '", "data": "test"}',
            @Priority = 5;

        SET @batch = @batch + 1;
        SET @i = @i + 1;
    END

    COMMIT;

    -- Progress indicator
    IF @i % 1000 = 0
        PRINT 'Sent ' + CAST(@i AS VARCHAR) + ' messages';
END
```

#### Step 2: Monitor During Test

**Via UI:**
1. Keep Dashboard open during test
2. Monitor queue depth in real-time
3. Watch throughput chart
4. Check for warnings/errors

**Via SQL:**
```sql
-- Monitor queue depth over time
SELECT
    GETUTCDATE() as sample_time,
    q.name,
    p.rows as message_count
FROM sys.service_queues q
JOIN sys.partitions p ON q.object_id = p.object_id
WHERE q.name NOT LIKE 'sys%'
ORDER BY p.rows DESC;
```

#### Step 3: Collect Performance Metrics

**Via API:**
```bash
# Get performance metrics
curl -X GET "http://localhost:5000/api/diagnostics/metrics?timeRange=1h" \
  -H "X-API-Key: your-api-key"
```

**Via SQL:**
```sql
-- Collect throughput statistics
SELECT
    DATEPART(MINUTE, Timestamp) as minute,
    COUNT(*) as messages_processed,
    AVG(DATEDIFF(MILLISECOND, SentAt, ReceivedAt)) as avg_latency_ms
FROM dbo.MessageAuditTrail
WHERE Timestamp > DATEADD(HOUR, -1, GETUTCDATE())
GROUP BY DATEPART(MINUTE, Timestamp)
ORDER BY minute;
```

### Performance Targets

| Metric | Target | Acceptable | Alert Threshold |
|--------|--------|------------|-----------------|
| Messages/second | > 1000 | > 500 | < 100 |
| Avg latency | < 100ms | < 500ms | > 2000ms |
| Queue depth | < 1000 | < 5000 | > 10000 |
| Error rate | 0% | < 0.1% | > 1% |

### Post-Test Analysis

1. **Review Metrics:**
   - Export performance data from Diagnostics
   - Calculate peak throughput
   - Identify latency spikes

2. **Check for Issues:**
   - Review poison messages generated
   - Check transmission queue for stuck messages
   - Analyze dialog errors

3. **Generate Report:**
   ```bash
   # Export conversation data for analysis
   curl -X GET "http://localhost:5000/api/conversations?startDate=2024-01-15&endDate=2024-01-15" \
     -H "X-API-Key: your-api-key" \
     -o test-results.json
   ```

### Cleanup

```sql
-- Clean up test data
DELETE FROM dbo.MessageAuditTrail WHERE MessageBody LIKE '%testId%';
DELETE FROM dbo.PerformanceMetrics WHERE CollectedAt > @testStartTime;

-- Reset queues
EXEC dbo.usp_PurgeQueue @QueueName = 'TestQueue';
```

### Scaling Recommendations

Based on test results, consider:
- Increasing max queue readers
- Adding database resources (CPU, memory)
- Implementing message batching
- Scaling out with multiple activation procedures
- Adding read replicas for queries

---

## Quick Reference

### Common SQL Queries

```sql
-- Queue status overview
SELECT name, is_receive_enabled, is_enqueue_enabled
FROM sys.service_queues WHERE name NOT LIKE 'sys%';

-- Active conversations
SELECT conversation_handle, state_desc, far_service
FROM sys.conversation_endpoints WHERE state_desc NOT IN ('CLOSED');

-- Transmission queue
SELECT * FROM sys.transmission_queue;

-- Recent errors
SELECT TOP 20 * FROM dbo.MessageAuditTrail
WHERE Status = 'Error' ORDER BY Timestamp DESC;
```

### API Quick Reference

```bash
# Health check
curl http://localhost:5000/api/health

# List queues
curl http://localhost:5000/api/queues -H "X-API-Key: key"

# Send message
curl -X POST http://localhost:5000/api/messages/send -H "X-API-Key: key" -H "Content-Type: application/json" -d '{...}'

# Retry poison message
curl -X POST http://localhost:5000/api/poison-messages/{id}/retry -H "X-API-Key: key"

# Run health check
curl -X POST http://localhost:5000/api/diagnostics/health-check -H "X-API-Key: key"
```

### Emergency Contacts

| Role | Contact | Escalation |
|------|---------|------------|
| On-Call DBA | [Contact Info] | After 15 min |
| Application Owner | [Contact Info] | For business impact |
| Infrastructure | [Contact Info] | For connectivity issues |
