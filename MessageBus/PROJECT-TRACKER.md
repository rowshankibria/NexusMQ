# Service Broker Message Bus - Project Tracker

## Project Overview
This project is a Service Broker Message Bus application with a .NET backend API and Angular frontend UI.

---

## Phase 1: Initial Setup
**Status:** Complete

- Created .NET Web API project (MessageBus.Api)
- Created Angular 18 frontend project (messagebus-ui)
- Set up project structure with core services
- Implemented health check endpoint and dashboard component

---

## Phase 1.5: Angular Component Refactoring
**Status:** Complete

Refactored all Angular components from inline templates/styles to separate files.

### Components Refactored:
| Component | Files Created |
|-----------|---------------|
| app.component | app.component.html, app.component.scss |
| dashboard | dashboard.component.html, dashboard.component.scss |
| queue-explorer | queue-explorer.component.html, queue-explorer.component.scss |
| message-inspector | message-inspector.component.html, message-inspector.component.scss |
| message-sender | message-sender.component.html, message-sender.component.scss |
| poison-messages | poison-messages.component.html, poison-messages.component.scss |
| conversation-trace | conversation-trace.component.html, conversation-trace.component.scss |
| diagnostics | diagnostics.component.html, diagnostics.component.scss |
| settings | settings.component.html, settings.component.scss |

### Component Decorator Format:
```typescript
@Component({
  selector: 'app-component-name',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './component-name.component.html',
  styleUrls: ['./component-name.component.scss']
})
```

---

## Phase 2: Repository Layer
**Status:** Complete

- Implemented all repository interfaces and implementations
- Created Entity Framework Core DbContext with keyless entities
- Mapped stored procedures and views for data access

### Repositories Implemented:
| Repository | Description |
|------------|-------------|
| QueueRepository | Queue operations (get, pause, resume, purge) |
| MessageRepository | Message peek, send, receive operations |
| ServiceRepository | Service and contract metadata |
| PoisonMessageRepository | Poison message and dead letter queue operations |
| ConversationRepository | Conversation tracking and trace |
| DiagnosticsRepository | Health checks, transmission queue, dialog errors |
| HealthRepository | System health check operations |

---

## Phase 3: Service Layer
**Status:** Complete

Implemented comprehensive service layer with business logic, validation, and background services.

### Service Interfaces Created:
| Interface | Location |
|-----------|----------|
| IQueueService | Services/Interfaces/IQueueService.cs |
| IMessageService | Services/Interfaces/IMessageService.cs |
| IPoisonMessageService | Services/Interfaces/IPoisonMessageService.cs |
| IConversationService | Services/Interfaces/IConversationService.cs |
| IDiagnosticsService | Services/Interfaces/IDiagnosticsService.cs |
| IAlertService | Services/Interfaces/IAlertService.cs |

### Service Implementations:
| Service | Key Features |
|---------|--------------|
| QueueService | Health status calculation (Healthy/Warning/Critical), validation before pause/resume/purge |
| MessageService | Send validation, message type validation, target service validation, bulk send for testing |
| PoisonMessageService | Retry logic, bulk retry/purge operations, dead letter resolution |
| ConversationService | Timeline building, JSON/CSV export, conversation statistics |
| DiagnosticsService | Comprehensive health checks, orphaned conversation detection, service validation |
| AlertService | Alert rule management, threshold evaluation, notification triggers (placeholder) |

### Background Services:
| Service | Description |
|---------|-------------|
| HealthMonitorService | Runs health checks every 30 seconds, broadcasts via SignalR |
| MetricsCollectionService | Collects queue depth/throughput every minute, broadcasts metrics |

### DTOs and Result Types:
- ServiceResult / ServiceResult<T> - Generic operation results
- QueueHealthStatus - Queue health with issues list
- HealthLevel enum - Healthy, Warning, Critical, Unknown
- SendMessageRequest / BulkSendResult - Message operations
- BulkOperationResult - Batch operation results
- ConversationDetail / ConversationTimeline - Conversation visualization
- DiagnosticsResult / SystemStatus - Health check results
- AlertRule / ActiveAlert / AlertEvaluation - Alert system models

---

## Phase 4: API Controllers
**Status:** Complete

Implemented all REST API controllers, SignalR hub enhancements, middleware, and Swagger configuration.

### Controllers Created:
| Controller | Route | Endpoints |
|------------|-------|-----------|
| QueuesController | api/queues | GET /, GET /{queueName}, GET /{queueName}/health, GET /{queueName}/messages, POST /{queueName}/pause, POST /{queueName}/resume, DELETE /{queueName}/purge |
| MessagesController | api/messages | GET /{conversationHandle}, POST /send, POST /send-bulk, GET /validate/message-type, GET /validate/service |
| PoisonMessagesController | api/poison-messages | GET /, GET /dead-letter, GET /stats, POST /{id}/retry, POST /{id}/purge, POST /bulk-retry, POST /bulk-purge, POST /dead-letter/{id}/resolve |
| ServicesController | api/services | GET /, GET /{serviceName}, GET /{serviceName}/contracts, GET /message-types, GET /summary |
| ConversationsController | api/conversations | GET /, GET /stats, GET /{conversationHandle}, GET /{conversationHandle}/trace, GET /{conversationHandle}/timeline, GET /{conversationHandle}/export, POST /{conversationHandle}/end |
| DiagnosticsController | api/diagnostics | GET /status, GET /broker, GET /transmission-queue, GET /dialog-errors, GET /metrics, POST /health-check, GET /orphaned-conversations, GET /validate-services, GET /summary |

### SignalR Hub Updates (MessageBusHub):
| Method | Description |
|--------|-------------|
| SubscribeToQueue(queueName) | Join group for queue updates |
| UnsubscribeFromQueue(queueName) | Leave queue group |
| SubscribeToDashboard() | Subscribe to dashboard updates |
| UnsubscribeFromDashboard() | Leave dashboard group |
| SubscribeToAlerts() | Subscribe to alert notifications |
| UnsubscribeFromAlerts() | Leave alerts group |
| SubscribeToConversation(handle) | Subscribe to conversation updates |
| UnsubscribeFromConversation(handle) | Leave conversation group |
| Ping() | Connection status check |

### Hub Extension Methods:
- SendQueueUpdated(queueName, stats)
- SendAlertTriggered(alert)
- SendHealthUpdate(status)
- SendMetricsUpdate(metrics)
- SendConversationUpdated(handle, detail)
- SendPoisonMessageAlert(poisonMessage)
- BroadcastNotification(type, message, data)

### Middleware:
| Middleware | Description |
|------------|-------------|
| ApiKeyAuthMiddleware | Validates X-API-Key header, permission-based access control |

### API Key Permissions:
- `read` - GET requests allowed
- `write` - POST/PUT/PATCH requests allowed (except purge)
- `admin` - DELETE and purge operations allowed
- `*` - Full access

### Swagger Configuration:
- API documentation with XML comments
- API Key authentication in Swagger UI
- Request/response examples
- Deep linking and request duration display

### Configuration Added (appsettings.json):
```json
"ApiKey": {
  "Enabled": false,
  "ValidKeys": [
    { "Name": "Development", "Key": "...", "Permissions": ["*"] },
    { "Name": "ReadOnly", "Key": "...", "Permissions": ["read"] },
    { "Name": "Operator", "Key": "...", "Permissions": ["read", "write"] }
  ]
}
```

---

## Phase 5: Frontend Core & Dashboard
**Status:** Complete

Implemented comprehensive Angular frontend core services, shared components, and dashboard feature module.

### Core Module (core/services/)
| Service | Description |
|---------|-------------|
| ApiService | HTTP client wrapper with API key authentication, base URL config |
| AuthService | API key storage/retrieval in localStorage |
| ConfigService | App configuration (API URL, SignalR URL, refresh intervals) |
| HealthService | Health check API calls |
| SignalRService | Real-time SignalR connection management |

### Shared Module (shared/components/)
| Component | Description |
|-----------|-------------|
| StatusBadgeComponent | Status display (active, idle, disabled, poison, healthy, warning, critical) |
| MetricCardComponent | Metric display with label, value, icon, trend, variants |
| DataTableComponent | Generic paginated table with sorting, custom templates |
| ConfirmDialogComponent | Confirmation modal with types (info, warning, danger, success) |
| LoadingSpinnerComponent | Loading indicator with sizes and overlay mode |

### Dashboard Feature (features/dashboard/)
| Component | Description |
|-----------|-------------|
| DashboardComponent | Main container, state management, auto-refresh |
| SystemHealthSummaryComponent | Total services, conversations, queue depth, status metrics |
| QueueHealthGridComponent | Grid layout of queue health cards with summary badges |
| QueueHealthCardComponent | Individual queue card with status, count, age, throughput |
| ThroughputChartComponent | Canvas-based line chart with time range toggle (1h, 6h, 24h) |
| DeadLetterSummaryComponent | Poison count, dead-letter count, oldest age, recent messages |
| BrokerStatusComponent | Broker enabled indicator, server details, warnings |

### Dashboard Service & Models
| Item | Description |
|------|-------------|
| DashboardService | API calls for all dashboard data, SignalR subscriptions, auto-refresh |
| SystemHealth | Interface for system health metrics |
| QueueHealth | Interface for queue health with status and throughput |
| ThroughputSummary | Interface for throughput data with time ranges |
| DeadLetterSummary | Interface for poison/dead-letter statistics |
| BrokerStatus | Interface for Service Broker status |

### Routing
- Lazy loading configured for dashboard module
- Dashboard set as default route
- Wildcard route redirects to dashboard

---

## Phase 6: Queue Explorer
**Status:** Complete

Implemented comprehensive Queue Explorer feature for browsing, managing, and monitoring Service Broker queues.

### Queue Explorer Components (features/queue-explorer/)
| Component | Description |
|-----------|-------------|
| QueueExplorerComponent | Main container with sidebar + detail panel layout |
| QueueListComponent | Searchable/filterable queue list with status badges |
| QueueDetailComponent | Queue configuration and statistics display |
| QueueActionsComponent | Action buttons (send, receive, pause/resume, purge) |
| MessageTableComponent | Paginated message table with bulk actions |

### Queue List Features
- Search input with 300ms debounce
- Filter by status (all, active, idle, disabled, poison)
- Sort by name, message count, oldest age
- Status badge and message count per queue
- Real-time updates via SignalR

### Queue Detail Panel
- Configuration section: service name, queue name, max readers, activation
- Statistics section: message counts by status, ages, throughput
- Message breakdown with visual progress bars
- Processing metrics (messages/min, avg processing time)

### Queue Actions
- Send Message (links to message sender)
- Receive Message
- Pause/Resume toggle with status indicator
- Purge with confirmation dialog
- View Poison Messages (links to poison messages view)
- Refresh button

### Message Table Features
- Columns: sequence number, type, priority, status, size, age, timestamp
- Sorting on each column
- Filtering by message type, status
- Pagination (25, 50, 100 rows)
- Row selection for bulk actions
- Bulk actions: delete, mark as received, export JSON
- Click to view message details

### Queue Explorer Service
| Method | Description |
|--------|-------------|
| loadQueues() | Fetch all queues with filtering |
| selectQueue() | Load queue details and messages |
| loadQueueStatistics() | Get detailed queue stats |
| loadMessages() | Paginated message loading |
| setFilter() / setMessageFilter() | Apply filters |
| pauseQueue() / resumeQueue() | Toggle queue state |
| purgeQueue() | Delete all messages |
| deleteMessages() | Bulk delete messages |
| markMessagesAsReceived() | Bulk mark as received |
| exportMessagesToJson() | Export messages |

### Models Created
- Queue, QueueStatistics, QueueMessage interfaces
- QueueFilter, MessageFilter for filtering
- QueueExplorerState for state management
- BulkActionResult, PurgeQueueResult for operations

---

## Phase 8: Poison Message Manager
**Status:** Complete

Implemented comprehensive Poison Message Manager for handling failed messages and dead-letter queue operations.

### Poison Messages Feature (features/poison-messages/)
| Component | Description |
|-----------|-------------|
| PoisonMessagesComponent | Main container with tabs for poison/dead-letter messages, stats summary |
| PoisonMessageListComponent | Filterable/sortable table with bulk actions for poison messages |
| DeadLetterListComponent | Dead-letter queue table with inline resolution notes editing |
| PoisonMessageDetailComponent | Slide-out panel with message details, body viewer, error trace, retry history |

### Shared Component Added (shared/components/)
| Component | Description |
|-----------|-------------|
| MessageBodyViewerComponent | Reusable message body viewer with JSON/XML/text formatting, hex view, copy/export |

### Poison Message List Features
- Table columns: queue name, conversation handle, message type, error message, retry count, timestamps
- Sorting by queue, message type, moved to poison timestamp, retry count, last retry
- Filtering by queue name, message type, search term
- Row selection for bulk operations
- Inline retry/purge action buttons

### Dead-Letter Queue Features
- Table columns: queue name, message type, reason, resolution notes, created timestamp
- Filtering by queue, message type, dead-letter reason
- Inline resolution notes editing with save/cancel
- Reason badges with color coding

### Message Detail Panel
- Full message body viewer (formatted, raw, hex views)
- Error trace display with stack trace formatting
- Retry history timeline for poison messages
- Queue status display (receive/enqueue enabled, message counts)
- Action buttons: retry, purge, re-enable queue

### Bulk Operations
- Select multiple poison messages via checkboxes
- Bulk retry with confirmation dialog
- Bulk purge with confirmation dialog
- Selection count indicator
- Progress feedback via loading states

### Poison Messages Service
| Method | Description |
|--------|-------------|
| loadPoisonMessages() | Paginated poison message loading with filters |
| loadDeadLetterMessages() | Paginated dead-letter loading with filters |
| loadStats() | Load poison message statistics |
| loadPoisonMessageDetail() | Load full poison message details with history |
| retryPoisonMessage() | Retry single message, re-enable queue |
| purgePoisonMessage() | Move message to dead-letter |
| bulkRetry() / bulkPurge() | Batch operations |
| reEnableQueue() | Resume disabled queue |
| resolveDeadLetter() | Add resolution notes to dead-letter |

### Models Created
- PoisonMessage, PoisonMessageDetail, DeadLetterMessage interfaces
- RetryHistoryEntry for retry timeline
- PoisonMessageFilter, DeadLetterFilter for filtering
- PoisonMessagesState for state management
- BulkRetryResult, BulkPurgeResult for operations
- DeadLetterReason type with labels

---

## Phase 9: Conversation Trace Viewer
**Status:** Complete

Implemented comprehensive Conversation Trace Viewer for tracking and visualizing Service Broker conversations and message flow.

### Conversation Trace Components (features/conversation-trace/)
| Component | Description |
|-----------|-------------|
| ConversationTraceComponent | Main container with stats summary, list panel, and detail panel layout |
| ConversationListComponent | Filterable/sortable conversation table with state, date range, and service filters |
| ConversationTimelineComponent | Vertical timeline view showing messages and state transitions chronologically |
| TimelineMessageComponent | Individual message card with direction indicator, timestamps, processing duration |
| StateTransitionDiagramComponent | Visual SVG flow diagram showing conversation state progression |
| ExportConversationComponent | Export options panel with JSON/CSV download and clipboard copy |

### Conversation List Features
- Table columns: conversation handle, initiator service, target service, state, created timestamp, last activity, message count
- Sorting by each column with ascending/descending toggle
- Filtering by state (Active, Closed, Error, or specific states)
- Date range filtering
- Service filtering (initiator and target)
- Search functionality with debounce
- Pagination with configurable page size

### Vertical Timeline View
- Messages displayed as timeline points with directional indicators (sent/received)
- State transitions shown inline with colored badges
- Visual distinction between sent (blue) and received (green) messages
- Hover preview showing message type, timestamps, size, priority
- Click to select message, inspect button to navigate to Message Inspector

### Message Step Details
- Sent and received timestamps displayed
- Processing duration calculation with slow processing indicator
- Message type and priority badges
- Body preview (truncated)
- Status indicator (pending, sent, received, processed, error)
- Error message display for failed messages

### State Transition Diagram
- SVG-based visual flow diagram
- States: Start → Started (Outbound/Inbound) → Conversing → Disconnected → Closed/Error
- Current state highlighted with primary color
- Potential next states shown with dashed outline
- State description displayed below diagram
- Legend for current, potential, and inactive states

### Export Options
- Download as JSON with formatted output
- Download as CSV for spreadsheet import
- Copy to clipboard with success feedback
- Options to include/exclude message bodies
- Options to include/exclude state transitions
- Estimated file size indicator

### Conversation Trace Service
| Method | Description |
|--------|-------------|
| loadConversations() | Paginated conversation loading with filters |
| loadStats() | Load conversation statistics (total, active, closed, error) |
| selectConversation() | Select conversation and load timeline |
| loadConversationTimeline() | Load full timeline with messages and transitions |
| setFilter() / resetFilter() | Apply/reset conversation filters |
| exportConversation() | Generate export blob in JSON/CSV format |
| downloadExport() | Trigger file download |
| copyToClipboard() | Copy timeline to clipboard |
| endConversation() | End active conversation |

### Models Created
- Conversation, ConversationMessage, ConversationTimeline interfaces
- StateTransition for conversation state changes
- ConversationFilter for filtering options
- ConversationStats for summary statistics
- ConversationTraceState for state management
- ExportOptions for export configuration
- ConversationState type with labels and colors

### SignalR Updates
- Added conversationUpdate$ observable for real-time conversation updates
- Added subscribeToConversation/unsubscribeFromConversation methods
- Added alertUpdate$ observable for alert notifications
- Added subscribeToAlerts/unsubscribeFromAlerts methods

---

## Phase 10: Diagnostics & Monitoring
**Status:** Complete

Implemented comprehensive Diagnostics & Monitoring feature for monitoring Service Broker health, performance, and system status.

### Diagnostics Components (features/diagnostics/)
| Component | Description |
|-----------|-------------|
| DiagnosticsComponent | Main container with tab navigation for all diagnostics sections |
| BrokerStatusPanelComponent | Overall health indicator, database list with broker status, configuration warnings |
| TransmissionQueueComponent | Table of transmission queue entries with stuck message filtering, force delivery, delete actions |
| DialogErrorsComponent | Dialog endpoint errors table with end conversation, delete, view details actions |
| PerformanceMetricsComponent | Message rate chart, queue depth trend, slowest queues, most active services, age distribution |
| AlertRulesComponent | CRUD operations for alert rules with configurable thresholds and actions |
| HealthCheckComponent | Health check buttons with results panel for various system diagnostics |

### Diagnostics Service
| Method | Description |
|--------|-------------|
| loadBrokerStatus() | Load Service Broker status for all databases |
| loadTransmissionQueue() | Load transmission queue entries with filtering |
| setTransmissionQueueFilter() | Apply filters to transmission queue view |
| forceDelivery() | Force delivery of stuck message |
| deleteTransmissionEntry() | Delete transmission queue entry |
| loadDialogErrors() | Load dialog endpoint errors |
| setDialogErrorFilter() | Apply filters to dialog errors view |
| endConversation() | End a conversation with errors |
| deleteDialogError() | Delete dialog error entry |
| loadPerformanceMetrics() | Load performance metrics for specified time range |
| setMetricsTimeRange() | Change metrics time range (1h, 6h, 24h, 7d) |
| loadAlertRules() | Load all configured alert rules |
| createAlertRule() | Create new alert rule |
| updateAlertRule() | Update existing alert rule |
| deleteAlertRule() | Delete alert rule |
| toggleAlertRule() | Enable/disable alert rule |
| runHealthCheck() | Run specific health check with optional parameters |
| clearHealthCheckResults() | Clear health check results |

### Models Created
| Model | Description |
|-------|-------------|
| BrokerStatusSummary, DatabaseBrokerStatus | Broker status and database info |
| ConfigurationWarning | Configuration warning with level and recommendation |
| TransmissionQueueEntry, TransmissionQueueFilter | Transmission queue data and filtering |
| DialogError, DialogErrorFilter | Dialog endpoint errors and filtering |
| PerformanceMetrics, MessageRateMetric, QueueDepthTrend | Performance metrics data |
| QueueProcessingTime, ServiceActivity | Processing time and activity stats |
| ConversationAgeDistribution | Conversation age bucketing |
| AlertRule, AlertRuleFormData, AlertActionConfig | Alert rule configuration |
| EmailConfig, WebhookConfig, SlackConfig | Alert action configurations |
| HealthCheckResult, HealthCheckDetail | Health check results |
| DiagnosticsState | State management for diagnostics feature |

### Features
- **Broker Status Panel**: Overall health indicator (Healthy/Warning/Critical), database list with broker enabled status, configuration warnings display
- **Transmission Queue View**: Filterable table with stuck message detection, force delivery and delete actions
- **Dialog Endpoint Errors**: Error table with conversation details, end conversation and delete actions
- **Performance Metrics Dashboard**: Canvas-based charts for message rate and queue depth, slowest queues table, most active services
- **Alert Rules Configuration**: Create/edit/delete alert rules with configurable thresholds, multiple action types (Email, Webhook, Slack)
- **Health Check Actions**: Six health check buttons for Service Broker diagnostics with results display

---

## Phase 11: User Roles & Settings
**Status:** Complete

Implemented comprehensive user mode system with Simple/Advanced modes, settings persistence, and mode-based navigation visibility.

### Core Services (core/services/)
| Service | Description |
|---------|-------------|
| UserModeService | User mode management with localStorage persistence, reactive mode$ observable, isSimpleMode()/isAdvancedMode() methods |

### Shared Directives (shared/directives/)
| Directive | Description |
|-----------|-------------|
| ShowInModeDirective | Structural directive (*appShowInMode) to conditionally show content based on user mode |

### Shared Components (shared/components/)
| Component | Description |
|-----------|-------------|
| NavigationComponent | Sidebar navigation with mode-based item visibility, collapsible sidebar, mode indicator |

### Settings Feature (features/settings/)
| Component | Description |
|-----------|-------------|
| SettingsComponent | Main settings container with mode switching, API key config, display settings, alert preferences |
| ModeSwitchComponent | Radio toggle for Simple/Advanced mode with feature descriptions |

| Service | Description |
|---------|-------------|
| SettingsService | Settings persistence with localStorage, user settings and alert preferences management |

### User Mode Features

**Simple Mode Restrictions:**
- Dashboard (full access)
- Queue Explorer (read-only, no technical details)
- Diagnostics (read-only, alerts only)
- Settings (full access)
- Hidden: Message Sender, Message Inspector, Poison Messages, Conversation Trace

**Advanced Mode Features:**
- All screens available
- Full control (send, receive, purge, pause)
- Access to raw message bodies
- Full diagnostics and conversation tracing
- Poison message handling

### Navigation Updates
- Mode-based menu item visibility
- Read-only badges for Simple mode restricted features
- Automatic redirect to Dashboard when switching modes if on restricted page
- Collapsible sidebar with smooth transitions
- Mode indicator badge in sidebar

### Settings Persistence
| Setting | Description |
|---------|-------------|
| API Key | Stored in localStorage, masked input with toggle visibility |
| Refresh Interval | Configurable auto-refresh (10s, 30s, 1m, 2m, 5m) |
| Default Page Size | Table pagination default (10, 25, 50, 100) |
| Theme | Light, Dark, or System default |
| Alerts Enabled | Master toggle for alert notifications |
| Poison Message Alerts | Alert on poison messages |
| Queue Depth Warnings | Configurable threshold alerts |
| System Health Critical | Alert on critical health status |
| Transmission Queue Stuck | Alert on stuck transmission |
| Sound Notifications | Browser sound alerts |
| Desktop Notifications | Browser notification API |
| Email Notifications | Email alert configuration |

### Models Created
| Model | Description |
|-------|-------------|
| UserMode | Type: 'simple' \| 'advanced' |
| NavItem | Navigation item with path, label, icon, modes[], badge, readOnly |
| UserSettings | User display preferences |
| AlertPreferences | Alert configuration settings |
| SettingsState | Combined settings state with dirty flag |

---

## Phase 12: External Integration & Client Libraries
**Status:** Complete

Implemented application registration system, enhanced API key authentication, and client libraries for .NET and npm.

### Backend: Application Registration System

| Component | Location | Description |
|-----------|----------|-------------|
| Application Model | Models/Application.cs | Application entity with API key, permissions, allowed queues |
| RegisterApplicationRequest | Models/Application.cs | Request model for creating applications |
| UpdateApplicationRequest | Models/Application.cs | Request model for updating applications |
| ApplicationResponse | Models/Application.cs | Response model with masked API key |
| RegisterApplicationResponse | Models/Application.cs | Response with full API key (shown once) |
| RegenerateKeyResponse | Models/Application.cs | Response for key regeneration |

### Repository Layer

| Component | Location | Description |
|-----------|----------|-------------|
| IApplicationRepository | Repositories/Interfaces/IApplicationRepository.cs | Interface for application data access |
| ApplicationRepository | Repositories/ApplicationRepository.cs | EF Core implementation for CRUD operations |

Methods: GetAllAsync, GetByIdAsync, GetByApiKeyAsync, GetByNameAsync, CreateAsync, UpdateAsync, DeleteAsync, UpdateLastUsedAsync, ApiKeyExistsAsync

### Service Layer

| Component | Location | Description |
|-----------|----------|-------------|
| IApplicationService | Services/Interfaces/IApplicationService.cs | Interface for application business logic |
| ApplicationService | Services/ApplicationService.cs | Implementation with API key generation, validation |

Methods: GetAllApplicationsAsync, GetApplicationByIdAsync, RegisterApplicationAsync, UpdateApplicationAsync, DeleteApplicationAsync, RegenerateApiKeyAsync, ValidateApiKeyAsync, UpdateLastUsedAsync

### Controller

| Route | Method | Description |
|-------|--------|-------------|
| api/applications | GET | List all applications (masked keys) |
| api/applications/{id} | GET | Get single application |
| api/applications | POST | Register new application (returns full key) |
| api/applications/{id} | PUT | Update application |
| api/applications/{id} | DELETE | Delete application |
| api/applications/{id}/regenerate-key | POST | Generate new API key |

### Middleware Enhancement

ApiKeyAuthMiddleware enhanced to:
- Query ApplicationRepository for database-backed API keys
- Fall back to config-based keys for backwards compatibility
- Check AllowedQueues for queue-specific permissions
- Update LastUsedAt timestamp on successful auth
- Extract queue name from path for permission validation

### Database

| File | Description |
|------|-------------|
| Database/Tables/Applications.sql | Creates dbo.Applications table with JSON columns for permissions/queues |
| Data/MessageBusDbContext.cs | Added Application entity as keyed entity |

### Frontend: Application Registration UI

| Component | Location | Description |
|-----------|----------|-------------|
| ApplicationService | features/settings/services/application.service.ts | Angular service for CRUD operations |
| ApplicationRegistrationComponent | features/settings/components/application-registration/ | Main application list with table |
| AddApplicationDialogComponent | features/settings/components/add-application-dialog/ | Dialog for registering new apps |
| EditPermissionsDialogComponent | features/settings/components/edit-permissions-dialog/ | Dialog for editing permissions |

Features:
- Application list table with status badges
- Add application with permissions selection
- Edit application dialog
- Delete with confirmation
- Regenerate API key with confirmation
- API key display (shown once, with copy button)
- Masked API key in list view

### .NET Client Library (MessageBus.Client)

| File | Description |
|------|-------------|
| MessageBus.Client.csproj | .NET Standard 2.0 class library with SignalR client |
| MessageBusClient.cs | Main client class with Configure, Publish, Subscribe, GetQueueStatus |
| Models/QueueStatus.cs | Queue status and message models |
| Models/MessageBusException.cs | Exception types (Auth, Authorization, NotFound) |
| README.md | Usage documentation with examples |

Client Methods:
- Configure(apiUrl, apiKey) - Configure client
- ConnectAsync() - Connect to SignalR hub
- DisconnectAsync() - Disconnect from hub
- PublishAsync<T>(queueName, message) - Send message
- SubscribeAsync<T>(queueName, handler) - Real-time message subscription
- GetQueueStatusAsync(queueName) - Get queue status
- GetQueuesAsync() - List all queues

### npm/TypeScript Client Library (messagebus-client)

| File | Description |
|------|-------------|
| package.json | Package configuration with @microsoft/signalr dependency |
| tsconfig.json | TypeScript configuration |
| src/MessageBusClient.ts | Main client class |
| src/models/QueueStatus.ts | TypeScript interfaces |
| src/types.ts | Error types and configuration interfaces |
| src/index.ts | Public exports |
| README.md | Usage documentation with examples |

Client Methods:
- configure(apiUrl, apiKey) - Configure client
- connect() - Connect to SignalR hub
- disconnect() - Disconnect from hub
- publish<T>(queueName, message) - Send message
- subscribe<T>(queueName, handler) - Real-time subscription
- getQueueStatus(queueName) - Get queue status
- getQueues() - List all queues

### API Documentation

| File | Description |
|------|-------------|
| API-DOCUMENTATION.md | Comprehensive REST API documentation with all endpoints, request/response examples, authentication details |

Documentation Sections:
- Authentication (API key header, permissions)
- Applications (CRUD endpoints)
- Queues (list, details, actions)
- Messages (send, bulk send, validation)
- Poison Messages (retry, purge, dead-letter)
- Conversations (list, trace, export)
- Services (metadata)
- Diagnostics (health, metrics, errors)
- Health (ping, full check)
- SignalR Hub (methods, events)
- Client Libraries (usage examples)

---

## Upcoming Phases

### Phase 7: Message Inspector & Sender
- View message details
- Send test messages
