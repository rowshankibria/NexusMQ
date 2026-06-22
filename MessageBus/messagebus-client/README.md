# @conedison/messagebus-client

A TypeScript client library for interacting with the MessageBus API. Provides publish/subscribe capabilities with SignalR real-time support.

## Installation

```bash
npm install @conedison/messagebus-client
```

## Quick Start

### Configuration

```typescript
import { MessageBusClient } from '@conedison/messagebus-client';

const client = new MessageBusClient();
client.configure('http://localhost:5000/api', 'your-api-key');

// Or with config object
client.configure({
  apiUrl: 'http://localhost:5000/api',
  apiKey: 'your-api-key',
  timeout: 30000  // optional, default 30s
});
```

### Publishing Messages

```typescript
// Define your message type
interface OrderCreated {
  orderId: number;
  customerId: string;
  total: number;
}

// Publish a message
const message: OrderCreated = {
  orderId: 12345,
  customerId: 'CUST001',
  total: 99.99
};

const result = await client.publish<OrderCreated>('OrderQueue', message);

if (result.success) {
  console.log(`Message sent. Conversation: ${result.conversationHandle}`);
}
```

### Subscribing to Messages

```typescript
import { MessageReceived } from '@conedison/messagebus-client';

// Connect to SignalR for real-time updates
await client.connect();

// Subscribe to a queue
const subscription = await client.subscribe<OrderCreated>('OrderQueue',
  (msg: MessageReceived<OrderCreated>) => {
    console.log(`Received order: ${msg.body.orderId}`);
    // Process the message...
  }
);

// Later, when done:
await subscription.unsubscribe();
```

### Getting Queue Status

```typescript
// Get status of a specific queue
const status = await client.getQueueStatus('OrderQueue');
console.log(`Queue: ${status.queueName}`);
console.log(`Messages: ${status.messageCount}`);
console.log(`Status: ${status.status}`);

// Get all queues
const queues = await client.getQueues();
for (const queue of queues) {
  console.log(`${queue.queueName}: ${queue.messageCount} messages`);
}
```

## Error Handling

The client throws specific error types for different scenarios:

```typescript
import {
  MessageBusError,
  MessageBusAuthenticationError,
  MessageBusAuthorizationError,
  MessageBusNotFoundError
} from '@conedison/messagebus-client';

try {
  await client.publish('MyQueue', message);
} catch (err) {
  if (err instanceof MessageBusAuthenticationError) {
    // Invalid or missing API key (401)
    console.error('Authentication failed:', err.message);
  } else if (err instanceof MessageBusAuthorizationError) {
    // Permission denied (403)
    console.error('Not authorized:', err.message);
  } else if (err instanceof MessageBusNotFoundError) {
    // Resource not found (404)
    console.error('Not found:', err.message);
  } else if (err instanceof MessageBusError) {
    // Other API errors
    console.error(`Error (${err.statusCode}):`, err.message);
  }
}
```

## API Reference

### MessageBusClient

#### Methods

| Method | Description |
|--------|-------------|
| `configure(apiUrl, apiKey, timeout?)` | Configure the client |
| `connect()` | Connect to SignalR hub |
| `disconnect()` | Disconnect from SignalR hub |
| `publish<T>(queueName, message, messageType?)` | Publish a message |
| `subscribe<T>(queueName, handler)` | Subscribe to queue messages |
| `getQueueStatus(queueName)` | Get queue status |
| `getQueues(includeSystem?, includeEmpty?)` | List all queues |

#### Properties

| Property | Type | Description |
|----------|------|-------------|
| `isConnected` | `boolean` | Whether SignalR is connected |

### Types

```typescript
interface QueueStatus {
  queueName: string;
  messageCount: number;
  readyCount: number;
  isReceiveEnabled: boolean;
  isActivationEnabled: boolean;
  oldestMessageAgeSeconds?: number;
  activeConversations: number;
  errorConversations: number;
  status: string;
}

interface MessageReceived<T = unknown> {
  queueName: string;
  conversationHandle?: string;
  messageType: string;
  body: T;
  receivedAt: Date;
}

interface SendMessageResult {
  success: boolean;
  conversationHandle?: string;
  message: string;
  error?: string;
}

interface Subscription {
  queueName: string;
  unsubscribe: () => Promise<void>;
}
```

## Browser vs Node.js

This library works in both browser and Node.js environments. For Node.js, you may need to polyfill `fetch` if using Node.js < 18:

```bash
npm install node-fetch
```

```typescript
import fetch from 'node-fetch';
(globalThis as any).fetch = fetch;
```

## Requirements

- Node.js >= 16.0.0 or modern browser
- MessageBus API server with API key authentication enabled

## License

Copyright Con Edison. All rights reserved.
