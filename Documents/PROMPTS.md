# Service Broker Message Bus - Execution Prompts

Use these prompts sequentially. Each prompt is designed to complete within token limits.
After each phase, update the PROJECT-TRACKER.md file.

**IMPORTANT**: SQL Server phases (0, 0.5, 0.7) MUST be completed FIRST before any .NET or Angular work.

---

## PROJECT CONFIGURATION

**Project Root Path:**
```
D:\Workstations\Developments\Con-Edison\Applications\MessageBus\
```

**Folder Structure:**
```
D:\Workstations\Developments\Con-Edison\Applications\MessageBus\
├── Database\              (SQL scripts)
├── MessageBus.Api\        (.NET Core Web API)
├── messagebus-ui\         (Angular frontend)
├── MessageBus.Client\     (NuGet package - .NET client library)
└── messagebus-client\     (npm package - TypeScript client library)
```

**Before starting, create this folder structure manually or use:**
```powershell
mkdir "D:\Workstations\Developments\Con-Edison\Applications\MessageBus"
mkdir "D:\Workstations\Developments\Con-Edison\Applications\MessageBus\Database"
```

---

## PROMPT 0: SQL Server Service Broker Foundation

```
I'm building a Service Broker Message Bus application. This is PHASE 0: SQL Server Service Broker Foundation.

Project location: D:\Workstations\Developments\Con-Edison\Applications\MessageBus\
Create all SQL scripts in: D:\Workstations\Developments\Con-Edison\Applications\MessageBus\Database\

This is the CORE of the entire system. All messaging flows through SQL Server Service Broker.

Please create SQL scripts for:

1. **00-EnableServiceBroker.sql**:
   - Check if Service Broker is enabled on the database
   - Enable Service Broker if not enabled (ALTER DATABASE SET ENABLE_BROKER)
   - Handle the case where database is in use (WITH ROLLBACK IMMEDIATE)
   - Verify broker is enabled after

2. **01-CreateMessageTypes.sql**:
   - Create message type: RequestMessage (VALIDATION = WELL_FORMED_XML or NONE)
   - Create message type: ResponseMessage
   - Create message type: ErrorMessage
   - Create message type: AcknowledgementMessage
   - Include IF NOT EXISTS checks

3. **02-CreateContracts.sql**:
   - Create contract: MessageBusContract
     - RequestMessage SENT BY INITIATOR
     - ResponseMessage SENT BY TARGET
     - ErrorMessage SENT BY ANY
     - AcknowledgementMessage SENT BY ANY
   - Create contract: OneWayContract (for fire-and-forget)
     - RequestMessage SENT BY INITIATOR
   - Include IF NOT EXISTS checks

4. **03-CreateQueues.sql**:
   - Create queue: MessageBusInitiatorQueue
     - STATUS = ON
     - RETENTION = OFF
     - POISON_MESSAGE_HANDLING (STATUS = ON)
   - Create queue: MessageBusTargetQueue
     - STATUS = ON
     - RETENTION = OFF
     - POISON_MESSAGE_HANDLING (STATUS = ON)
   - Include proper error handling
   - Note: Activation will be added later

5. **04-CreateServices.sql**:
   - Create service: MessageBusInitiatorService ON MessageBusInitiatorQueue (MessageBusContract, OneWayContract)
   - Create service: MessageBusTargetService ON MessageBusTargetQueue (MessageBusContract, OneWayContract)
   - Include IF NOT EXISTS checks

6. **05-CreateActivationProcedure.sql**:
   - Create procedure: usp_MessageBusTargetActivation
     - This is the internal activation procedure called by Service Broker
     - RECEIVE messages from MessageBusTargetQueue
     - Handle each message type appropriately
     - For RequestMessage: Process and optionally send ResponseMessage
     - For ErrorMessage: Log error, end conversation
     - Handle END CONVERSATION message types
     - Proper error handling with TRY/CATCH
     - Transaction management

7. **06-EnableQueueActivation.sql**:
   - ALTER QUEUE MessageBusTargetQueue
     - WITH ACTIVATION (
         STATUS = ON,
         PROCEDURE_NAME = usp_MessageBusTargetActivation,
         MAX_QUEUE_READERS = 5,
         EXECUTE AS SELF
       )

8. **07-TestServiceBroker.sql**:
   - Test script to verify everything works
   - BEGIN DIALOG from InitiatorService to TargetService
   - SEND a test message
   - WAITFOR to receive response
   - END CONVERSATION
   - Print results

Update PROJECT-TRACKER.md Phase 0 tasks as you complete them.
```

---

## PROMPT 0.5A: SQL Server Custom Tables

```
I'm continuing the Service Broker Message Bus application. This is PHASE 0.5 Part A: Custom Tables.

Project location: D:\Workstations\Developments\Con-Edison\Applications\MessageBus\
Create all SQL scripts in: D:\Workstations\Developments\Con-Edison\Applications\MessageBus\Database\

Please create SQL scripts for the custom tables needed:

1. **10-CreateDeadLetterQueue.sql**:
   CREATE TABLE dbo.DeadLetterQueue (
       Id BIGINT IDENTITY(1,1) PRIMARY KEY,
       ConversationHandle UNIQUEIDENTIFIER NOT NULL,
       ConversationId UNIQUEIDENTIFIER NULL,
       SourceQueueName NVARCHAR(256) NOT NULL,
       ServiceName NVARCHAR(256) NULL,
       MessageTypeName NVARCHAR(256) NOT NULL,
       MessageBody VARBINARY(MAX) NULL,
       MessageBodyText AS (CAST(MessageBody AS NVARCHAR(MAX))) PERSISTED,
       ErrorMessage NVARCHAR(MAX) NULL,
       ErrorNumber INT NULL,
       RetryCount INT NOT NULL DEFAULT 0,
       MaxRetries INT NOT NULL DEFAULT 5,
       OriginalEnqueueTime DATETIME2 NULL,
       MovedToDeadLetterAt DATETIME2 NOT NULL DEFAULT SYSDATETIME(),
       LastRetryAt DATETIME2 NULL,
       ResolvedAt DATETIME2 NULL,
       ResolutionNotes NVARCHAR(MAX) NULL,
       ResolvedBy NVARCHAR(256) NULL,
       INDEX IX_DeadLetterQueue_ConversationHandle (ConversationHandle),
       INDEX IX_DeadLetterQueue_MovedAt (MovedToDeadLetterAt),
       INDEX IX_DeadLetterQueue_SourceQueue (SourceQueueName)
   );

2. **11-CreateMessageAuditTrail.sql**:
   CREATE TABLE dbo.MessageAuditTrail (
       Id BIGINT IDENTITY(1,1) PRIMARY KEY,
       ConversationHandle UNIQUEIDENTIFIER NOT NULL,
       ConversationId UNIQUEIDENTIFIER NULL,
       Operation NVARCHAR(50) NOT NULL, -- 'SEND', 'RECEIVE', 'END_CONVERSATION'
       QueueName NVARCHAR(256) NOT NULL,
       ServiceName NVARCHAR(256) NULL,
       MessageTypeName NVARCHAR(256) NULL,
       MessageSequenceNumber BIGINT NULL,
       MessageBodyPreview NVARCHAR(500) NULL, -- First 500 chars
       MessageSizeBytes INT NULL,
       OperationTimestamp DATETIME2 NOT NULL DEFAULT SYSDATETIME(),
       ApplicationName NVARCHAR(256) NULL,
       UserName NVARCHAR(256) NULL DEFAULT SUSER_SNAME(),
       HostName NVARCHAR(256) NULL DEFAULT HOST_NAME(),
       INDEX IX_Audit_ConversationHandle (ConversationHandle),
       INDEX IX_Audit_Timestamp (OperationTimestamp),
       INDEX IX_Audit_Queue (QueueName)
   );

3. **12-CreatePerformanceMetrics.sql**:
   CREATE TABLE dbo.PerformanceMetrics (
       Id BIGINT IDENTITY(1,1) PRIMARY KEY,
       CollectionTimestamp DATETIME2 NOT NULL DEFAULT SYSDATETIME(),
       QueueName NVARCHAR(256) NOT NULL,
       MessageCount BIGINT NOT NULL,
       MessagesEnqueuedPerSecond DECIMAL(18,2) NULL,
       MessagesReceivedPerSecond DECIMAL(18,2) NULL,
       AvgProcessingTimeMs DECIMAL(18,2) NULL,
       OldestMessageAgeSeconds INT NULL,
       ActivationCount INT NULL,
       IsDisabled BIT NOT NULL DEFAULT 0,
       IsPoisoned BIT NOT NULL DEFAULT 0,
       INDEX IX_Metrics_Timestamp (CollectionTimestamp),
       INDEX IX_Metrics_Queue (QueueName, CollectionTimestamp)
   );
   -- Include cleanup job to delete old metrics (older than 30 days)

4. **13-CreateRegisteredApplications.sql**:
   CREATE TABLE dbo.RegisteredApplications (
       Id INT IDENTITY(1,1) PRIMARY KEY,
       ApplicationName NVARCHAR(256) NOT NULL UNIQUE,
       ApiKey NVARCHAR(256) NOT NULL UNIQUE,
       ApiKeyHash VARBINARY(256) NULL, -- For secure storage
       Description NVARCHAR(500) NULL,
       IsActive BIT NOT NULL DEFAULT 1,
       AllowedQueuesJson NVARCHAR(MAX) NULL, -- JSON array of queue names
       CanPublish BIT NOT NULL DEFAULT 1,
       CanSubscribe BIT NOT NULL DEFAULT 1,
       CreatedAt DATETIME2 NOT NULL DEFAULT SYSDATETIME(),
       CreatedBy NVARCHAR(256) NULL DEFAULT SUSER_SNAME(),
       LastUsedAt DATETIME2 NULL,
       LastModifiedAt DATETIME2 NULL,
       LastModifiedBy NVARCHAR(256) NULL,
       INDEX IX_Apps_ApiKey (ApiKey),
       INDEX IX_Apps_Name (ApplicationName)
   );

5. **14-CreateAlertTables.sql**:
   CREATE TABLE dbo.AlertRules (
       Id INT IDENTITY(1,1) PRIMARY KEY,
       RuleName NVARCHAR(256) NOT NULL,
       RuleType NVARCHAR(50) NOT NULL, -- 'QUEUE_DEPTH', 'MESSAGE_AGE', 'POISON_MESSAGE', 'DISABLED_QUEUE'
       QueueName NVARCHAR(256) NULL, -- NULL means all queues
       WarningThreshold INT NULL,
       CriticalThreshold INT NULL,
       IsEnabled BIT NOT NULL DEFAULT 1,
       NotificationChannels NVARCHAR(MAX) NULL, -- JSON: ["email", "slack", "webhook"]
       NotificationConfig NVARCHAR(MAX) NULL, -- JSON with email addresses, webhook URLs, etc.
       CreatedAt DATETIME2 NOT NULL DEFAULT SYSDATETIME(),
       ModifiedAt DATETIME2 NULL
   );

   CREATE TABLE dbo.AlertHistory (
       Id BIGINT IDENTITY(1,1) PRIMARY KEY,
       AlertRuleId INT NOT NULL REFERENCES dbo.AlertRules(Id),
       Severity NVARCHAR(20) NOT NULL, -- 'WARNING', 'CRITICAL'
       QueueName NVARCHAR(256) NOT NULL,
       CurrentValue INT NOT NULL,
       ThresholdValue INT NOT NULL,
       AlertMessage NVARCHAR(MAX) NOT NULL,
       TriggeredAt DATETIME2 NOT NULL DEFAULT SYSDATETIME(),
       AcknowledgedAt DATETIME2 NULL,
       AcknowledgedBy NVARCHAR(256) NULL,
       ResolvedAt DATETIME2 NULL,
       INDEX IX_AlertHistory_Triggered (TriggeredAt),
       INDEX IX_AlertHistory_Rule (AlertRuleId)
   );

Update PROJECT-TRACKER.md Phase 0.5 tasks 0.5.1 through 0.5.6 as you complete them.
```

---

## PROMPT 0.5B: SQL Server Core Stored Procedures (Part 1)

```
I'm continuing the Service Broker Message Bus application. This is PHASE 0.5 Part B: Core Stored Procedures.

Project location: D:\Workstations\Developments\Con-Edison\Applications\MessageBus\
Create all SQL scripts in: D:\Workstations\Developments\Con-Edison\Applications\MessageBus\Database\

Please create these core stored procedures:

1. **20-usp_SendMessage.sql**:
   CREATE PROCEDURE dbo.usp_SendMessage
       @InitiatorService NVARCHAR(256),
       @TargetService NVARCHAR(256),
       @ContractName NVARCHAR(256),
       @MessageTypeName NVARCHAR(256),
       @MessageBody NVARCHAR(MAX),
       @Priority TINYINT = 5,
       @DialogHandle UNIQUEIDENTIFIER = NULL OUTPUT, -- Return for continuing conversations
       @ConversationGroup UNIQUEIDENTIFIER = NULL,
       @DialogLifetime INT = 3600, -- seconds
       @UseExistingDialog BIT = 0, -- If 1, uses @DialogHandle to continue existing dialog
       @ApplicationName NVARCHAR(256) = NULL
   AS
   BEGIN
       SET NOCOUNT ON;
       BEGIN TRY
           BEGIN TRANSACTION;

           IF @UseExistingDialog = 0 OR @DialogHandle IS NULL
           BEGIN
               -- Create new dialog
               BEGIN DIALOG @DialogHandle
                   FROM SERVICE @InitiatorService
                   TO SERVICE @TargetService
                   ON CONTRACT @ContractName
                   WITH ENCRYPTION = OFF,
                        LIFETIME = @DialogLifetime;
           END

           -- Send the message
           SEND ON CONVERSATION @DialogHandle
               MESSAGE TYPE @MessageTypeName (@MessageBody);

           -- Audit the send
           INSERT INTO dbo.MessageAuditTrail (...)

           COMMIT TRANSACTION;
       END TRY
       BEGIN CATCH
           IF @@TRANCOUNT > 0 ROLLBACK;
           THROW;
       END CATCH
   END;

2. **21-usp_ReceiveMessage.sql**:
   CREATE PROCEDURE dbo.usp_ReceiveMessage
       @QueueName NVARCHAR(256),
       @TimeoutMs INT = 5000,
       @MaxMessages INT = 1,
       @ConversationHandle UNIQUEIDENTIFIER = NULL OUTPUT,
       @MessageTypeName NVARCHAR(256) = NULL OUTPUT,
       @MessageBody NVARCHAR(MAX) = NULL OUTPUT,
       @ApplicationName NVARCHAR(256) = NULL
   AS
   BEGIN
       -- Build dynamic SQL for RECEIVE from specified queue
       -- WAITFOR with timeout
       -- Return message details
       -- Handle END CONVERSATION message type
       -- Audit the receive
   END;

3. **22-usp_ReceiveMessages.sql** (batch version):
   CREATE PROCEDURE dbo.usp_ReceiveMessages
       @QueueName NVARCHAR(256),
       @TimeoutMs INT = 5000,
       @MaxMessages INT = 10
   AS
   BEGIN
       -- Returns a result set of multiple messages
       -- Uses table variable
       -- RECEIVE TOP(@MaxMessages)
   END;

4. **23-usp_PeekMessages.sql** (non-destructive view):
   CREATE PROCEDURE dbo.usp_PeekMessages
       @QueueName NVARCHAR(256),
       @PageNumber INT = 1,
       @PageSize INT = 25,
       @StatusFilter NVARCHAR(50) = NULL, -- 'Ready', 'Received'
       @MessageTypeFilter NVARCHAR(256) = NULL
   AS
   BEGIN
       -- Query sys.transmission_queue or internal queue tables
       -- This is READ-ONLY, does not consume messages
       -- Use system catalog views:
       --   SELECT * FROM [QueueName] WITH (NOLOCK)
       -- Dynamic SQL needed for queue name
       -- Return: conversation_handle, message_type, priority, status, body preview, enqueue_time
   END;

5. **24-usp_GetQueueStatistics.sql**:
   CREATE PROCEDURE dbo.usp_GetQueueStatistics
       @QueueName NVARCHAR(256)
   AS
   BEGIN
       -- Query sys.service_queues for queue config
       -- Query the queue itself for message counts by status
       -- Calculate oldest message age
       -- Return:
       --   TotalMessages, ReadyMessages, ReceivedMessages
       --   OldestMessageAgeSeconds, AvgMessageAgeSeconds
       --   IsActivationEnabled, MaxReaders, IsDisabled
       --   PoisonMessageCount (if any)
   END;

Update PROJECT-TRACKER.md Phase 0.5 tasks 0.5.7 through 0.5.11 as you complete them.
```

---

## PROMPT 0.5C: SQL Server Management Stored Procedures (Part 2)

```
I'm continuing the Service Broker Message Bus application. This is PHASE 0.5 Part C: Management Stored Procedures.

Project location: D:\Workstations\Developments\Con-Edison\Applications\MessageBus\
Create all SQL scripts in: D:\Workstations\Developments\Con-Edison\Applications\MessageBus\Database\

Please create these management stored procedures:

1. **25-usp_GetAllQueuesWithStats.sql**:
   CREATE PROCEDURE dbo.usp_GetAllQueuesWithStats
   AS
   BEGIN
       -- Query sys.service_queues
       -- For each queue, get message count
       -- Join with sys.services for service associations
       -- Return comprehensive list with:
       --   QueueName, SchemaName, ServiceName
       --   IsActivationEnabled, IsReceiveEnabled
       --   MaxReaders, MessageCount, OldestMessageAge
       --   Status (Active, Idle, Disabled, Poison)
   END;

2. **26-usp_RetryPoisonMessage.sql**:
   CREATE PROCEDURE dbo.usp_RetryPoisonMessage
       @DeadLetterId BIGINT = NULL,
       @ConversationHandle UNIQUEIDENTIFIER = NULL,
       @QueueName NVARCHAR(256)
   AS
   BEGIN
       -- If from DeadLetterQueue table:
       --   Get message details
       --   Create new conversation
       --   Send message again
       --   Update DeadLetterQueue record (increment RetryCount)
       -- Re-enable the queue if it was disabled
       ALTER QUEUE [@QueueName] WITH STATUS = ON;
       -- Log the retry attempt
   END;

3. **27-usp_MoveToDeadLetter.sql**:
   CREATE PROCEDURE dbo.usp_MoveToDeadLetter
       @ConversationHandle UNIQUEIDENTIFIER,
       @QueueName NVARCHAR(256),
       @ErrorMessage NVARCHAR(MAX) = NULL,
       @ErrorNumber INT = NULL
   AS
   BEGIN
       -- Receive the poison message from the queue
       -- Insert into DeadLetterQueue table
       -- End the conversation with error
       -- Log the action
   END;

4. **28-usp_PurgeQueue.sql**:
   CREATE PROCEDURE dbo.usp_PurgeQueue
       @QueueName NVARCHAR(256),
       @ConfirmationCode NVARCHAR(50), -- Safety: must pass 'CONFIRM_PURGE'
       @EndConversations BIT = 1
   AS
   BEGIN
       IF @ConfirmationCode != 'CONFIRM_PURGE'
           THROW 50001, 'Invalid confirmation code', 1;

       -- Receive all messages from queue (destructive)
       -- Optionally end all conversations
       -- Log the purge action
       -- Return count of purged messages
   END;

5. **29-usp_PauseQueue.sql**:
   CREATE PROCEDURE dbo.usp_PauseQueue
       @QueueName NVARCHAR(256)
   AS
   BEGIN
       -- ALTER QUEUE with STATUS = OFF
       -- Log the action
   END;

6. **30-usp_ResumeQueue.sql**:
   CREATE PROCEDURE dbo.usp_ResumeQueue
       @QueueName NVARCHAR(256)
   AS
   BEGIN
       -- ALTER QUEUE with STATUS = ON
       -- Log the action
   END;

7. **31-usp_GetConversationTrace.sql**:
   CREATE PROCEDURE dbo.usp_GetConversationTrace
       @ConversationHandle UNIQUEIDENTIFIER = NULL,
       @ConversationId UNIQUEIDENTIFIER = NULL
   AS
   BEGIN
       -- Query sys.conversation_endpoints
       -- Query MessageAuditTrail for message history
       -- Return:
       --   Conversation metadata (handle, id, state, lifetime, far_service)
       --   Timeline of messages (from audit table)
       --   State transitions
   END;

Update PROJECT-TRACKER.md Phase 0.5 tasks 0.5.12 through 0.5.16 as you complete them.
```

---

## PROMPT 0.5D: SQL Server Diagnostics Stored Procedures (Part 3)

```
I'm continuing the Service Broker Message Bus application. This is PHASE 0.5 Part D: Diagnostics Stored Procedures.

Project location: D:\Workstations\Developments\Con-Edison\Applications\MessageBus\
Create all SQL scripts in: D:\Workstations\Developments\Con-Edison\Applications\MessageBus\Database\

Please create these diagnostics stored procedures:

1. **32-usp_GetTransmissionQueueStatus.sql**:
   CREATE PROCEDURE dbo.usp_GetTransmissionQueueStatus
   AS
   BEGIN
       SELECT
           conversation_handle,
           to_service_name,
           to_broker_instance,
           from_service_name,
           service_contract_name,
           message_type_name,
           transmission_status,
           enqueue_time,
           DATEDIFF(SECOND, enqueue_time, GETDATE()) AS stuck_seconds,
           message_body
       FROM sys.transmission_queue
       ORDER BY enqueue_time;
   END;

2. **33-usp_GetDialogErrors.sql**:
   CREATE PROCEDURE dbo.usp_GetDialogErrors
   AS
   BEGIN
       SELECT
           ce.conversation_handle,
           ce.conversation_id,
           ce.state_desc,
           ce.far_service,
           ce.far_broker_instance,
           DATEDIFF(SECOND, ce.lifetime, GETDATE()) AS seconds_since_error,
           -- Get last error from transmission queue if any
           tq.transmission_status
       FROM sys.conversation_endpoints ce
       LEFT JOIN sys.transmission_queue tq ON ce.conversation_handle = tq.conversation_handle
       WHERE ce.state IN ('ER', 'CD', 'DI') -- Error, Closed on Disconnect, Disconnected Inbound
       ORDER BY ce.lifetime DESC;
   END;

3. **34-usp_RunHealthCheck.sql**:
   CREATE PROCEDURE dbo.usp_RunHealthCheck
   AS
   BEGIN
       -- Returns multiple result sets:

       -- 1. Service Broker Status
       SELECT
           db_name() AS DatabaseName,
           DATABASEPROPERTYEX(db_name(), 'ServiceBrokerGuid') AS BrokerGuid,
           CASE WHEN is_broker_enabled = 1 THEN 'Enabled' ELSE 'Disabled' END AS BrokerStatus
       FROM sys.databases WHERE name = db_name();

       -- 2. Queue Health Summary
       SELECT
           q.name AS QueueName,
           q.is_receive_enabled,
           q.is_activation_enabled,
           -- Count messages
           -- Check for disabled state
           -- Check for poison state
       FROM sys.service_queues q;

       -- 3. Orphaned Conversations (open > 24 hours with no activity)
       SELECT conversation_handle, far_service, state_desc, lifetime
       FROM sys.conversation_endpoints
       WHERE state = 'CO' AND DATEDIFF(HOUR, send_time, GETDATE()) > 24;

       -- 4. Old Messages (> configurable threshold)
       -- Query each queue for old messages

       -- 5. Services without valid queues
       SELECT s.name FROM sys.services s
       LEFT JOIN sys.service_queues q ON s.service_queue_id = q.object_id
       WHERE q.object_id IS NULL;

       -- 6. Contract validation
       -- 7. Message type validation
   END;

4. **35-usp_CollectPerformanceMetrics.sql**:
   CREATE PROCEDURE dbo.usp_CollectPerformanceMetrics
   AS
   BEGIN
       -- Called periodically by background job
       -- For each queue:
       --   Count current messages
       --   Calculate messages/second since last collection
       --   Check oldest message age
       --   Check if disabled/poisoned
       -- Insert into PerformanceMetrics table

       INSERT INTO dbo.PerformanceMetrics (
           QueueName, MessageCount, OldestMessageAgeSeconds,
           IsDisabled, IsPoisoned
       )
       SELECT
           q.name,
           -- count messages
           -- calculate age
           CASE WHEN q.is_receive_enabled = 0 THEN 1 ELSE 0 END,
           -- check poison state
       FROM sys.service_queues q;
   END;

5. **36-usp_GetPerformanceMetrics.sql**:
   CREATE PROCEDURE dbo.usp_GetPerformanceMetrics
       @QueueName NVARCHAR(256) = NULL,
       @HoursBack INT = 24
   AS
   BEGIN
       SELECT *
       FROM dbo.PerformanceMetrics
       WHERE (@QueueName IS NULL OR QueueName = @QueueName)
         AND CollectionTimestamp >= DATEADD(HOUR, -@HoursBack, GETDATE())
       ORDER BY CollectionTimestamp DESC;
   END;

Update PROJECT-TRACKER.md Phase 0.5 tasks 0.5.17 through 0.5.20 as you complete them.
```

---

## PROMPT 0.7: SQL Server Views for Monitoring

```
I'm continuing the Service Broker Message Bus application. This is PHASE 0.7: SQL Server Views.

Project location: D:\Workstations\Developments\Con-Edison\Applications\MessageBus\
Create all SQL scripts in: D:\Workstations\Developments\Con-Edison\Applications\MessageBus\Database\

Please create these monitoring views:

1. **40-vw_QueueStatus.sql**:
   CREATE VIEW dbo.vw_QueueStatus AS
   SELECT
       q.name AS QueueName,
       SCHEMA_NAME(q.schema_id) AS SchemaName,
       s.name AS ServiceName,
       q.is_activation_enabled AS IsActivationEnabled,
       q.is_receive_enabled AS IsReceiveEnabled,
       q.max_readers AS MaxReaders,
       q.activation_procedure AS ActivationProcedure,
       -- Message count (requires dynamic approach or function)
       CASE
           WHEN q.is_receive_enabled = 0 THEN 'Disabled'
           WHEN q.is_poison_message_handling_enabled = 1 THEN 'Poison'
           ELSE 'Active'
       END AS Status
   FROM sys.service_queues q
   LEFT JOIN sys.services s ON q.object_id = s.service_queue_id
   WHERE q.is_ms_shipped = 0;

2. **41-vw_ServiceBrokerHealth.sql**:
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

3. **42-vw_ActiveConversations.sql**:
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

4. **43-vw_PoisonMessages.sql**:
   -- This view shows messages that might be causing queue poison
   -- Note: True poison detection requires monitoring queue disable events
   CREATE VIEW dbo.vw_PoisonMessages AS
   SELECT
       dlq.Id,
       dlq.ConversationHandle,
       dlq.SourceQueueName,
       dlq.MessageTypeName,
       dlq.ErrorMessage,
       dlq.RetryCount,
       dlq.MaxRetries,
       dlq.MovedToDeadLetterAt,
       dlq.LastRetryAt,
       CASE WHEN dlq.ResolvedAt IS NOT NULL THEN 'Resolved' ELSE 'Pending' END AS Status
   FROM dbo.DeadLetterQueue dlq
   WHERE dlq.ResolvedAt IS NULL;

5. **44-vw_MessageThroughput.sql**:
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

6. **45-vw_ConversationEndpoints.sql**:
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

7. **99-VerifyAllObjects.sql**:
   -- Verification script to confirm all objects exist
   PRINT 'Checking Service Broker objects...';

   -- Check message types
   SELECT 'Message Type' AS ObjectType, name FROM sys.service_message_types WHERE is_ms_shipped = 0;

   -- Check contracts
   SELECT 'Contract' AS ObjectType, name FROM sys.service_contracts WHERE is_ms_shipped = 0;

   -- Check queues
   SELECT 'Queue' AS ObjectType, name, is_receive_enabled, is_activation_enabled FROM sys.service_queues WHERE is_ms_shipped = 0;

   -- Check services
   SELECT 'Service' AS ObjectType, name FROM sys.services WHERE is_ms_shipped = 0;

   -- Check custom tables
   SELECT 'Table' AS ObjectType, name FROM sys.tables WHERE name IN ('DeadLetterQueue', 'MessageAuditTrail', 'PerformanceMetrics', 'RegisteredApplications', 'AlertRules', 'AlertHistory');

   -- Check stored procedures
   SELECT 'Procedure' AS ObjectType, name FROM sys.procedures WHERE name LIKE 'usp_%';

   -- Check views
   SELECT 'View' AS ObjectType, name FROM sys.views WHERE name LIKE 'vw_%';

   PRINT 'Verification complete.';

Update PROJECT-TRACKER.md Phase 0.7 tasks as you complete them.
```

---

## PROMPT 1: Project Foundation & Basic Setup

```
I'm continuing the Service Broker Message Bus application. This is PHASE 1: Project Foundation.

Project location: D:\Workstations\Developments\Con-Edison\Applications\MessageBus\

The SQL Server database layer (Phases 0, 0.5, 0.7) has been completed.

**DATA ACCESS APPROACH**: Use Entity Framework Core with DbContext to call stored procedures.
- Use context.Database.ExecuteSqlRawAsync() for commands (INSERT/UPDATE/DELETE)
- Use context.Set<T>().FromSqlRaw() for queries that return data
- Map stored procedure results to strongly-typed DTOs/Models

Please create:

1. **.NET Core Web API project structure** in: D:\Workstations\Developments\Con-Edison\Applications\MessageBus\MessageBus.Api\
   - Three-layer architecture: Controllers, Services, Repositories
   - Folder structure:
     - Controllers/
     - Services/ and Services/Interfaces/
     - Repositories/ and Repositories/Interfaces/
     - Models/
     - DTOs/
     - Hubs/
     - Middleware/
     - BackgroundServices/
     - Data/ (for DbContext)

   - **NuGet packages required**:
     - Microsoft.EntityFrameworkCore
     - Microsoft.EntityFrameworkCore.SqlServer
     - Microsoft.EntityFrameworkCore.Design
     - Swashbuckle.AspNetCore
     - Microsoft.AspNetCore.SignalR

   - **Data/MessageBusDbContext.cs**:
     - Inherit from DbContext
     - DbSet<T> for each entity that maps to stored procedure results
     - OnModelCreating to configure keyless entities for SP result types
     - Example:
       ```csharp
       public class MessageBusDbContext : DbContext
       {
           public MessageBusDbContext(DbContextOptions<MessageBusDbContext> options) : base(options) { }

           // Keyless entities for stored procedure results
           public DbSet<QueueStatistics> QueueStatistics { get; set; }
           public DbSet<QueueInfo> QueueInfos { get; set; }
           public DbSet<MessageInfo> MessageInfos { get; set; }
           public DbSet<HealthCheckResult> HealthCheckResults { get; set; }

           protected override void OnModelCreating(ModelBuilder modelBuilder)
           {
               // Configure keyless entities (no primary key - used for SP results)
               modelBuilder.Entity<QueueStatistics>().HasNoKey();
               modelBuilder.Entity<QueueInfo>().HasNoKey();
               modelBuilder.Entity<MessageInfo>().HasNoKey();
               modelBuilder.Entity<HealthCheckResult>().HasNoKey();
           }
       }
       ```

   - **Program.cs** with:
     - Entity Framework Core DbContext registration
     - SQL Server connection configuration
     - CORS setup
     - SignalR setup
     - Swagger setup
     - Example:
       ```csharp
       builder.Services.AddDbContext<MessageBusDbContext>(options =>
           options.UseSqlServer(builder.Configuration.GetConnectionString("DefaultConnection")));
       ```

   - appsettings.json with connection string placeholder
   - appsettings.Development.json

2. **Angular project structure** in: D:\Workstations\Developments\Con-Edison\Applications\MessageBus\messagebus-ui\
   - Standard Angular CLI structure
   - Folder structure:
     - src/app/core/ (services, guards, interceptors)
     - src/app/shared/ (components, directives, pipes)
     - src/app/features/dashboard/
     - src/app/features/queue-explorer/
     - src/app/features/message-inspector/
     - src/app/features/message-sender/
     - src/app/features/poison-messages/
     - src/app/features/conversation-trace/
     - src/app/features/diagnostics/
     - src/app/features/settings/
   - App routing module with lazy loading placeholders
   - Environment files

3. **Basic connectivity test**:
   - HealthController with /api/health endpoint
   - Inject MessageBusDbContext
   - Call usp_RunHealthCheck using:
     ```csharp
     var results = await _context.HealthCheckResults
         .FromSqlRaw("EXEC dbo.usp_RunHealthCheck")
         .ToListAsync();
     ```
   - Return broker status

Update PROJECT-TRACKER.md Phase 1 tasks as you complete them.
```

---

## PROMPT 1.5: Angular Component Refactoring (Separate Files)

```
I'm continuing the Service Broker Message Bus application. This is PHASE 1.5: Angular Component Refactoring.

Project location: D:\Workstations\Developments\Con-Edison\Applications\MessageBus\
Working in: D:\Workstations\Developments\Con-Edison\Applications\MessageBus\messagebus-ui\

**IMPORTANT**: The Angular components were created with inline templates and styles.
Refactor ALL components to use separate files:
- component-name.component.ts (logic only)
- component-name.component.html (template)
- component-name.component.scss (styles)

Please refactor these components:

1. **src/app/app.component.ts** → split into:
   - app.component.ts (remove template/styles, add templateUrl/styleUrls)
   - app.component.html
   - app.component.scss

2. **src/app/features/dashboard/dashboard.component.ts** → split into:
   - dashboard.component.ts
   - dashboard.component.html
   - dashboard.component.scss

3. **src/app/features/queue-explorer/queue-explorer.component.ts** → split into:
   - queue-explorer.component.ts
   - queue-explorer.component.html
   - queue-explorer.component.scss

4. **src/app/features/message-inspector/message-inspector.component.ts** → split into:
   - message-inspector.component.ts
   - message-inspector.component.html
   - message-inspector.component.scss

5. **src/app/features/message-sender/message-sender.component.ts** → split into:
   - message-sender.component.ts
   - message-sender.component.html
   - message-sender.component.scss

6. **src/app/features/poison-messages/poison-messages.component.ts** → split into:
   - poison-messages.component.ts
   - poison-messages.component.html
   - poison-messages.component.scss

7. **src/app/features/conversation-trace/conversation-trace.component.ts** → split into:
   - conversation-trace.component.ts
   - conversation-trace.component.html
   - conversation-trace.component.scss

8. **src/app/features/diagnostics/diagnostics.component.ts** → split into:
   - diagnostics.component.ts
   - diagnostics.component.html
   - diagnostics.component.scss

9. **src/app/features/settings/settings.component.ts** → split into:
   - settings.component.ts
   - settings.component.html
   - settings.component.scss

**Component decorator format after refactoring:**
```typescript
@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './dashboard.component.html',
  styleUrls: ['./dashboard.component.scss']
})
```

Update PROJECT-TRACKER.md to add Phase 1.5 task and mark as complete when done.
```

---

## PROMPT 2: Backend Data Access Layer

```
I'm continuing the Service Broker Message Bus application. This is PHASE 2: Data Access Layer.

Project location: D:\Workstations\Developments\Con-Edison\Applications\MessageBus\
Working in: D:\Workstations\Developments\Con-Edison\Applications\MessageBus\MessageBus.Api\

**DATA ACCESS APPROACH**: Use Entity Framework Core with DbContext to call stored procedures.
- Inject MessageBusDbContext into all repositories
- Use _context.Set<T>().FromSqlRaw() for SELECT queries
- Use _context.Database.ExecuteSqlRawAsync() for INSERT/UPDATE/DELETE commands
- Use SqlParameter for parameterized queries to prevent SQL injection

Please create:

1. **Models for Stored Procedure Results** in Models/:
   Create keyless entity classes that match the result sets from stored procedures:
   - QueueInfo (for usp_GetAllQueuesWithStats)
   - QueueStatistics (for usp_GetQueueStatistics)
   - MessageInfo (for usp_PeekMessages)
   - PoisonMessageInfo (for vw_PoisonMessages)
   - DeadLetterMessage (for DeadLetterQueue table)
   - ConversationInfo (for vw_ActiveConversations)
   - ConversationTraceItem (for usp_GetConversationTrace)
   - TransmissionQueueItem (for usp_GetTransmissionQueueStatus)
   - DialogError (for usp_GetDialogErrors)
   - PerformanceMetric (for usp_GetPerformanceMetrics)
   - HealthCheckResult (for usp_RunHealthCheck)
   - ServiceInfo (for sys.services query)
   - ContractInfo (for contracts query)
   - MessageTypeInfo (for sys.service_message_types query)

2. **Update MessageBusDbContext** in Data/:
   - Add DbSet<T> for each model above
   - Configure all as keyless entities in OnModelCreating

3. **Repository Interfaces** in Repositories/Interfaces/:
   - IQueueRepository
   - IMessageRepository
   - IServiceRepository
   - IPoisonMessageRepository
   - IConversationRepository
   - IDiagnosticsRepository

4. **QueueRepository** implementing IQueueRepository:
   ```csharp
   public class QueueRepository : IQueueRepository
   {
       private readonly MessageBusDbContext _context;

       public async Task<List<QueueInfo>> GetAllQueuesAsync()
       {
           return await _context.Set<QueueInfo>()
               .FromSqlRaw("EXEC dbo.usp_GetAllQueuesWithStats")
               .ToListAsync();
       }

       public async Task<QueueStatistics> GetQueueStatisticsAsync(string queueName)
       {
           var param = new SqlParameter("@QueueName", queueName);
           return await _context.Set<QueueStatistics>()
               .FromSqlRaw("EXEC dbo.usp_GetQueueStatistics @QueueName", param)
               .FirstOrDefaultAsync();
       }

       public async Task PauseQueueAsync(string queueName)
       {
           var param = new SqlParameter("@QueueName", queueName);
           await _context.Database.ExecuteSqlRawAsync("EXEC dbo.usp_PauseQueue @QueueName", param);
       }

       public async Task ResumeQueueAsync(string queueName)
       {
           var param = new SqlParameter("@QueueName", queueName);
           await _context.Database.ExecuteSqlRawAsync("EXEC dbo.usp_ResumeQueue @QueueName", param);
       }

       public async Task PurgeQueueAsync(string queueName)
       {
           var param = new SqlParameter("@QueueName", queueName);
           await _context.Database.ExecuteSqlRawAsync("EXEC dbo.usp_PurgeQueue @QueueName", param);
       }
   }
   ```

5. **MessageRepository** implementing IMessageRepository:
   - GetMessagesAsync(queueName, top) - calls usp_PeekMessages with FromSqlRaw
   - SendMessageAsync(...) - calls usp_SendMessage with ExecuteSqlRawAsync
   - ReceiveMessageAsync(queueName) - calls usp_ReceiveMessage

6. **ServiceRepository** implementing IServiceRepository:
   - GetAllServicesAsync() - queries sys.services using FromSqlRaw
   - GetContractsForServiceAsync(serviceName)
   - GetMessageTypesAsync()

7. **PoisonMessageRepository** implementing IPoisonMessageRepository:
   - GetPoisonMessagesAsync() - queries vw_PoisonMessages using FromSqlRaw
   - GetDeadLetteredMessagesAsync() - queries DeadLetterQueue table
   - RetryPoisonMessageAsync(id) - calls usp_RetryPoisonMessage
   - MoveToDeadLetterAsync(conversationHandle, queueName, reason)

8. **ConversationRepository** implementing IConversationRepository:
   - GetConversationsAsync(filter) - queries vw_ActiveConversations
   - GetConversationTraceAsync(conversationHandle) - calls usp_GetConversationTrace

9. **DiagnosticsRepository** implementing IDiagnosticsRepository:
   - GetBrokerStatusAsync() - queries vw_ServiceBrokerHealth
   - GetTransmissionQueueAsync() - calls usp_GetTransmissionQueueStatus
   - GetDialogErrorsAsync() - calls usp_GetDialogErrors
   - GetPerformanceMetricsAsync() - calls usp_GetPerformanceMetrics
   - RunHealthCheckAsync() - calls usp_RunHealthCheck

10. **Register repositories in Program.cs**:
    ```csharp
    builder.Services.AddScoped<IQueueRepository, QueueRepository>();
    builder.Services.AddScoped<IMessageRepository, MessageRepository>();
    builder.Services.AddScoped<IServiceRepository, ServiceRepository>();
    builder.Services.AddScoped<IPoisonMessageRepository, PoisonMessageRepository>();
    builder.Services.AddScoped<IConversationRepository, ConversationRepository>();
    builder.Services.AddScoped<IDiagnosticsRepository, DiagnosticsRepository>();
    ```

Update PROJECT-TRACKER.md Phase 2 tasks as you complete them.
```

---

## PROMPT 3: Backend Service Layer

```
I'm continuing the Service Broker Message Bus application. This is PHASE 3: Service Layer.

Project location: D:\Workstations\Developments\Con-Edison\Applications\MessageBus\
Working in: D:\Workstations\Developments\Con-Edison\Applications\MessageBus\MessageBus.Api\

Please create:

1. **Service Interfaces** in Services/Interfaces/:
   - IQueueService
   - IMessageService
   - IPoisonMessageService
   - IConversationService
   - IDiagnosticsService
   - IAlertService

2. **QueueService** implementing IQueueService:
   - Business logic for queue operations
   - Validation before pause/resume/purge
   - Queue health status calculation (Healthy/Warning/Critical)

3. **MessageService** implementing IMessageService:
   - Send message with validation
   - Validate message type exists in contract
   - Validate target service exists
   - Bulk send for testing (send N copies)

4. **PoisonMessageService** implementing IPoisonMessageService:
   - Retry logic (re-enable queue, move message back)
   - Purge to dead-letter logic
   - Bulk retry/purge operations

5. **ConversationService** implementing IConversationService:
   - Get conversation with full trace
   - Build timeline data structure
   - Export conversation as JSON/CSV

6. **DiagnosticsService** implementing IDiagnosticsService:
   - Run health checks
   - Calculate overall system status (Healthy/Warning/Critical)
   - Check for orphaned conversations
   - Validate services have valid queues

7. **Background Services** in BackgroundServices/:
   - HealthMonitorService (IHostedService) - runs periodic health checks every 30 seconds
   - MetricsCollectionService (IHostedService) - collects queue depth, throughput every minute

8. **AlertService** implementing IAlertService:
   - Load alert rules from database
   - Evaluate thresholds against current metrics
   - Trigger notifications (placeholder for email/webhook/Slack)

Update PROJECT-TRACKER.md Phase 3 tasks as you complete them.
```

---

## PROMPT 4: Backend API Controllers

```
I'm continuing the Service Broker Message Bus application. This is PHASE 4: API Controllers.

Project location: D:\Workstations\Developments\Con-Edison\Applications\MessageBus\
Working in: D:\Workstations\Developments\Con-Edison\Applications\MessageBus\MessageBus.Api\

Please create:

1. **QueuesController** (api/queues):
   - GET / - List all queues with statistics
   - GET /{queueName} - Get queue details
   - GET /{queueName}/messages - Get messages (paginated, non-destructive)
   - POST /{queueName}/pause - Pause queue
   - POST /{queueName}/resume - Resume queue
   - DELETE /{queueName}/purge - Purge queue (requires confirmation)

2. **MessagesController** (api/messages):
   - GET /{conversationHandle} - Get message details
   - POST /send - Send a message
   - POST /send-bulk - Send multiple messages for testing

3. **PoisonMessagesController** (api/poison-messages):
   - GET / - List poison messages
   - GET /dead-letter - List dead-lettered messages
   - POST /{id}/retry - Retry a poison message
   - POST /{id}/purge - Purge to dead-letter
   - POST /bulk-retry - Bulk retry
   - POST /bulk-purge - Bulk purge

4. **ServicesController** (api/services):
   - GET / - List all services
   - GET /{serviceName} - Get service details with associated queues
   - GET /{serviceName}/contracts - Get contracts for service
   - GET /message-types - List all message types

5. **ConversationsController** (api/conversations):
   - GET / - List conversations (filterable by state)
   - GET /{conversationHandle} - Get full conversation trace
   - GET /{conversationHandle}/export?format=json|csv - Export conversation

6. **DiagnosticsController** (api/diagnostics):
   - GET /status - Get Service Broker health status
   - GET /transmission-queue - View transmission queue
   - GET /dialog-errors - View dialog errors
   - GET /metrics - Get performance metrics
   - POST /health-check - Run full diagnostic

7. **WebSocket Hub** (Hubs/MessageBusHub.cs):
   - Method: SubscribeToQueue(queueName) - Join group for queue updates
   - Method: UnsubscribeFromQueue(queueName)
   - Push: QueueUpdated(queueName, stats)
   - Push: AlertTriggered(alert)

8. **Middleware**:
   - ApiKeyAuthMiddleware - Validate API key from X-API-Key header
   - Check queue permissions for operations

9. **Swagger Configuration**:
   - Add XML documentation
   - Configure authentication
   - Add example requests/responses

Update PROJECT-TRACKER.md Phase 4 tasks as you complete them.
```

---

## PROMPT 5: Frontend Core & Dashboard

```
I'm continuing the Service Broker Message Bus application. This is PHASE 5: Frontend Core & Dashboard.

Project location: D:\Workstations\Developments\Con-Edison\Applications\MessageBus\
Working in: D:\Workstations\Developments\Con-Edison\Applications\MessageBus\messagebus-ui\

**ANGULAR COMPONENT STRUCTURE**: Each component MUST have separate files:
- component-name.component.ts (logic only, use templateUrl and styleUrls)
- component-name.component.html (template)
- component-name.component.scss (styles)
DO NOT use inline templates or styles.

Please create:

1. **Core Module** (core/):
   - ApiService - HTTP client wrapper with base URL config
   - WebSocketService - SignalR connection management
   - AuthService - API key storage/retrieval
   - ConfigService - app configuration

2. **Shared Module** (shared/):
   - StatusBadgeComponent - displays status (active, idle, disabled, poison)
   - MetricCardComponent - displays metric with label, value, icon
   - DataTableComponent - generic paginated table
   - ConfirmDialogComponent - confirmation modal
   - LoadingSpinnerComponent

3. **Dashboard Feature** (features/dashboard/):
   - DashboardComponent - main container
   - SystemHealthSummaryComponent - total services, conversations, queue depth, status
   - QueueHealthGridComponent - grid of queue cards
   - QueueHealthCardComponent - individual queue card with status, count, age
   - ThroughputChartComponent - line chart with time range toggle (1h, 6h, 24h)
   - DeadLetterSummaryComponent - poison count, dead-letter count, oldest age
   - BrokerStatusComponent - broker enabled indicator + warnings

4. **Dashboard Services**:
   - DashboardService - API calls for dashboard data
   - Real-time subscription to queue updates via WebSocket

5. **Dashboard Models**:
   - SystemHealth interface
   - QueueHealth interface
   - ThroughputData interface

6. **Routing**:
   - Configure lazy loading for dashboard module
   - Set dashboard as default route

Update PROJECT-TRACKER.md Phase 5 tasks as you complete them.
```

---

## PROMPT 6: Frontend Queue Explorer

```
I'm continuing the Service Broker Message Bus application. This is PHASE 6: Queue Explorer.

Project location: D:\Workstations\Developments\Con-Edison\Applications\MessageBus\
Working in: D:\Workstations\Developments\Con-Edison\Applications\MessageBus\messagebus-ui\

**ANGULAR COMPONENT STRUCTURE**: Each component MUST have separate files:
- component-name.component.ts (logic only, use templateUrl and styleUrls)
- component-name.component.html (template)
- component-name.component.scss (styles)
DO NOT use inline templates or styles.

Please create:

1. **Queue Explorer Feature** (features/queue-explorer/):
   - QueueExplorerComponent - main container with sidebar + detail layout

2. **Queue Sidebar**:
   - QueueListComponent - searchable/filterable list
   - Search input with debounce
   - Filter by status (all, active, idle, disabled, poison)
   - Sort by name, message count, age
   - Each item shows: queue name, status badge, message count

3. **Queue Detail Panel**:
   - QueueDetailComponent - selected queue details
   - Queue configuration section: service name, queue name, max readers, activation settings
   - Queue statistics section: message count by status, oldest/average age, throughput

4. **Queue Actions**:
   - QueueActionsComponent - action buttons bar
   - Send Message button (links to message sender)
   - Receive Message button
   - Pause/Resume toggle button
   - Purge button with confirmation dialog
   - View Poison Messages button

5. **Message Table**:
   - MessageTableComponent - displays messages in queue
   - Columns: sequence number, type, priority, status, size, age, timestamp
   - Sorting on each column
   - Filtering by type, status
   - Pagination (25, 50, 100 rows)
   - Row selection for bulk actions
   - Bulk actions: delete, mark as received, export JSON

6. **Queue Explorer Services**:
   - QueueExplorerService - API calls for queue data

Update PROJECT-TRACKER.md Phase 6 tasks as you complete them.
```

---

## PROMPT 7: Frontend Message Inspector & Sender

```
I'm continuing the Service Broker Message Bus application. This is PHASE 7: Message Inspector & Sender.

Project location: D:\Workstations\Developments\Con-Edison\Applications\MessageBus\
Working in: D:\Workstations\Developments\Con-Edison\Applications\MessageBus\messagebus-ui\

**ANGULAR COMPONENT STRUCTURE**: Each component MUST have separate files:
- component-name.component.ts (logic only, use templateUrl and styleUrls)
- component-name.component.html (template)
- component-name.component.scss (styles)
DO NOT use inline templates or styles.

Please create:

1. **Message Inspector Feature** (features/message-inspector/):
   - MessageInspectorComponent - main container

2. **Message Metadata Panel**:
   - MessageMetadataComponent
   - Display: conversation handle, conversation ID, message type, sequence number, priority, status, enqueue timestamp, size

3. **Message Body Viewer**:
   - MessageBodyViewerComponent
   - Auto-detect format (text, JSON, XML)
   - Syntax highlighting (use a library like ngx-highlightjs or prism)
   - Raw binary view toggle
   - Copy button
   - Export to file button

4. **Conversation Context Panel**:
   - ConversationContextComponent
   - Initiator service, target service
   - Dialog state with visual indicator
   - Dialog lifetime
   - Send/receive sequence numbers

5. **Related Messages Navigation**:
   - RelatedMessagesComponent
   - Previous/Next buttons within conversation
   - Message count in conversation
   - Mini conversation state diagram

6. **Message Sender Feature** (features/message-sender/):
   - MessageSenderComponent - main form

7. **Message Composition Form**:
   - Dropdown: Initiator service (auto-populate from API)
   - Dropdown: Target service (auto-populate)
   - Dropdown: Contract (filter based on services)
   - Dropdown: Message type (filter based on contract)

8. **Message Body Editor**:
   - MessageBodyEditorComponent
   - Syntax highlighting editor (use CodeMirror or Monaco)
   - Format selector: Raw, JSON, XML
   - Inline validation for JSON/XML
   - Character count
   - Template buttons for example payloads

9. **Advanced Options**:
   - Priority slider (0-10)
   - Dialog handle input (for existing conversations)
   - Conversation group ID
   - Dialog lifetime

10. **Send Options**:
    - Send single message
    - Bulk send (N copies)
    - Preview button

11. **Validation**:
    - Required field highlighting
    - JSON/XML error display
    - Message size warning
    - Target service existence check

Update PROJECT-TRACKER.md Phase 7 tasks as you complete them.
```

---

## PROMPT 8: Frontend Poison Message Manager

```
I'm continuing the Service Broker Message Bus application. This is PHASE 8: Poison Message Manager.

Project location: D:\Workstations\Developments\Con-Edison\Applications\MessageBus\
Working in: D:\Workstations\Developments\Con-Edison\Applications\MessageBus\messagebus-ui\

**ANGULAR COMPONENT STRUCTURE**: Each component MUST have separate files:
- component-name.component.ts (logic only, use templateUrl and styleUrls)
- component-name.component.html (template)
- component-name.component.scss (styles)
DO NOT use inline templates or styles.

Please create:

1. **Poison Messages Feature** (features/poison-messages/):
   - PoisonMessagesComponent - main container with tabs

2. **Poison Message List Tab**:
   - PoisonMessageListComponent
   - Table columns: queue name, conversation handle, message type, error message, retry count, max retries, moved to poison timestamp, last retry timestamp
   - Sorting and filtering
   - Row selection for bulk actions

3. **Dead-Letter Queue Tab**:
   - DeadLetterListComponent
   - Permanently failed messages
   - Columns: queue name, message type, reason for dead-lettering, resolution notes, created timestamp
   - Resolution notes editable

4. **Message Detail View**:
   - PoisonMessageDetailComponent (slide-out panel or modal)
   - Full message body viewer (reuse MessageBodyViewerComponent)
   - Error trace display with stack trace formatting
   - Retry history timeline
   - Current queue status

5. **Action Buttons**:
   - Retry button (moves back to queue, re-enables queue)
   - Purge button (moves to dead-letter with confirmation)
   - Re-enable queue button (if disabled)
   - View full message body

6. **Bulk Actions**:
   - Select multiple poison messages
   - Bulk retry
   - Bulk purge
   - Progress indicator for bulk operations

7. **Poison Messages Service**:
   - PoisonMessagesService - API calls

Update PROJECT-TRACKER.md Phase 8 tasks as you complete them.
```

---

## PROMPT 9: Frontend Conversation Trace Viewer

```
I'm continuing the Service Broker Message Bus application. This is PHASE 9: Conversation Trace Viewer.

Project location: D:\Workstations\Developments\Con-Edison\Applications\MessageBus\
Working in: D:\Workstations\Developments\Con-Edison\Applications\MessageBus\messagebus-ui\

**ANGULAR COMPONENT STRUCTURE**: Each component MUST have separate files:
- component-name.component.ts (logic only, use templateUrl and styleUrls)
- component-name.component.html (template)
- component-name.component.scss (styles)
DO NOT use inline templates or styles.

Please create:

1. **Conversation Trace Feature** (features/conversation-trace/):
   - ConversationTraceComponent - main container

2. **Conversation List**:
   - ConversationListComponent
   - Filters: state (Active, Closed, Error), date range
   - Table columns: conversation handle, initiator service, target service, state, created timestamp, last activity, message count
   - Sorting by each column
   - Click to select conversation

3. **Vertical Timeline View**:
   - ConversationTimelineComponent
   - Each message as a point on vertical timeline
   - State transitions shown (Initiated → Open → Closed or Error)
   - Visual distinction between sent and received messages
   - Hover preview showing message type, timestamp, size
   - Click to open message in Message Inspector

4. **Message Step Details**:
   - TimelineMessageComponent
   - Sent timestamp, received timestamp
   - Processing duration calculation
   - Message type and priority
   - Body preview (truncated)
   - Status indicator

5. **State Transition Diagram**:
   - StateTransitionDiagramComponent
   - Visual flow diagram: Start → Initiated → Open → Closed/Error
   - Current state highlighted
   - Potential next states shown

6. **Export Options**:
   - ExportConversationComponent
   - Download as JSON button
   - Download as CSV button
   - Copy to clipboard

7. **Conversation Trace Service**:
   - ConversationTraceService - API calls

Update PROJECT-TRACKER.md Phase 9 tasks as you complete them.
```

---

## PROMPT 10: Frontend Diagnostics & Monitoring

```
I'm continuing the Service Broker Message Bus application. This is PHASE 10: Diagnostics & Monitoring.

Project location: D:\Workstations\Developments\Con-Edison\Applications\MessageBus\
Working in: D:\Workstations\Developments\Con-Edison\Applications\MessageBus\messagebus-ui\

**ANGULAR COMPONENT STRUCTURE**: Each component MUST have separate files:
- component-name.component.ts (logic only, use templateUrl and styleUrls)
- component-name.component.html (template)
- component-name.component.scss (styles)
DO NOT use inline templates or styles.

Please create:

1. **Diagnostics Feature** (features/diagnostics/):
   - DiagnosticsComponent - main container with tabs/sections

2. **Service Broker Status Panel**:
   - BrokerStatusPanelComponent
   - Overall health indicator (Healthy, Warning, Critical)
   - List of databases with broker enabled
   - Configuration warnings display

3. **Transmission Queue View**:
   - TransmissionQueueComponent
   - Table: target service, transmission status, time stuck, error description, retry count
   - Actions: force delivery, delete, view message
   - Filter for stuck messages only

4. **Dialog Endpoint Errors**:
   - DialogErrorsComponent
   - Table: conversation handle, service names, error description, time since error
   - Actions: end conversation, delete, view details

5. **Performance Metrics Dashboard**:
   - PerformanceMetricsComponent
   - Message rate chart (messages/second over last hour)
   - Queue depth trend chart (last 24 hours)
   - Slowest queues table (by processing time)
   - Most active services list
   - Conversation age distribution chart

6. **Alert Rules Configuration**:
   - AlertRulesComponent
   - Configurable thresholds: queue depth, message age, error rate, poison count
   - Add/edit/delete alert rules
   - Enable/disable rules
   - Actions on alert: email, webhook, Slack (placeholder config)

7. **Health Check Actions**:
   - HealthCheckComponent
   - Button: Verify Service Broker enabled on all DBs
   - Button: Check for orphaned conversations
   - Button: Scan for messages older than X days
   - Button: Verify all services have valid queues
   - Button: Check contract validity
   - Button: Validate message type definitions
   - Results display panel

8. **Diagnostics Service**:
   - DiagnosticsService - API calls

Update PROJECT-TRACKER.md Phase 10 tasks as you complete them.
```

---

## PROMPT 11: User Roles & Settings

```
I'm continuing the Service Broker Message Bus application. This is PHASE 11: User Roles & Settings.

Project location: D:\Workstations\Developments\Con-Edison\Applications\MessageBus\
Working in: D:\Workstations\Developments\Con-Edison\Applications\MessageBus\messagebus-ui\

**ANGULAR COMPONENT STRUCTURE**: Each component MUST have separate files:
- component-name.component.ts (logic only, use templateUrl and styleUrls)
- component-name.component.html (template)
- component-name.component.scss (styles)
DO NOT use inline templates or styles.

Please create:

1. **Settings Feature** (features/settings/):
   - SettingsComponent - main container

2. **Mode Switching**:
   - ModeSwitchComponent
   - Radio/toggle: Simple Mode vs Advanced Mode
   - Persist selection in localStorage
   - Mode description text

3. **Simple Mode Configuration**:
   - Create a UserModeService in core/
   - Method: isSimpleMode(): boolean
   - Method: isAdvancedMode(): boolean
   - Observable: mode$ for reactive updates

4. **UI Visibility by Mode**:
   - Create *appShowInMode directive (shared/)
   - Usage: *appShowInMode="'advanced'" or *appShowInMode="'simple'"

5. **Simple Mode Restrictions**:
   - Dashboard only (full access)
   - Queue overview (read-only, no technical details)
   - No send/receive/delete capabilities
   - Hide Message Sender feature
   - Hide Purge/Pause buttons
   - Simplified diagnostics (alerts only)

6. **Advanced Mode Features**:
   - All screens available
   - Full control (send, receive, purge, pause)
   - Access to raw message bodies
   - Full diagnostics and conversation tracing
   - Poison message handling

7. **Navigation Updates**:
   - Update app navigation to show/hide items based on mode
   - Simple mode: Dashboard, Queues (read-only), Alerts
   - Advanced mode: All menu items

8. **Settings Persistence**:
   - API key configuration
   - Refresh interval settings
   - Alert preferences

Update PROJECT-TRACKER.md Phase 11 tasks as you complete them.
```

---

## PROMPT 12: External Integration & Client Libraries

```
I'm continuing the Service Broker Message Bus application. This is PHASE 12: External Integration.

Project location: D:\Workstations\Developments\Con-Edison\Applications\MessageBus\

Please create:

1. **Application Registration** (both backend and frontend):

   Backend in: D:\Workstations\Developments\Con-Edison\Applications\MessageBus\MessageBus.Api\
   - ApplicationsController (api/applications)
   - GET / - List registered applications
   - POST / - Register new application
   - PUT /{id} - Update application
   - DELETE /{id} - Delete application
   - POST /{id}/regenerate-key - Generate new API key

   - Application model, ApplicationRepository, ApplicationService

   Frontend (features/settings/):
   - ApplicationRegistrationComponent
   - Application list table
   - Add application dialog
   - Edit permissions dialog
   - API key display (show once, then masked)
   - Regenerate key button

2. **API Key Authentication Enhancement**:
   - Update ApiKeyAuthMiddleware - validate API key from header
   - Check queue permissions for publish/subscribe operations
   - Return 403 if unauthorized

3. **NuGet Package** in: D:\Workstations\Developments\Con-Edison\Applications\MessageBus\MessageBus.Client\
   - Create .NET Standard 2.0 class library project
   - MessageBusClient class with methods:
     - Configure(string apiUrl, string apiKey)
     - PublishAsync<T>(string queueName, T message)
     - SubscribeAsync<T>(string queueName, Func<T, Task> handler)
     - GetQueueStatusAsync(string queueName)
   - HttpClient wrapper with API key header
   - JSON serialization
   - README.md with usage examples

4. **npm Package** in: D:\Workstations\Developments\Con-Edison\Applications\MessageBus\messagebus-client\
   - Create TypeScript package structure
   - MessageBusClient class with methods:
     - configure(apiUrl: string, apiKey: string)
     - publish<T>(queueName: string, message: T): Promise<void>
     - subscribe<T>(queueName: string, handler: (msg: T) => void): Subscription
     - getQueueStatus(queueName: string): Promise<QueueStatus>
   - Fetch wrapper with API key header
   - package.json with build scripts
   - README.md with usage examples

5. **REST API Documentation**:
   - Create API-DOCUMENTATION.md
   - All endpoints with request/response examples
   - Authentication section

Update PROJECT-TRACKER.md Phase 12 tasks as you complete them.
```

---

## PROMPT 13: Deployment & Documentation

```
I'm continuing the Service Broker Message Bus application. This is PHASE 13: Deployment & Documentation.

Project location: D:\Workstations\Developments\Con-Edison\Applications\MessageBus\

Please create:

1. **Development Environment Setup** (DEVELOPMENT-SETUP.md):
   - Prerequisites (Node.js, .NET SDK, SQL Server Express)
   - Clone and setup instructions
   - Database initialization steps (run SQL scripts in order)
   - Running API (port 5000)
   - Running Angular (port 4200)
   - Environment variables

2. **Deployment Configurations**:
   Backend:
   - appsettings.Staging.json
   - appsettings.Production.json
   - web.config for IIS deployment

   Frontend:
   - environment.staging.ts
   - environment.prod.ts
   - IIS web.config for SPA

3. **Operational Runbooks** (RUNBOOKS.md):
   - Runbook 1: Queue Disabled Due to Poison Message
   - Runbook 2: Messages Stuck in Transmission Queue
   - Runbook 3: Consumer Service Crash with Queue Backup
   - Runbook 4: Test Message Publishing
   - Runbook 5: High-Volume Testing

4. **User Documentation** (USER-GUIDE.md):
   - Getting started
   - Dashboard overview
   - Queue Explorer usage
   - Sending messages
   - Handling poison messages
   - Conversation tracing
   - Diagnostics
   - Simple vs Advanced mode

5. **Final Verification Checklist**:
   - All SQL objects exist
   - All API endpoints working
   - All UI screens rendering
   - Real-time updates functioning
   - Client libraries buildable

Update PROJECT-TRACKER.md Phase 13 tasks as you complete them.
Mark overall project as COMPLETE.
```

---

## Post-Completion Verification Prompt

```
I have completed the Service Broker Message Bus application. Please perform a final verification:

1. **Review PROJECT-TRACKER.md** - Confirm all tasks are marked complete

2. **SQL Server Verification**:
   - List all message types, contracts, queues, services
   - List all custom tables
   - List all stored procedures
   - List all views

3. **Backend Verification**:
   - List all API controllers and their endpoints
   - Confirm all services are implemented
   - Confirm all repositories are implemented

4. **Frontend Verification**:
   - List all feature modules
   - Confirm all components exist
   - Check routing configuration

5. **Documentation Verification**:
   - Confirm all documentation files exist

Provide a summary report of completion status and any missing items.
```

---

## Usage Instructions

1. **Start with PROMPT 0** (SQL Server Foundation) - THIS IS CRITICAL
2. Continue with PROMPT 0.5A, 0.5B, 0.5C, 0.5D (SQL procedures)
3. Complete PROMPT 0.7 (SQL views)
4. Then proceed to PROMPT 1 through 13
5. After each prompt completes, verify the PROJECT-TRACKER.md is updated
6. Use the Post-Completion Verification Prompt at the end

---

## Notes

- **SQL Server phases are the foundation** - do not skip them
- Each prompt is designed for ~2000-4000 tokens of context
- The .NET backend calls SQL stored procedures (not direct queries)
- The Angular frontend calls the .NET API
- External apps call the Message Bus API (not SQL directly)
