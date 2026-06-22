import * as signalR from '@microsoft/signalr';
import {
  QueueStatus,
  MessageReceived,
  SendMessageResult,
  SendMessageRequest
} from './models';
import {
  MessageBusClientConfig,
  MessageHandler,
  Subscription,
  MessageBusError,
  MessageBusAuthenticationError,
  MessageBusAuthorizationError,
  MessageBusNotFoundError
} from './types';

/**
 * Client for interacting with the MessageBus API
 */
export class MessageBusClient {
  private apiUrl: string = '';
  private apiKey: string = '';
  private timeout: number = 30000;
  private hubConnection: signalR.HubConnection | null = null;
  private subscriptions: Map<string, Set<MessageHandler>> = new Map();

  /**
   * Gets whether the SignalR connection is established
   */
  get isConnected(): boolean {
    return this.hubConnection?.state === signalR.HubConnectionState.Connected;
  }

  /**
   * Configures the client with API URL and API key
   */
  configure(apiUrl: string, apiKey: string, timeout?: number): void;
  configure(config: MessageBusClientConfig): void;
  configure(
    apiUrlOrConfig: string | MessageBusClientConfig,
    apiKey?: string,
    timeout?: number
  ): void {
    if (typeof apiUrlOrConfig === 'string') {
      this.apiUrl = apiUrlOrConfig.replace(/\/+$/, '');
      this.apiKey = apiKey!;
      if (timeout) this.timeout = timeout;
    } else {
      this.apiUrl = apiUrlOrConfig.apiUrl.replace(/\/+$/, '');
      this.apiKey = apiUrlOrConfig.apiKey;
      if (apiUrlOrConfig.timeout) this.timeout = apiUrlOrConfig.timeout;
    }
  }

  /**
   * Connects to the SignalR hub for real-time updates
   */
  async connect(): Promise<void> {
    this.ensureConfigured();

    const hubUrl = this.apiUrl.replace('/api', '') + '/hubs/messagebus';

    this.hubConnection = new signalR.HubConnectionBuilder()
      .withUrl(hubUrl, {
        headers: {
          'X-API-Key': this.apiKey
        }
      })
      .withAutomaticReconnect()
      .build();

    // Set up message handler
    this.hubConnection.on('MessageReceived', (queueName: string, messageType: string, body: string) => {
      const handlers = this.subscriptions.get(queueName);
      if (handlers) {
        const message: MessageReceived = {
          queueName,
          messageType,
          body: JSON.parse(body),
          receivedAt: new Date()
        };
        handlers.forEach(handler => {
          try {
            handler(message);
          } catch (err) {
            console.error('Error in message handler:', err);
          }
        });
      }
    });

    await this.hubConnection.start();
  }

  /**
   * Disconnects from the SignalR hub
   */
  async disconnect(): Promise<void> {
    if (this.hubConnection) {
      await this.hubConnection.stop();
      this.hubConnection = null;
    }
    this.subscriptions.clear();
  }

  /**
   * Publishes a message to a queue
   */
  async publish<T>(
    queueName: string,
    message: T,
    messageType?: string
  ): Promise<SendMessageResult> {
    this.ensureConfigured();

    const request: SendMessageRequest = {
      queueName,
      messageType: messageType || this.getTypeName(message),
      messageBody: JSON.stringify(message)
    };

    const response = await this.fetch<SendMessageResult>('messages/send', {
      method: 'POST',
      body: JSON.stringify(request)
    });

    return response;
  }

  /**
   * Subscribes to messages from a queue
   */
  async subscribe<T = unknown>(
    queueName: string,
    handler: MessageHandler<MessageReceived<T>>
  ): Promise<Subscription> {
    if (!this.isConnected) {
      await this.connect();
    }

    // Subscribe on server
    await this.hubConnection!.invoke('SubscribeToQueue', queueName);

    // Register handler
    if (!this.subscriptions.has(queueName)) {
      this.subscriptions.set(queueName, new Set());
    }
    this.subscriptions.get(queueName)!.add(handler as MessageHandler);

    return {
      queueName,
      unsubscribe: async () => {
        const handlers = this.subscriptions.get(queueName);
        if (handlers) {
          handlers.delete(handler as MessageHandler);
          if (handlers.size === 0) {
            this.subscriptions.delete(queueName);
            if (this.isConnected) {
              await this.hubConnection!.invoke('UnsubscribeFromQueue', queueName);
            }
          }
        }
      }
    };
  }

  /**
   * Gets the status of a queue
   */
  async getQueueStatus(queueName: string): Promise<QueueStatus> {
    this.ensureConfigured();
    return this.fetch<QueueStatus>(`queues/${encodeURIComponent(queueName)}`);
  }

  /**
   * Gets a list of all queues
   */
  async getQueues(
    includeSystemQueues = false,
    includeEmptyQueues = true
  ): Promise<QueueStatus[]> {
    this.ensureConfigured();
    const params = new URLSearchParams({
      includeSystemQueues: String(includeSystemQueues),
      includeEmptyQueues: String(includeEmptyQueues)
    });
    return this.fetch<QueueStatus[]>(`queues?${params}`);
  }

  /**
   * Makes an HTTP request to the API
   */
  private async fetch<T>(
    endpoint: string,
    options: RequestInit = {}
  ): Promise<T> {
    const url = `${this.apiUrl}/${endpoint}`;

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), this.timeout);

    try {
      const response = await fetch(url, {
        ...options,
        headers: {
          'Content-Type': 'application/json',
          'X-API-Key': this.apiKey,
          ...options.headers
        },
        signal: controller.signal
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        const errorText = await response.text();
        throw this.createError(response.status, errorText);
      }

      const text = await response.text();
      return text ? JSON.parse(text) : ({} as T);
    } catch (err) {
      clearTimeout(timeoutId);

      if (err instanceof MessageBusError) {
        throw err;
      }

      if ((err as Error).name === 'AbortError') {
        throw new MessageBusError('Request timeout', 408);
      }

      throw new MessageBusError((err as Error).message);
    }
  }

  private ensureConfigured(): void {
    if (!this.apiUrl || !this.apiKey) {
      throw new Error('Client not configured. Call configure() first.');
    }
  }

  private createError(statusCode: number, message: string): MessageBusError {
    switch (statusCode) {
      case 401:
        return new MessageBusAuthenticationError(message);
      case 403:
        return new MessageBusAuthorizationError(message);
      case 404:
        return new MessageBusNotFoundError(message);
      default:
        return new MessageBusError(message, statusCode);
    }
  }

  private getTypeName(obj: unknown): string {
    if (obj === null || obj === undefined) {
      return 'Unknown';
    }
    if (typeof obj === 'object' && obj.constructor) {
      return obj.constructor.name;
    }
    return typeof obj;
  }
}
