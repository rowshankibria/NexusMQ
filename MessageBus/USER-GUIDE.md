# Service Broker Message Bus - User Guide

Welcome to the Service Broker Message Bus application. This guide covers how to use the web interface to monitor, manage, and troubleshoot your SQL Server Service Broker messaging infrastructure.

---

## Table of Contents

1. [Getting Started](#getting-started)
2. [Dashboard Overview](#dashboard-overview)
3. [Queue Explorer Usage](#queue-explorer-usage)
4. [Sending Messages](#sending-messages)
5. [Handling Poison Messages](#handling-poison-messages)
6. [Conversation Tracing](#conversation-tracing)
7. [Diagnostics](#diagnostics)
8. [Simple vs Advanced Mode](#simple-vs-advanced-mode)

---

## Getting Started

### Accessing the Application

1. Open your web browser and navigate to the application URL:
   - **Development:** http://localhost:4200
   - **Staging:** https://messagebus-staging.conedison.com
   - **Production:** https://messagebus.conedison.com

2. The Dashboard will load automatically as the default view.

### First-Time Setup

1. **Configure API Key (if required):**
   - Click the **Settings** icon in the sidebar
   - Enter your API key in the "API Key" field
   - Click "Save Settings"

2. **Choose Your Mode:**
   - **Simple Mode:** Read-only access, perfect for monitoring
   - **Advanced Mode:** Full access to all features including message sending

### Navigation

The sidebar provides access to all features:

| Icon | Feature | Description | Mode |
|------|---------|-------------|------|
| 📊 | Dashboard | System overview and health | Both |
| 📋 | Queue Explorer | Browse and manage queues | Both |
| ✉️ | Message Sender | Send test messages | Advanced |
| 🔍 | Message Inspector | View message details | Advanced |
| ☠️ | Poison Messages | Handle failed messages | Advanced |
| 🔄 | Conversation Trace | Track message flow | Advanced |
| 🔧 | Diagnostics | System health and metrics | Both |
| ⚙️ | Settings | Configure preferences | Both |

---

## Dashboard Overview

The Dashboard provides a real-time overview of your Service Broker infrastructure.

### System Health Summary

At the top of the dashboard, you'll see key metrics:

| Metric | Description |
|--------|-------------|
| **Total Services** | Number of Service Broker services configured |
| **Active Conversations** | Currently open conversation endpoints |
| **Total Queue Depth** | Sum of messages across all queues |
| **System Status** | Overall health (Healthy/Warning/Critical) |

### Queue Health Grid

The main section displays all queues as cards:

- **Green badge:** Queue is healthy and active
- **Yellow badge:** Queue has warnings (high depth, slow processing)
- **Red badge:** Queue is disabled or has poison messages

**Each card shows:**
- Queue name
- Current message count
- Oldest message age
- Messages per minute throughput

**Click a queue card** to navigate to the Queue Explorer for details.

### Throughput Chart

The line chart shows message processing rates over time:

- Toggle between **1h**, **6h**, and **24h** views
- Hover over points to see exact values
- Identify processing peaks and valleys

### Dead Letter Summary

Shows poison message and dead letter queue statistics:

- **Poison Count:** Messages that failed processing
- **Dead Letter Count:** Archived failed messages
- **Oldest Age:** Age of oldest problematic message
- **Recent Messages:** Quick list of recent issues

### Broker Status

Displays the Service Broker configuration:

- **Broker Enabled:** Green if Service Broker is active
- **Server Details:** SQL Server instance information
- **Warnings:** Any configuration issues detected

---

## Queue Explorer Usage

The Queue Explorer provides detailed queue management capabilities.

### Queue List (Left Panel)

**Searching:**
- Type in the search box to filter queues by name
- Search updates as you type

**Filtering:**
- Click filter dropdown to show:
  - All queues
  - Active (receiving messages)
  - Idle (no recent activity)
  - Disabled (not receiving)
  - Poison (has failed messages)

**Sorting:**
- Click column headers to sort by:
  - Name (alphabetical)
  - Message Count (highest first)
  - Oldest Age (oldest first)

### Queue Details (Right Panel)

**Configuration Section:**
- Service name associated with queue
- Queue name
- Maximum concurrent readers
- Activation procedure (if configured)

**Statistics Section:**
- Total messages in queue
- Messages by status (queued, processing, completed)
- Average message age
- Processing throughput

### Queue Actions

**Available in Advanced Mode:**

| Action | Description |
|--------|-------------|
| **Send Message** | Opens Message Sender for this queue |
| **Pause** | Stops message receiving (preserves messages) |
| **Resume** | Restarts message receiving |
| **Purge** | Deletes ALL messages (requires confirmation) |
| **Refresh** | Manually refresh queue data |

### Message Table

View messages currently in the queue:

**Columns:**
- Sequence number
- Message type
- Priority
- Status
- Size (bytes)
- Age
- Timestamp

**Actions:**
- Click a row to view message details
- Select multiple rows for bulk operations
- Export selected messages to JSON

**Pagination:**
- Choose 25, 50, or 100 rows per page
- Navigate with Previous/Next buttons

---

## Sending Messages

*Available in Advanced Mode only*

### Using the Message Sender

1. Navigate to **Message Sender** in the sidebar
2. Or click **Send Message** from a queue in Queue Explorer

### Message Form

| Field | Description | Required |
|-------|-------------|----------|
| **Target Service** | Destination service name | Yes |
| **Message Type** | Type of message being sent | Yes |
| **Message Body** | JSON content of the message | Yes |
| **Priority** | 1-10, higher = more urgent | No (default: 5) |

### Sending a Test Message

1. Select the target service from the dropdown
2. Select an appropriate message type
3. Enter your message body (must be valid JSON):
   ```json
   {
     "orderId": "ORD-12345",
     "action": "process",
     "timestamp": "2024-01-15T10:00:00Z"
   }
   ```
4. Click **Send Message**
5. A success notification will show the conversation handle

### Validating Before Send

- The form validates JSON syntax automatically
- Invalid JSON shows a red error indicator
- Target service and message type are validated against known values

### After Sending

- Navigate to **Conversation Trace** to track message flow
- Use the returned conversation handle to find your message

---

## Handling Poison Messages

*Available in Advanced Mode only*

Poison messages are messages that repeatedly fail processing. They require manual intervention.

### Viewing Poison Messages

1. Navigate to **Poison Messages** in the sidebar
2. The view shows two tabs:
   - **Poison Messages:** Messages that failed processing
   - **Dead Letter:** Archived messages that cannot be processed

### Understanding Poison Messages

| Column | Description |
|--------|-------------|
| **Queue** | Source queue where failure occurred |
| **Conversation** | Unique conversation identifier |
| **Message Type** | Type of message |
| **Error** | Why processing failed |
| **Retry Count** | Number of failed retry attempts |
| **Last Retry** | When last retry was attempted |

### Viewing Message Details

Click a row to open the detail panel:

- **Message Body:** Full content (formatted, raw, or hex view)
- **Error Trace:** Stack trace and error details
- **Retry History:** Timeline of retry attempts
- **Queue Status:** Current state of source queue

### Handling Options

#### Retry a Message

Use when the underlying issue has been fixed:

1. Click the **Retry** button on the message row
2. Or open details and click **Retry**
3. Confirm the action
4. The message returns to the queue for reprocessing

#### Purge (Move to Dead Letter)

Use when the message cannot be processed:

1. Click the **Purge** button on the message row
2. Enter resolution notes explaining why
3. Confirm the action
4. The message moves to the Dead Letter queue

### Bulk Operations

For handling multiple messages:

1. Check the boxes next to messages you want to process
2. Click **Bulk Retry** or **Bulk Purge**
3. Confirm the action
4. Progress shows as each message is processed

### Re-enabling a Queue

If a queue was disabled due to poison messages:

1. First retry or purge the poison messages
2. Click **Re-enable Queue** in the detail panel
3. The queue will resume processing

---

## Conversation Tracing

*Available in Advanced Mode only*

Track the complete lifecycle of Service Broker conversations.

### Viewing Conversations

1. Navigate to **Conversation Trace** in the sidebar
2. Use filters to narrow down results:
   - **State:** Active, Closed, Error, etc.
   - **Date Range:** When conversation started
   - **Service:** Filter by initiator or target service
   - **Search:** Find by conversation handle

### Conversation List

| Column | Description |
|--------|-------------|
| **Handle** | Unique conversation identifier |
| **Initiator** | Service that started the conversation |
| **Target** | Destination service |
| **State** | Current conversation state |
| **Created** | When conversation started |
| **Last Activity** | Most recent message |
| **Messages** | Total messages exchanged |

### Timeline View

Click a conversation to see its timeline:

**Message Steps:**
- **Sent** (blue): Messages sent from initiator
- **Received** (green): Messages received by target
- Each step shows:
  - Message type
  - Timestamps (sent and received)
  - Processing duration
  - Body preview

**State Transitions:**
- Visual badges showing state changes
- Error states highlighted in red

### State Diagram

The visual diagram shows conversation progression:

- **Current State:** Highlighted in blue
- **Previous States:** Shown in gray
- **Potential Next States:** Dashed outline
- Common states: Started → Conversing → Disconnected → Closed

### Exporting Conversations

Use the Export panel to download conversation data:

| Option | Description |
|--------|-------------|
| **JSON** | Full structured data |
| **CSV** | For spreadsheet analysis |
| **Include Bodies** | Toggle to include message content |
| **Include States** | Toggle to include state transitions |

Click **Download** or **Copy to Clipboard**.

---

## Diagnostics

Monitor system health and troubleshoot issues.

### Broker Status Panel

Shows overall Service Broker health:

- **Health Indicator:** Green (Healthy), Yellow (Warning), Red (Critical)
- **Database Status:** List of databases with broker enabled/disabled
- **Configuration Warnings:** Issues that need attention

### Transmission Queue

Messages waiting to be delivered:

| Column | Description |
|--------|-------------|
| **To Service** | Destination service |
| **Contract** | Message contract |
| **Status** | Why message is stuck |
| **Enqueue Time** | When message was queued |

**Actions:**
- **Force Delivery:** Attempt immediate delivery
- **Delete:** Remove stuck entry (use with caution)

### Dialog Errors

Conversation endpoint errors:

| Column | Description |
|--------|-------------|
| **Conversation** | Affected conversation handle |
| **Error** | Error description |
| **Service** | Service where error occurred |

**Actions:**
- **End Conversation:** Terminate the error conversation
- **Delete:** Remove error entry

### Performance Metrics

Charts and statistics:

- **Message Rate:** Messages processed over time
- **Queue Depth Trend:** How queue sizes change
- **Slowest Queues:** Queues with longest processing times
- **Most Active Services:** Services with highest throughput
- **Age Distribution:** Conversation age bucketing

Toggle time range: **1h**, **6h**, **24h**, **7d**

### Health Checks

Run diagnostic checks:

| Check | Description |
|-------|-------------|
| **Service Broker Status** | Verify broker is enabled |
| **Queue Health** | Check all queue configurations |
| **Conversation Health** | Find orphaned conversations |
| **Transmission Health** | Check for stuck messages |
| **Service Validation** | Verify service configurations |
| **Full Diagnostic** | Run all checks |

Click a button to run the check. Results appear in the panel below.

---

## Simple vs Advanced Mode

### Switching Modes

1. Navigate to **Settings** in the sidebar
2. Find the **User Mode** section
3. Select **Simple** or **Advanced**
4. Click **Save Settings**

### Simple Mode Features

| Feature | Access Level |
|---------|--------------|
| Dashboard | Full (read-only) |
| Queue Explorer | View queues, no actions |
| Diagnostics | View alerts only |
| Settings | Full access |

**Hidden in Simple Mode:**
- Message Sender
- Message Inspector
- Poison Messages
- Conversation Trace
- Queue actions (pause, purge)

### Advanced Mode Features

| Feature | Access Level |
|---------|--------------|
| All Features | Full access |
| Send Messages | Yes |
| Handle Poison Messages | Yes |
| Trace Conversations | Yes |
| Queue Actions | All (pause, resume, purge) |

### When to Use Each Mode

**Use Simple Mode when:**
- You only need to monitor the system
- You're not responsible for troubleshooting
- You want a simplified interface

**Use Advanced Mode when:**
- You need to send test messages
- You handle poison message resolution
- You need full diagnostic capabilities
- You troubleshoot message flow issues

---

## Keyboard Shortcuts

| Shortcut | Action |
|----------|--------|
| `?` | Show keyboard shortcuts |
| `d` | Go to Dashboard |
| `q` | Go to Queue Explorer |
| `r` | Refresh current view |
| `Esc` | Close dialogs/panels |

---

## Getting Help

### In-Application Help
- Hover over elements for tooltips
- Look for `?` icons for contextual help

### Documentation
- **DEVELOPMENT-SETUP.md:** Developer setup guide
- **RUNBOOKS.md:** Operational procedures
- **API-DOCUMENTATION.md:** API reference

### Support
- Report issues to the application support team
- Include conversation handles and timestamps when reporting issues
- Screenshots of error messages help diagnose problems

---

## Glossary

| Term | Definition |
|------|------------|
| **Conversation** | A dialog between two Service Broker services |
| **Conversation Handle** | Unique identifier for a conversation |
| **Dead Letter Queue** | Archive for unprocessable messages |
| **Message Type** | Schema defining message structure |
| **Poison Message** | Message that repeatedly fails processing |
| **Queue Depth** | Number of messages waiting in a queue |
| **Service Broker** | SQL Server messaging infrastructure |
| **Throughput** | Messages processed per time unit |
| **Transmission Queue** | System queue for outbound messages |
