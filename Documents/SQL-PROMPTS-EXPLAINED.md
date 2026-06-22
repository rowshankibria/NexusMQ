# SQL Prompts Explained (0 to 0.7)

Brief explanation of what each SQL prompt accomplishes for the Service Broker Message Bus.

---

## PROMPT 0: Service Broker Foundation
**Purpose**: Sets up the core Service Broker infrastructure that SQL Server needs to send/receive messages.

| Script | What It Does |
|--------|--------------|
| 00-EnableServiceBroker.sql | Turns on Service Broker for your database (it's disabled by default) |
| 01-CreateMessageTypes.sql | Defines the "shapes" of messages (Request, Response, Error, Ack) - like defining email templates |
| 02-CreateContracts.sql | Rules for conversations - which message types can be sent by initiator vs target |
| 03-CreateQueues.sql | Creates the actual message storage locations (like mailboxes) |
| 04-CreateServices.sql | Creates endpoints that applications talk to (services are bound to queues) |
| 05/06-Activation.sql | Auto-processing - when a message arrives, automatically run a stored procedure |
| 07-TestServiceBroker.sql | Verifies everything works by sending/receiving a test message |

---

## PROMPT 0.5A: Core Tables
**Purpose**: Creates custom tables that Service Broker doesn't provide natively.

| Table | Why It's Needed |
|-------|-----------------|
| DeadLetterQueue | Service Broker has NO built-in dead-letter queue. Failed messages need somewhere to go |
| MessageAuditTrail | Logs all send/receive operations for troubleshooting |
| PerformanceMetrics | Stores throughput data for dashboards |
| RegisteredApplications | Tracks which external apps can use the Message Bus |
| AlertRules/AlertHistory | Configurable alerting (queue depth > 1000, etc.) |

---

## PROMPT 0.5B: Message Operations Procedures
**Purpose**: Wraps Service Broker commands in easy-to-call stored procedures.

| Procedure | What It Does |
|-----------|--------------|
| usp_SendMessage | Sends a message (handles dialog creation internally) |
| usp_ReceiveMessage | Receives one message from a queue |
| usp_ReceiveMessages | Batch receive multiple messages |
| usp_PeekMessages | View messages WITHOUT removing them from queue |

---

## PROMPT 0.5C: Queue Management Procedures
**Purpose**: Provides queue administration capabilities.

| Procedure | What It Does |
|-----------|--------------|
| usp_GetQueueStatistics | Message count, oldest message age, throughput |
| usp_GetAllQueuesWithStats | Dashboard overview of all queues |
| usp_RetryPoisonMessage | Moves poison message back to queue for retry |
| usp_MoveToDeadLetter | Permanently fails a message to dead-letter table |
| usp_PurgeQueue | Deletes all messages from a queue |
| usp_PauseQueue | Stops queue processing |
| usp_ResumeQueue | Resumes queue processing |

---

## PROMPT 0.5D: Diagnostics Procedures
**Purpose**: Health monitoring and troubleshooting capabilities.

| Procedure | What It Does |
|-----------|--------------|
| usp_GetConversationTrace | Shows full message history for a conversation |
| usp_GetTransmissionQueueStatus | Messages stuck trying to reach remote services |
| usp_GetDialogErrors | Conversations in error state |
| usp_RunHealthCheck | Full system diagnostic (orphaned conversations, old messages, etc.) |
| usp_CollectPerformanceMetrics | Gathers stats for the metrics table |
| usp_GetPerformanceMetrics | Retrieves stored performance data |

---

## PROMPT 0.7: Monitoring Views
**Purpose**: Creates SQL views that combine system tables for easier querying.

| View | What It Shows |
|------|---------------|
| vw_QueueStatus | Consolidated queue info (joins sys.service_queues, counts, etc.) |
| vw_ServiceBrokerHealth | Overall health status in one query |
| vw_ActiveConversations | All open dialogs with their state |
| vw_PoisonMessages | Messages that caused queue to disable |
| vw_MessageThroughput | Messages per minute/hour trends |
| vw_ConversationEndpoints | Service-to-service conversation mapping |

---

## Summary Flow

```
PROMPT 0 (Foundation)     → Creates the messaging infrastructure
PROMPT 0.5A (Tables)      → Adds custom storage for dead-letters, auditing, alerts
PROMPT 0.5B (Send/Receive)→ Makes sending/receiving messages simple
PROMPT 0.5C (Queue Mgmt)  → Adds pause, resume, purge, retry capabilities
PROMPT 0.5D (Diagnostics) → Adds health checks and troubleshooting
PROMPT 0.7 (Views)        → Creates easy-to-query monitoring views
```
