# MessageBus API Documentation

## Overview

The MessageBus API provides a RESTful interface for managing SQL Server Service Broker queues, messages, and conversations. It includes real-time updates via SignalR and supports API key authentication.

**Base URL:** `http://localhost:5000/api`

**SignalR Hub:** `http://localhost:5000/hubs/messagebus`

---

## Authentication

All API endpoints (except `/api/health/ping` and Swagger) require authentication via API key.

### Header

```
X-API-Key: your-api-key-here
```

### Permissions

API keys can have the following permissions:

| Permission | Description |
|------------|-------------|
| `read` | GET requests (view data) |
| `write` | POST/PUT/PATCH requests (modify data) |
| `admin` | DELETE requests and dangerous operations (purge) |
| `*` | Full access (all permissions) |

### Error Responses

**401 Unauthorized**
```json
{
  "error": "Unauthorized",
  "message": "API key is required. Please provide X-API-Key header."
}
```

**403 Forbidden**
```json
{
  "error": "Forbidden",
  "message": "API key does not have permission for this operation."
}
```

---

## Applications

Manage registered applications and API keys.

### List Applications

```http
GET /api/applications
```

**Response:**
```json
[
  {
    "id": 1,
    "name": "Production App",
    "apiKeyMasked": "mb-****a1b2",
    "description": "Main production application",
    "isActive": true,
    "createdAt": "2024-01-15T10:30:00Z",
    "expiresAt": null,
    "permissions": ["read", "write"],
    "allowedQueues": ["*"],
    "contactEmail": "admin@example.com",
    "lastUsedAt": "2024-01-20T14:22:00Z"
  }
]
```

### Get Application

```http
GET /api/applications/{id}
```

### Register Application

```http
POST /api/applications
```

**Request:**
```json
{
  "name": "My Application",
  "description": "Application description",
  "contactEmail": "admin@example.com",
  "expiresAt": "2025-12-31T23:59:59Z",
  "permissions": ["read", "write"],
  "allowedQueues": ["*"]
}
```

**Response (201 Created):**
```json
{
  "id": 2,
  "name": "My Application",
  "apiKey": "mb-abc123def456...", // Full key shown only once!
  "description": "Application description",
  "isActive": true,
  "createdAt": "2024-01-20T10:00:00Z",
  "expiresAt": "2025-12-31T23:59:59Z",
  "permissions": ["read", "write"],
  "allowedQueues": ["*"],
  "contactEmail": "admin@example.com"
}
```

### Update Application

```http
PUT /api/applications/{id}
```

**Request:**
```json
{
  "name": "Updated Name",
  "isActive": true,
  "permissions": ["read", "write", "admin"]
}
```

### Delete Application

```http
DELETE /api/applications/{id}
```

### Regenerate API Key

```http
POST /api/applications/{id}/regenerate-key
```

**Response:**
```json
{
  "id": 1,
  "name": "My Application",
  "apiKey": "mb-newkey123..." // New key shown only once!
}
```

---

## Queues

Manage Service Broker queues.

### List Queues

```http
GET /api/queues?includeSystemQueues=false&includeEmptyQueues=true
```

**Query Parameters:**
- `includeSystemQueues` (boolean, default: false)
- `includeEmptyQueues` (boolean, default: true)

**Response:**
```json
[
  {
    "queueName": "OrderQueue",
    "schemaName": "dbo",
    "serviceName": "OrderService",
    "isActivationEnabled": true,
    "isReceiveEnabled": true,
    "maxReaders": 5,
    "messageCount": 42,
    "readyCount": 40,
    "receivedCount": 2,
    "oldestMessageAgeSeconds": 120,
    "oldestMessageAgeFormatted": "2 minutes",
    "activeConversations": 10,
    "errorConversations": 0,
    "status": "Active"
  }
]
```

### Get Queue Details

```http
GET /api/queues/{queueName}
```

### Get Queue Health

```http
GET /api/queues/{queueName}/health
```

**Response:**
```json
{
  "queueName": "OrderQueue",
  "status": "Healthy",
  "statusDescription": "Queue is operating normally",
  "messageCount": 42,
  "oldestMessageAgeSeconds": 120,
  "isReceiveEnabled": true,
  "isActivationEnabled": true,
  "errorConversations": 0,
  "issues": [],
  "checkedAt": "2024-01-20T14:30:00Z"
}
```

### Get Queue Messages

```http
GET /api/queues/{queueName}/messages?pageNumber=1&pageSize=25
```

**Query Parameters:**
- `pageNumber` (int, default: 1)
- `pageSize` (int, default: 25, max: 100)
- `statusFilter` (string, optional)
- `messageTypeFilter` (string, optional)

### Pause Queue

```http
POST /api/queues/{queueName}/pause
```

### Resume Queue

```http
POST /api/queues/{queueName}/resume
```

### Purge Queue

```http
DELETE /api/queues/{queueName}/purge?confirm=true
```

**Note:** Requires `admin` permission and `confirm=true` parameter.

---

## Messages

Send and manage messages.

### Send Message

```http
POST /api/messages/send
```

**Request:**
```json
{
  "queueName": "OrderQueue",
  "messageType": "OrderCreated",
  "messageBody": "{\"orderId\": 12345, \"total\": 99.99}"
}
```

**Response:**
```json
{
  "success": true,
  "conversationHandle": "A1B2C3D4-E5F6-...",
  "message": "Message sent successfully"
}
```

### Send Bulk Messages

```http
POST /api/messages/send-bulk
```

**Request:**
```json
{
  "queueName": "OrderQueue",
  "messages": [
    {
      "messageType": "OrderCreated",
      "messageBody": "{\"orderId\": 1}"
    },
    {
      "messageType": "OrderCreated",
      "messageBody": "{\"orderId\": 2}"
    }
  ]
}
```

### Get Message by Conversation

```http
GET /api/messages/{conversationHandle}
```

### Validate Message Type

```http
GET /api/messages/validate/message-type?messageType={type}
```

### Validate Service

```http
GET /api/messages/validate/service?serviceName={name}
```

---

## Poison Messages

Manage poison and dead-letter messages.

### List Poison Messages

```http
GET /api/poison-messages
```

### List Dead-Letter Messages

```http
GET /api/poison-messages/dead-letter
```

### Get Poison Message Statistics

```http
GET /api/poison-messages/stats
```

**Response:**
```json
{
  "totalPoisonMessages": 5,
  "totalDeadLetterMessages": 12,
  "oldestPoisonMessageAge": "2 hours",
  "byQueue": {
    "OrderQueue": 3,
    "NotificationQueue": 2
  }
}
```

### Retry Poison Message

```http
POST /api/poison-messages/{id}/retry
```

### Purge to Dead-Letter

```http
POST /api/poison-messages/{id}/purge
```

### Bulk Retry

```http
POST /api/poison-messages/bulk-retry
```

**Request:**
```json
{
  "messageIds": [1, 2, 3]
}
```

### Bulk Purge

```http
POST /api/poison-messages/bulk-purge
```

### Resolve Dead-Letter Message

```http
POST /api/poison-messages/dead-letter/{id}/resolve
```

**Request:**
```json
{
  "resolutionNotes": "Manually processed and resolved"
}
```

---

## Conversations

View and manage Service Broker conversations.

### List Conversations

```http
GET /api/conversations?queueName={queue}&state={state}
```

### Get Conversation Statistics

```http
GET /api/conversations/stats
```

**Response:**
```json
{
  "totalConversations": 150,
  "activeConversations": 120,
  "errorConversations": 5,
  "closedConversations": 25,
  "byState": {
    "CO": 120,
    "ER": 5,
    "CD": 25
  }
}
```

---

## Services

View Service Broker services and contracts.

### List Services

```http
GET /api/services
```

### Get Service Details

```http
GET /api/services/{serviceName}
```

### Get Service Contracts

```http
GET /api/services/{serviceName}/contracts
```

### List Message Types

```http
GET /api/services/message-types
```

### Get Service Summary

```http
GET /api/services/summary
```

---

## Diagnostics

System diagnostics and monitoring.

### Get System Status

```http
GET /api/diagnostics/status
```

### Get Broker Health

```http
GET /api/diagnostics/broker
```

**Response:**
```json
{
  "isEnabled": true,
  "honorBrokerPriority": true,
  "serviceVersion": "SQL Server 2019",
  "activationStatus": "Active",
  "transmissionQueueCount": 0,
  "dialogErrorCount": 2
}
```

### Get Transmission Queue

```http
GET /api/diagnostics/transmission-queue
```

### Get Dialog Errors

```http
GET /api/diagnostics/dialog-errors?queueName={queue}&startDate={date}&endDate={date}
```

### Get Performance Metrics

```http
GET /api/diagnostics/metrics
```

### Run Health Check

```http
POST /api/diagnostics/health-check
```

### Check Orphaned Conversations

```http
GET /api/diagnostics/orphaned-conversations
```

### Validate All Services

```http
GET /api/diagnostics/validate-services
```

### Get Diagnostic Summary

```http
GET /api/diagnostics/summary
```

---

## Health

Simple health check endpoints.

### Ping (No Auth Required)

```http
GET /api/health/ping
```

**Response:**
```json
{
  "status": "ok",
  "timestamp": "2024-01-20T14:30:00Z"
}
```

### Full Health Check

```http
GET /api/health
```

**Response:**
```json
{
  "status": "Healthy",
  "checks": {
    "database": "Healthy",
    "serviceBroker": "Healthy",
    "signalR": "Healthy"
  },
  "duration": "45ms"
}
```

---

## SignalR Hub

Real-time updates via SignalR.

**Hub URL:** `/hubs/messagebus`

### Client Methods (Invoke)

| Method | Parameters | Description |
|--------|------------|-------------|
| `SubscribeToQueue` | `queueName: string` | Subscribe to queue updates |
| `UnsubscribeFromQueue` | `queueName: string` | Unsubscribe from queue |

### Server Events (On)

| Event | Parameters | Description |
|-------|------------|-------------|
| `QueueUpdated` | `queueName, messageCount, status` | Queue status changed |
| `MessageReceived` | `queueName, messageType, body` | New message in queue |
| `DashboardUpdated` | `stats` | Dashboard metrics updated |
| `AlertTriggered` | `alertType, message, severity` | Alert triggered |

### Connection Example

```javascript
const connection = new signalR.HubConnectionBuilder()
  .withUrl('/hubs/messagebus', {
    headers: { 'X-API-Key': 'your-key' }
  })
  .withAutomaticReconnect()
  .build();

connection.on('QueueUpdated', (queueName, count, status) => {
  console.log(`${queueName}: ${count} messages (${status})`);
});

await connection.start();
await connection.invoke('SubscribeToQueue', 'OrderQueue');
```

---

## Error Responses

All error responses follow this format:

```json
{
  "error": "Error Type",
  "message": "Detailed error message"
}
```

### HTTP Status Codes

| Code | Description |
|------|-------------|
| 200 | Success |
| 201 | Created |
| 400 | Bad Request (invalid parameters) |
| 401 | Unauthorized (missing/invalid API key) |
| 403 | Forbidden (insufficient permissions) |
| 404 | Not Found |
| 500 | Internal Server Error |

---

## Rate Limiting

Currently no rate limiting is implemented. For production, consider implementing rate limiting based on your requirements.

---

## Swagger Documentation

Interactive API documentation is available at:

```
http://localhost:5000/swagger
```

---

## Client Libraries

### .NET Client

```csharp
using MessageBus.Client;

var client = new MessageBusClient();
client.Configure("http://localhost:5000/api", "your-api-key");

// Publish message
await client.PublishAsync("OrderQueue", new { orderId = 123 });

// Subscribe to messages
await client.ConnectAsync();
var subscription = await client.SubscribeAsync<Order>("OrderQueue", msg => {
    Console.WriteLine($"Received: {msg.Body.OrderId}");
});
```

### TypeScript Client

```typescript
import { MessageBusClient } from '@conedison/messagebus-client';

const client = new MessageBusClient();
client.configure('http://localhost:5000/api', 'your-api-key');

// Publish message
await client.publish('OrderQueue', { orderId: 123 });

// Subscribe to messages
await client.connect();
const subscription = await client.subscribe('OrderQueue', msg => {
    console.log(`Received: ${msg.body.orderId}`);
});
```

---

## Support

For issues and questions, contact the Con Edison Development Team.
