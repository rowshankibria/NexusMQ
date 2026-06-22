/**
 * Represents the status of a message queue
 */
export interface QueueStatus {
  /** Name of the queue */
  queueName: string;
  /** Total number of messages in the queue */
  messageCount: number;
  /** Number of messages ready for processing */
  readyCount: number;
  /** Whether receive is enabled on the queue */
  isReceiveEnabled: boolean;
  /** Whether activation is enabled on the queue */
  isActivationEnabled: boolean;
  /** Age of the oldest message in seconds */
  oldestMessageAgeSeconds?: number;
  /** Number of active conversations */
  activeConversations: number;
  /** Number of conversations in error state */
  errorConversations: number;
  /** Overall health status (Healthy, Warning, Critical, Unknown) */
  status: string;
}

/**
 * Represents a message received from a queue
 */
export interface MessageReceived<T = unknown> {
  /** The queue the message was received from */
  queueName: string;
  /** The conversation handle for this message */
  conversationHandle?: string;
  /** The message type */
  messageType: string;
  /** The deserialized message body */
  body: T;
  /** When the message was received */
  receivedAt: Date;
}

/**
 * Result of sending a message
 */
export interface SendMessageResult {
  /** Whether the send was successful */
  success: boolean;
  /** The conversation handle for the sent message */
  conversationHandle?: string;
  /** Message describing the result */
  message: string;
  /** Error details if the send failed */
  error?: string;
}

/**
 * Request for sending a message
 */
export interface SendMessageRequest {
  /** The target queue name */
  queueName: string;
  /** The message type */
  messageType: string;
  /** The message body (will be serialized to JSON) */
  messageBody: string;
}
