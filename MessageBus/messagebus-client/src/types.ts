/**
 * Configuration options for MessageBusClient
 */
export interface MessageBusClientConfig {
  /** Base URL of the MessageBus API */
  apiUrl: string;
  /** API key for authentication */
  apiKey: string;
  /** Optional timeout in milliseconds (default: 30000) */
  timeout?: number;
}

/**
 * Handler function for received messages
 */
export type MessageHandler<T = unknown> = (message: T) => void | Promise<void>;

/**
 * Subscription object returned when subscribing to a queue
 */
export interface Subscription {
  /** Queue name this subscription is for */
  queueName: string;
  /** Unsubscribe from the queue */
  unsubscribe: () => Promise<void>;
}

/**
 * Error thrown by MessageBus client operations
 */
export class MessageBusError extends Error {
  /** HTTP status code if applicable */
  statusCode?: number;
  /** Error code from the API */
  errorCode?: string;

  constructor(message: string, statusCode?: number, errorCode?: string) {
    super(message);
    this.name = 'MessageBusError';
    this.statusCode = statusCode;
    this.errorCode = errorCode;
  }
}

/**
 * Error thrown when authentication fails
 */
export class MessageBusAuthenticationError extends MessageBusError {
  constructor(message: string) {
    super(message, 401);
    this.name = 'MessageBusAuthenticationError';
  }
}

/**
 * Error thrown when authorization fails
 */
export class MessageBusAuthorizationError extends MessageBusError {
  constructor(message: string) {
    super(message, 403);
    this.name = 'MessageBusAuthorizationError';
  }
}

/**
 * Error thrown when a resource is not found
 */
export class MessageBusNotFoundError extends MessageBusError {
  constructor(message: string) {
    super(message, 404);
    this.name = 'MessageBusNotFoundError';
  }
}
