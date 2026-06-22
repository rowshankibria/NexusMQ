# Service Broker Message Bus - Project Tracker

## Project Overview
A comprehensive Service Broker monitoring and management application with:
- **Database**: SQL Server with Service Broker (THE CORE)
- **Backend**: .NET Core API
- **Frontend**: Angular SPA

---

## Phase Breakdown

### PHASE 0: SQL Server Service Broker Foundation
**Status**: ✅ Completed
**Priority**: CRITICAL - Must complete before any other phase

| Task | Status | Notes |
|------|--------|-------|
| 0.1 Enable Service Broker on database | ✅ | 00-EnableServiceBroker.sql |
| 0.2 Create Message Types (Request, Response, Error, Ack) | ✅ | 01-CreateMessageTypes.sql |
| 0.3 Create Contracts | ✅ | 02-CreateContracts.sql |
| 0.4 Create Queues with proper settings | ✅ | 03-CreateQueues.sql |
| 0.5 Create Services bound to queues | ✅ | 04-CreateServices.sql |
| 0.6 Create activation stored procedures | ✅ | 05-CreateActivationProcedure.sql, 06-EnableQueueActivation.sql |
| 0.7 Test basic send/receive with TSQL | ✅ | 07-TestServiceBroker.sql |

---

### PHASE 0.5: SQL Server Custom Tables & Procedures
**Status**: 🔄 Completed
**Priority**: CRITICAL - Required for application features

| Task | Status | Notes |
|------|--------|-------|
| 0.5.1 Create DeadLetterQueue table | ✅ | 10-CreateDeadLetterQueue.sql |
| 0.5.2 Create MessageAuditTrail table (optional) | ✅ | 11-CreateMessageAuditTrail.sql |
| 0.5.3 Create PerformanceMetrics table (optional) | ✅ | 12-CreatePerformanceMetrics.sql |
| 0.5.4 Create RegisteredApplications table | ✅ | 13-CreateRegisteredApplications.sql |
| 0.5.5 Create AlertRules table | ✅ | 14-CreateAlertTables.sql |
| 0.5.6 Create AlertHistory table | ✅ | 14-CreateAlertTables.sql |
| 0.5.7 usp_SendMessage procedure | ✅ | 20-usp_SendMessage.sql |
| 0.5.8 usp_ReceiveMessage procedure | ✅ | 21-usp_ReceiveMessage.sql, 22-usp_ReceiveMessages.sql (batch) |
| 0.5.9 usp_GetQueueStatistics procedure | ✅ | 24-usp_GetQueueStatistics.sql |
| 0.5.10 usp_PeekMessages procedure | ✅ | 23-usp_PeekMessages.sql |
| 0.5.11 usp_GetAllQueuesWithStats procedure | ✅ | 25-usp_GetAllQueuesWithStats.sql |
| 0.5.12 usp_RetryPoisonMessage procedure | ✅ | 26-usp_RetryPoisonMessage.sql |
| 0.5.13 usp_MoveToDeadLetter procedure | ✅ | 27-usp_MoveToDeadLetter.sql |
| 0.5.14 usp_PurgeQueue procedure | ✅ | 28-usp_PurgeQueue.sql |
| 0.5.15 usp_PauseQueue / usp_ResumeQueue | ✅ | 29-usp_PauseQueue.sql, 30-usp_ResumeQueue.sql |
| 0.5.16 usp_GetConversationTrace procedure | ✅ | 31-usp_GetConversationTrace.sql |
| 0.5.17 usp_GetTransmissionQueueStatus procedure | ✅ | 32-usp_GetTransmissionQueueStatus.sql |
| 0.5.18 usp_GetDialogErrors procedure | ✅ | 33-usp_GetDialogErrors.sql |
| 0.5.19 usp_RunHealthCheck procedure | ✅ | 34-usp_RunHealthCheck.sql |
| 0.5.20 usp_CollectPerformanceMetrics procedure | ✅ | 35-usp_CollectPerformanceMetrics.sql, 36-usp_GetPerformanceMetrics.sql |

---

### PHASE 0.7: SQL Server Views for Monitoring
**Status**: ✅ Completed

| Task | Status | Notes |
|------|--------|-------|
| 0.7.1 vw_QueueStatus - consolidated queue view | ✅ | 40-vw_QueueStatus.sql |
| 0.7.2 vw_ServiceBrokerHealth - overall health | ✅ | 41-vw_ServiceBrokerHealth.sql |
| 0.7.3 vw_ActiveConversations | ✅ | 42-vw_ActiveConversations.sql |
| 0.7.4 vw_PoisonMessages | ✅ | 43-vw_PoisonMessages.sql |
| 0.7.5 vw_MessageThroughput | ✅ | 44-vw_MessageThroughput.sql |
| 0.7.6 vw_ConversationEndpoints | ✅ | 45-vw_ConversationEndpoints.sql |
| 0.7.7 Verification script for all objects | ✅ | 99-VerifyAllObjects.sql |

---

### PHASE 1: Project Foundation & Basic Setup
**Status**: ✅ Completed

| Task | Status | Notes |
|------|--------|-------|
| 1.1 Create .NET Core Web API project structure | ✅ | MessageBus.Api with Controllers, Services, Repositories, DTOs, Models, Hubs, Middleware, BackgroundServices folders |
| 1.2 Create Angular project structure | ✅ | messagebus-ui with Angular 18, lazy-loaded feature modules, core services |
| 1.3 Configure connection strings | ✅ | appsettings.json and appsettings.Development.json configured |
| 1.4 Setup dependency injection | ✅ | Program.cs with services, repositories, SqlConnection, SignalR, CORS |
| 1.5 Basic health check endpoint | ✅ | HealthController calling usp_RunHealthCheck via HealthService/Repository |

---

### PHASE 1.5: Angular Component Refactoring
**Status**: ⬜ Not Started
**Priority**: Required before continuing with frontend phases

| Task | Status | Notes |
|------|--------|-------|
| 1.5.1 Refactor app.component to separate files | ⬜ | .ts, .html, .scss |
| 1.5.2 Refactor dashboard.component to separate files | ⬜ | .ts, .html, .scss |
| 1.5.3 Refactor queue-explorer.component to separate files | ⬜ | .ts, .html, .scss |
| 1.5.4 Refactor message-inspector.component to separate files | ⬜ | .ts, .html, .scss |
| 1.5.5 Refactor message-sender.component to separate files | ⬜ | .ts, .html, .scss |
| 1.5.6 Refactor poison-messages.component to separate files | ⬜ | .ts, .html, .scss |
| 1.5.7 Refactor conversation-trace.component to separate files | ⬜ | .ts, .html, .scss |
| 1.5.8 Refactor diagnostics.component to separate files | ⬜ | .ts, .html, .scss |
| 1.5.9 Refactor settings.component to separate files | ⬜ | .ts, .html, .scss |

---

### PHASE 2: Backend Core - Data Access Layer
**Status**: ⬜ Not Started

| Task | Status | Notes |
|------|--------|-------|
| 2.1 Create repository interfaces | ⬜ | |
| 2.2 QueueRepository - queue operations | ⬜ | |
| 2.3 MessageRepository - message operations | ⬜ | |
| 2.4 ServiceRepository - service metadata | ⬜ | |
| 2.5 PoisonMessageRepository | ⬜ | |
| 2.6 ConversationRepository | ⬜ | |
| 2.7 DiagnosticsRepository | ⬜ | |
| 2.8 Unit tests for repositories | ⬜ | |

---

### PHASE 3: Backend Core - Service Layer
**Status**: ⬜ Not Started

| Task | Status | Notes |
|------|--------|-------|
| 3.1 QueueService - business logic | ⬜ | |
| 3.2 MessageService - send/receive logic | ⬜ | |
| 3.3 PoisonMessageService | ⬜ | |
| 3.4 ConversationService | ⬜ | |
| 3.5 DiagnosticsService | ⬜ | |
| 3.6 HealthMonitorService (background) | ⬜ | |
| 3.7 MetricsCollectionService (background) | ⬜ | |
| 3.8 AlertService | ⬜ | |

---

### PHASE 4: Backend Core - API Controllers
**Status**: ⬜ Not Started

| Task | Status | Notes |
|------|--------|-------|
| 4.1 QueuesController | ⬜ | |
| 4.2 MessagesController | ⬜ | |
| 4.3 PoisonMessagesController | ⬜ | |
| 4.4 ServicesController | ⬜ | |
| 4.5 ConversationsController | ⬜ | |
| 4.6 DiagnosticsController | ⬜ | |
| 4.7 WebSocket Hub for real-time updates | ⬜ | |
| 4.8 API authentication/authorization | ⬜ | |
| 4.9 Swagger/OpenAPI documentation | ⬜ | |

---

### PHASE 5: Frontend - Core & Dashboard
**Status**: ⬜ Not Started

| Task | Status | Notes |
|------|--------|-------|
| 5.1 Angular project setup with routing | ⬜ | |
| 5.2 Core services (API, WebSocket) | ⬜ | |
| 5.3 Shared components (cards, tables, charts) | ⬜ | |
| 5.4 Dashboard - System health summary | ⬜ | |
| 5.5 Dashboard - Queue health cards grid | ⬜ | |
| 5.6 Dashboard - Message throughput graph | ⬜ | |
| 5.7 Dashboard - Dead-letter summary | ⬜ | |
| 5.8 Dashboard - Real-time updates | ⬜ | |
| 5.9 Dashboard - Configurable alerts | ⬜ | |

---

### PHASE 6: Frontend - Queue Explorer
**Status**: ⬜ Not Started

| Task | Status | Notes |
|------|--------|-------|
| 6.1 Queue list sidebar (searchable/filterable) | ⬜ | |
| 6.2 Queue detail panel | ⬜ | |
| 6.3 Queue statistics display | ⬜ | |
| 6.4 Queue action buttons | ⬜ | |
| 6.5 Message table with pagination | ⬜ | |
| 6.6 Bulk message actions | ⬜ | |

---

### PHASE 7: Frontend - Message Inspector & Sender
**Status**: ✅ Completed

| Task | Status | Notes |
|------|--------|-------|
| 7.1 Message metadata panel | ✅ | MessageMetadataComponent with copy-to-clipboard, status badges, priority display |
| 7.2 Message body viewer (JSON/XML/text) | ✅ | MessageBodyViewerComponent with auto-format detection, syntax highlighting, hex view |
| 7.3 Conversation context panel | ✅ | ConversationContextComponent with dialog state visualization, service flow diagram |
| 7.4 Related messages navigation | ✅ | RelatedMessagesComponent with prev/next, progress bar, message timeline |
| 7.5 Message sender form | ✅ | MessageSenderComponent with service/contract/type dropdowns, cascading filters |
| 7.6 Message body editor with validation | ✅ | MessageBodyEditorComponent with JSON/XML validation, format button, templates |
| 7.7 Advanced send options | ✅ | Dialog handle, conversation group ID, dialog lifetime options |
| 7.8 Bulk send for testing | ✅ | Single/Bulk mode toggle with copy count (1-1000) |

---

### PHASE 8: Frontend - Poison Message Manager
**Status**: ⬜ Not Started

| Task | Status | Notes |
|------|--------|-------|
| 8.1 Poison message list | ⬜ | |
| 8.2 Dead-letter queue view | ⬜ | |
| 8.3 Message detail with error trace | ⬜ | |
| 8.4 Retry/purge actions | ⬜ | |
| 8.5 Bulk actions | ⬜ | |

---

### PHASE 9: Frontend - Conversation Trace Viewer
**Status**: ⬜ Not Started

| Task | Status | Notes |
|------|--------|-------|
| 9.1 Conversation list with filters | ⬜ | |
| 9.2 Vertical timeline view | ⬜ | |
| 9.3 Message details per step | ⬜ | |
| 9.4 State transition diagram | ⬜ | |
| 9.5 Export options (JSON/CSV) | ⬜ | |

---

### PHASE 10: Frontend - Diagnostics & Monitoring
**Status**: ⬜ Not Started

| Task | Status | Notes |
|------|--------|-------|
| 10.1 Service Broker status panel | ⬜ | |
| 10.2 Transmission queue view | ⬜ | |
| 10.3 Dialog endpoint errors | ⬜ | |
| 10.4 Performance metrics dashboard | ⬜ | |
| 10.5 Alert rules configuration | ⬜ | |
| 10.6 Health check actions | ⬜ | |

---

### PHASE 11: User Roles & Settings
**Status**: ⬜ Not Started

| Task | Status | Notes |
|------|--------|-------|
| 11.1 Simple Mode (operators) | ⬜ | |
| 11.2 Advanced Mode (developers/DBAs) | ⬜ | |
| 11.3 Mode switching in settings | ⬜ | |
| 11.4 Role-based UI visibility | ⬜ | |

---

### PHASE 12: External Integration & Client Libraries
**Status**: ⬜ Not Started

| Task | Status | Notes |
|------|--------|-------|
| 12.1 Application registration screen | ⬜ | |
| 12.2 API key generation/management | ⬜ | |
| 12.3 Queue permission assignment | ⬜ | |
| 12.4 NuGet package (MessageBus.Client) | ⬜ | |
| 12.5 npm package (@yourorg/messagebus-client) | ⬜ | |
| 12.6 REST API documentation | ⬜ | |

---

### PHASE 13: Deployment & Documentation
**Status**: ⬜ Not Started

| Task | Status | Notes |
|------|--------|-------|
| 13.1 Development environment setup docs | ⬜ | |
| 13.2 Staging deployment configuration | ⬜ | |
| 13.3 Production deployment configuration | ⬜ | |
| 13.4 Operational runbooks | ⬜ | |
| 13.5 User documentation | ⬜ | |

---

## Progress Summary

| Phase | Description | Progress |
|-------|-------------|----------|
| **Phase 0** | **SQL Server Service Broker Foundation** | **7/7** ✅ |
| **Phase 0.5** | **SQL Server Tables & Procedures** | **20/20** ✅ |
| **Phase 0.7** | **SQL Server Views** | **7/7** ✅ |
| **Phase 1** | **Project Foundation** | **5/5** ✅ |
| Phase 1.5 | Angular Component Refactoring | 0/9 |
| Phase 2 | Data Access Layer | 0/8 |
| Phase 3 | Service Layer | 0/8 |
| Phase 4 | API Controllers | 0/9 |
| Phase 5 | Frontend Core & Dashboard | 0/9 |
| Phase 6 | Queue Explorer | 0/6 |
| **Phase 7** | **Message Inspector & Sender** | **8/8** ✅ |
| Phase 8 | Poison Message Manager | 0/5 |
| Phase 9 | Conversation Trace Viewer | 0/5 |
| Phase 10 | Diagnostics & Monitoring | 0/6 |
| Phase 11 | User Roles & Settings | 0/4 |
| Phase 12 | External Integration | 0/6 |
| Phase 13 | Deployment & Documentation | 0/5 |

**Total Tasks**: 127
**Completed**: 47
**Overall Progress**: 37%

---

## Execution Order (IMPORTANT)

```
┌─────────────────────────────────────────────────────────────┐
│  PHASE 0: SQL Server Service Broker Foundation              │
│  (Enable broker, create message types, contracts,           │
│   queues, services, activation procedures)                  │
└─────────────────────────┬───────────────────────────────────┘
                          ▼
┌─────────────────────────────────────────────────────────────┐
│  PHASE 0.5: SQL Server Custom Tables & Stored Procedures    │
│  (DeadLetter table, all usp_* procedures for                │
│   send/receive/monitoring/diagnostics)                      │
└─────────────────────────┬───────────────────────────────────┘
                          ▼
┌─────────────────────────────────────────────────────────────┐
│  PHASE 0.7: SQL Server Views for Monitoring                 │
│  (Consolidated views that combine system tables)            │
└─────────────────────────┬───────────────────────────────────┘
                          ▼
┌─────────────────────────────────────────────────────────────┐
│  PHASE 1-4: .NET Core Backend                               │
│  (Repositories call stored procedures,                      │
│   Services add business logic, Controllers expose API)      │
└─────────────────────────┬───────────────────────────────────┘
                          ▼
┌─────────────────────────────────────────────────────────────┐
│  PHASE 5-11: Angular Frontend                               │
│  (UI components that call the .NET API)                     │
└─────────────────────────┬───────────────────────────────────┘
                          ▼
┌─────────────────────────────────────────────────────────────┐
│  PHASE 12-13: Integration & Deployment                      │
│  (Client libraries, documentation, runbooks)                │
└─────────────────────────────────────────────────────────────┘
```

---

## Execution Notes

- **SQL Server phases (0, 0.5, 0.7) MUST complete first**
- Each phase should be executed with a separate prompt
- Mark tasks as ✅ when completed
- Add notes for any issues or deviations
- Update progress summary after each session

---

## Last Updated
- **Date**: 2026-06-21
- **Current Phase**: Phase 7 (Frontend - Message Inspector & Sender) COMPLETE
- **Next Action**: Continue to Phase 8 (Frontend - Poison Message Manager)
