# MessageBus.Client

A .NET client library for interacting with the MessageBus API. Provides publish/subscribe capabilities with SignalR real-time support.

## Installation

```bash
dotnet add package ConEdison.MessageBus.Client
```

## Quick Start

### Configuration

```csharp
using MessageBus.Client;

var client = new MessageBusClient();
client.Configure("http://localhost:5000/api", "your-api-key");
```

### Publishing Messages

```csharp
// Define your message type
public class OrderCreated
{
    public int OrderId { get; set; }
    public string CustomerId { get; set; }
    public decimal Total { get; set; }
}

// Publish a message
var message = new OrderCreated
{
    OrderId = 12345,
    CustomerId = "CUST001",
    Total = 99.99m
};

var result = await client.PublishAsync("OrderQueue", message);

if (result.Success)
{
    Console.WriteLine($"Message sent. Conversation: {result.ConversationHandle}");
}
```

### Subscribing to Messages

```csharp
// Connect to SignalR for real-time updates
await client.ConnectAsync();

// Subscribe to a queue
var subscription = await client.SubscribeAsync<OrderCreated>("OrderQueue", async msg =>
{
    Console.WriteLine($"Received order: {msg.Body?.OrderId}");
    // Process the message...
});

// Later, when done:
subscription.Dispose();
```

### Getting Queue Status

```csharp
// Get status of a specific queue
var status = await client.GetQueueStatusAsync("OrderQueue");
Console.WriteLine($"Queue: {status.QueueName}");
Console.WriteLine($"Messages: {status.MessageCount}");
Console.WriteLine($"Status: {status.Status}");

// Get all queues
var queues = await client.GetQueuesAsync();
foreach (var queue in queues)
{
    Console.WriteLine($"{queue.QueueName}: {queue.MessageCount} messages");
}
```

## Error Handling

The client throws specific exception types for different error scenarios:

```csharp
try
{
    await client.PublishAsync("MyQueue", message);
}
catch (MessageBusAuthenticationException ex)
{
    // Invalid or missing API key (401)
    Console.WriteLine("Authentication failed: " + ex.Message);
}
catch (MessageBusAuthorizationException ex)
{
    // Permission denied (403)
    Console.WriteLine("Not authorized: " + ex.Message);
}
catch (MessageBusNotFoundException ex)
{
    // Resource not found (404)
    Console.WriteLine("Not found: " + ex.Message);
}
catch (MessageBusException ex)
{
    // Other API errors
    Console.WriteLine($"Error ({ex.StatusCode}): {ex.Message}");
}
```

## Cleanup

Always dispose the client when done:

```csharp
// Using statement
using var client = new MessageBusClient();
client.Configure("http://localhost:5000/api", "your-api-key");
// ... use client ...

// Or manual disposal
client.Dispose();
```

## Advanced Usage

### Custom Message Types

```csharp
// Specify a custom message type name
await client.PublishAsync("MyQueue", data, messageType: "CustomTypeName");
```

### Connection Management

```csharp
// Check connection status
if (!client.IsConnected)
{
    await client.ConnectAsync();
}

// Disconnect when done with subscriptions
await client.DisconnectAsync();
```

### Cancellation Support

All async methods support cancellation tokens:

```csharp
var cts = new CancellationTokenSource(TimeSpan.FromSeconds(30));
await client.PublishAsync("MyQueue", message, cancellationToken: cts.Token);
```

## Requirements

- .NET Standard 2.0 compatible framework
- MessageBus API server running with API key authentication enabled

## License

Copyright Con Edison. All rights reserved.
