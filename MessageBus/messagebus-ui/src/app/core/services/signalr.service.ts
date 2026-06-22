import { Injectable } from '@angular/core';
import * as signalR from '@microsoft/signalr';
import { BehaviorSubject, Subject } from 'rxjs';
import { environment } from '../../../environments/environment';

@Injectable({
  providedIn: 'root'
})
export class SignalRService {
  private hubConnection!: signalR.HubConnection;

  private connectionStatus = new BehaviorSubject<boolean>(false);
  connectionStatus$ = this.connectionStatus.asObservable();

  private queueUpdate = new Subject<any>();
  queueUpdate$ = this.queueUpdate.asObservable();

  private dashboardUpdate = new Subject<any>();
  dashboardUpdate$ = this.dashboardUpdate.asObservable();

  private conversationUpdate = new Subject<any>();
  conversationUpdate$ = this.conversationUpdate.asObservable();

  private alertUpdate = new Subject<any>();
  alertUpdate$ = this.alertUpdate.asObservable();

  constructor() {}

  async startConnection(): Promise<void> {
    this.hubConnection = new signalR.HubConnectionBuilder()
      .withUrl(`${environment.apiUrl}/hubs/messagebus`)
      .withAutomaticReconnect()
      .build();

    this.registerHandlers();

    try {
      await this.hubConnection.start();
      console.log('SignalR Connected');
      this.connectionStatus.next(true);
    } catch (err) {
      console.error('SignalR Connection Error: ', err);
      this.connectionStatus.next(false);
    }
  }

  private registerHandlers(): void {
    this.hubConnection.on('QueueUpdated', (data) => {
      this.queueUpdate.next(data);
    });

    this.hubConnection.on('DashboardUpdated', (data) => {
      this.dashboardUpdate.next(data);
    });

    this.hubConnection.on('ConversationUpdated', (data) => {
      this.conversationUpdate.next(data);
    });

    this.hubConnection.on('AlertTriggered', (data) => {
      this.alertUpdate.next(data);
    });

    this.hubConnection.onreconnecting(() => {
      this.connectionStatus.next(false);
    });

    this.hubConnection.onreconnected(() => {
      this.connectionStatus.next(true);
    });
  }

  async subscribeToQueue(queueName: string): Promise<void> {
    if (this.hubConnection.state === signalR.HubConnectionState.Connected) {
      await this.hubConnection.invoke('SubscribeToQueue', queueName);
    }
  }

  async unsubscribeFromQueue(queueName: string): Promise<void> {
    if (this.hubConnection.state === signalR.HubConnectionState.Connected) {
      await this.hubConnection.invoke('UnsubscribeFromQueue', queueName);
    }
  }

  async subscribeToDashboard(): Promise<void> {
    if (this.hubConnection.state === signalR.HubConnectionState.Connected) {
      await this.hubConnection.invoke('SubscribeToDashboard');
    }
  }

  async unsubscribeFromDashboard(): Promise<void> {
    if (this.hubConnection.state === signalR.HubConnectionState.Connected) {
      await this.hubConnection.invoke('UnsubscribeFromDashboard');
    }
  }

  async subscribeToConversation(conversationHandle: string): Promise<void> {
    if (this.hubConnection.state === signalR.HubConnectionState.Connected) {
      await this.hubConnection.invoke('SubscribeToConversation', conversationHandle);
    }
  }

  async unsubscribeFromConversation(conversationHandle: string): Promise<void> {
    if (this.hubConnection.state === signalR.HubConnectionState.Connected) {
      await this.hubConnection.invoke('UnsubscribeFromConversation', conversationHandle);
    }
  }

  async subscribeToAlerts(): Promise<void> {
    if (this.hubConnection.state === signalR.HubConnectionState.Connected) {
      await this.hubConnection.invoke('SubscribeToAlerts');
    }
  }

  async unsubscribeFromAlerts(): Promise<void> {
    if (this.hubConnection.state === signalR.HubConnectionState.Connected) {
      await this.hubConnection.invoke('UnsubscribeFromAlerts');
    }
  }

  async stopConnection(): Promise<void> {
    if (this.hubConnection) {
      await this.hubConnection.stop();
      this.connectionStatus.next(false);
    }
  }
}
