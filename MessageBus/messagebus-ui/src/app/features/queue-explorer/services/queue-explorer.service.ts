import { Injectable, OnDestroy } from '@angular/core';
import { BehaviorSubject, Observable, Subject, of } from 'rxjs';
import { catchError, map, switchMap, takeUntil, tap } from 'rxjs/operators';
import { ApiService } from '../../../core/services/api.service';
import { SignalRService } from '../../../core/services/signalr.service';
import {
  Queue,
  QueueStatistics,
  QueueMessage,
  QueueExplorerState,
  QueueFilter,
  MessageFilter,
  MessagePageResponse,
  BulkActionResult,
  PurgeQueueResult,
  initialQueueExplorerState,
  initialQueueFilter,
  initialMessageFilter,
  QueueStatus,
  SortDirection
} from '../models';

@Injectable({
  providedIn: 'root'
})
export class QueueExplorerService implements OnDestroy {
  private destroy$ = new Subject<void>();
  private state = new BehaviorSubject<QueueExplorerState>(initialQueueExplorerState);

  state$ = this.state.asObservable();

  constructor(
    private api: ApiService,
    private signalR: SignalRService
  ) {
    this.initializeSignalRSubscription();
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  private initializeSignalRSubscription(): void {
    this.signalR.queueUpdate$
      .pipe(takeUntil(this.destroy$))
      .subscribe(update => {
        if (update) {
          this.handleQueueUpdate(update);
        }
      });
  }

  private handleQueueUpdate(update: Partial<Queue>): void {
    const currentState = this.state.value;
    const updatedQueues = currentState.queues.map(q =>
      q.queueName === update.queueName ? { ...q, ...update } : q
    );

    this.updateState({
      queues: updatedQueues,
      filteredQueues: this.applyFilter(updatedQueues, currentState.filter)
    });

    if (currentState.selectedQueue?.queueName === update.queueName) {
      this.updateState({
        selectedQueue: { ...currentState.selectedQueue, ...update }
      });
    }
  }

  private updateState(partialState: Partial<QueueExplorerState>): void {
    this.state.next({
      ...this.state.value,
      ...partialState
    });
  }

  loadQueues(): Observable<Queue[]> {
    this.updateState({ loading: true, error: null });

    return this.api.get<Queue[]>('queues').pipe(
      map(queues => queues.map(q => ({
        ...q,
        displayName: this.formatQueueName(q.queueName),
        status: this.determineQueueStatus(q)
      }))),
      tap(queues => {
        const currentFilter = this.state.value.filter;
        this.updateState({
          queues,
          filteredQueues: this.applyFilter(queues, currentFilter),
          loading: false,
          lastUpdated: new Date()
        });
      }),
      catchError(error => {
        this.updateState({
          loading: false,
          error: error.message || 'Failed to load queues'
        });
        return of([]);
      })
    );
  }

  private formatQueueName(queueName: string): string {
    return queueName
      .replace(/Queue$/i, '')
      .replace(/([A-Z])/g, ' $1')
      .trim();
  }

  private determineQueueStatus(queue: Queue): QueueStatus {
    if (!queue.isReceiveEnabled) return 'disabled';
    if (queue.poisonMessageCount > 0) return 'poison';
    if (queue.messageCount > 0) return 'active';
    return 'idle';
  }

  selectQueue(queue: Queue): void {
    this.updateState({
      selectedQueue: queue,
      selectedQueueStats: null,
      messages: [],
      totalMessages: 0,
      currentPage: 0,
      selectedMessages: [],
      messageFilter: initialMessageFilter
    });

    this.signalR.subscribeToQueue(queue.queueName);
    this.loadQueueStatistics(queue.queueName).subscribe();
    this.loadMessages(queue.queueName).subscribe();
  }

  deselectQueue(): void {
    const currentQueue = this.state.value.selectedQueue;
    if (currentQueue) {
      this.signalR.unsubscribeFromQueue(currentQueue.queueName);
    }

    this.updateState({
      selectedQueue: null,
      selectedQueueStats: null,
      messages: [],
      totalMessages: 0,
      currentPage: 0,
      selectedMessages: [],
      messageFilter: initialMessageFilter
    });
  }

  loadQueueStatistics(queueName: string): Observable<QueueStatistics> {
    return this.api.get<QueueStatistics>(`queues/${encodeURIComponent(queueName)}/stats`).pipe(
      tap(stats => {
        this.updateState({ selectedQueueStats: stats });
      }),
      catchError(error => {
        console.error('Failed to load queue statistics:', error);
        return of({} as QueueStatistics);
      })
    );
  }

  loadMessages(queueName: string, page: number = 0): Observable<MessagePageResponse> {
    const { pageSize, messageFilter } = this.state.value;
    this.updateState({ messagesLoading: true });

    let endpoint = `queues/${encodeURIComponent(queueName)}/messages?page=${page}&pageSize=${pageSize}`;

    if (messageFilter.messageType) {
      endpoint += `&messageType=${encodeURIComponent(messageFilter.messageType)}`;
    }
    if (messageFilter.status && messageFilter.status !== 'all') {
      endpoint += `&status=${messageFilter.status}`;
    }

    return this.api.get<MessagePageResponse>(endpoint).pipe(
      tap(response => {
        this.updateState({
          messages: response.messages,
          totalMessages: response.totalCount,
          currentPage: response.page,
          messagesLoading: false
        });
      }),
      catchError(error => {
        this.updateState({
          messagesLoading: false,
          error: error.message || 'Failed to load messages'
        });
        return of({
          messages: [],
          totalCount: 0,
          page: 0,
          pageSize: pageSize,
          totalPages: 0
        });
      })
    );
  }

  setFilter(filter: Partial<QueueFilter>): void {
    const newFilter = { ...this.state.value.filter, ...filter };
    const filteredQueues = this.applyFilter(this.state.value.queues, newFilter);

    this.updateState({
      filter: newFilter,
      filteredQueues
    });
  }

  resetFilter(): void {
    const filteredQueues = this.applyFilter(this.state.value.queues, initialQueueFilter);
    this.updateState({
      filter: initialQueueFilter,
      filteredQueues
    });
  }

  private applyFilter(queues: Queue[], filter: QueueFilter): Queue[] {
    let result = [...queues];

    if (filter.searchTerm) {
      const searchLower = filter.searchTerm.toLowerCase();
      result = result.filter(q =>
        q.queueName.toLowerCase().includes(searchLower) ||
        q.displayName.toLowerCase().includes(searchLower) ||
        q.serviceName?.toLowerCase().includes(searchLower)
      );
    }

    if (filter.status !== 'all') {
      result = result.filter(q => q.status === filter.status);
    }

    result.sort((a, b) => {
      let comparison = 0;

      switch (filter.sortField) {
        case 'name':
          comparison = a.queueName.localeCompare(b.queueName);
          break;
        case 'messageCount':
          comparison = a.messageCount - b.messageCount;
          break;
        case 'age':
          const ageA = a.oldestMessageAge ?? -1;
          const ageB = b.oldestMessageAge ?? -1;
          comparison = ageA - ageB;
          break;
      }

      return filter.sortDirection === 'asc' ? comparison : -comparison;
    });

    return result;
  }

  setMessageFilter(filter: Partial<MessageFilter>): void {
    const newFilter = { ...this.state.value.messageFilter, ...filter };
    this.updateState({ messageFilter: newFilter });

    const selectedQueue = this.state.value.selectedQueue;
    if (selectedQueue) {
      this.loadMessages(selectedQueue.queueName, 0).subscribe();
    }
  }

  setPage(page: number): void {
    const selectedQueue = this.state.value.selectedQueue;
    if (selectedQueue) {
      this.loadMessages(selectedQueue.queueName, page).subscribe();
    }
  }

  setPageSize(pageSize: number): void {
    this.updateState({ pageSize, currentPage: 0 });

    const selectedQueue = this.state.value.selectedQueue;
    if (selectedQueue) {
      this.loadMessages(selectedQueue.queueName, 0).subscribe();
    }
  }

  toggleMessageSelection(message: QueueMessage): void {
    const selectedMessages = [...this.state.value.selectedMessages];
    const index = selectedMessages.findIndex(m =>
      m.conversationHandle === message.conversationHandle &&
      m.sequenceNumber === message.sequenceNumber
    );

    if (index >= 0) {
      selectedMessages.splice(index, 1);
    } else {
      selectedMessages.push(message);
    }

    this.updateState({ selectedMessages });
  }

  selectAllMessages(): void {
    this.updateState({ selectedMessages: [...this.state.value.messages] });
  }

  deselectAllMessages(): void {
    this.updateState({ selectedMessages: [] });
  }

  isMessageSelected(message: QueueMessage): boolean {
    return this.state.value.selectedMessages.some(m =>
      m.conversationHandle === message.conversationHandle &&
      m.sequenceNumber === message.sequenceNumber
    );
  }

  pauseQueue(queueName: string): Observable<boolean> {
    return this.api.post<{ success: boolean }>(`queues/${encodeURIComponent(queueName)}/pause`, {}).pipe(
      map(response => response.success),
      tap(success => {
        if (success) {
          this.updateQueueInState(queueName, { isReceiveEnabled: false, status: 'disabled' });
        }
      }),
      catchError(error => {
        this.updateState({ error: error.message || 'Failed to pause queue' });
        return of(false);
      })
    );
  }

  resumeQueue(queueName: string): Observable<boolean> {
    return this.api.post<{ success: boolean }>(`queues/${encodeURIComponent(queueName)}/resume`, {}).pipe(
      map(response => response.success),
      tap(success => {
        if (success) {
          this.updateQueueInState(queueName, { isReceiveEnabled: true });
          this.loadQueues().subscribe();
        }
      }),
      catchError(error => {
        this.updateState({ error: error.message || 'Failed to resume queue' });
        return of(false);
      })
    );
  }

  purgeQueue(queueName: string): Observable<PurgeQueueResult> {
    return this.api.delete<PurgeQueueResult>(`queues/${encodeURIComponent(queueName)}/purge`).pipe(
      tap(result => {
        if (result.success) {
          this.updateQueueInState(queueName, { messageCount: 0, poisonMessageCount: 0 });
          this.loadMessages(queueName, 0).subscribe();
        }
      }),
      catchError(error => {
        this.updateState({ error: error.message || 'Failed to purge queue' });
        return of({
          success: false,
          messagesDeleted: 0,
          message: error.message || 'Failed to purge queue'
        });
      })
    );
  }

  private updateQueueInState(queueName: string, updates: Partial<Queue>): void {
    const currentState = this.state.value;
    const updatedQueues = currentState.queues.map(q =>
      q.queueName === queueName ? { ...q, ...updates } : q
    );

    this.updateState({
      queues: updatedQueues,
      filteredQueues: this.applyFilter(updatedQueues, currentState.filter)
    });

    if (currentState.selectedQueue?.queueName === queueName) {
      this.updateState({
        selectedQueue: { ...currentState.selectedQueue, ...updates }
      });
    }
  }

  deleteMessages(conversationHandles: string[]): Observable<BulkActionResult> {
    const queueName = this.state.value.selectedQueue?.queueName;
    if (!queueName) {
      return of({ success: false, processedCount: 0, failedCount: 0, errors: ['No queue selected'] });
    }

    return this.api.post<BulkActionResult>(`queues/${encodeURIComponent(queueName)}/messages/delete`, {
      conversationHandles
    }).pipe(
      tap(result => {
        if (result.success) {
          this.updateState({ selectedMessages: [] });
          this.loadMessages(queueName, this.state.value.currentPage).subscribe();
          this.loadQueueStatistics(queueName).subscribe();
        }
      }),
      catchError(error => {
        return of({
          success: false,
          processedCount: 0,
          failedCount: conversationHandles.length,
          errors: [error.message || 'Failed to delete messages']
        });
      })
    );
  }

  markMessagesAsReceived(conversationHandles: string[]): Observable<BulkActionResult> {
    const queueName = this.state.value.selectedQueue?.queueName;
    if (!queueName) {
      return of({ success: false, processedCount: 0, failedCount: 0, errors: ['No queue selected'] });
    }

    return this.api.post<BulkActionResult>(`queues/${encodeURIComponent(queueName)}/messages/receive`, {
      conversationHandles
    }).pipe(
      tap(result => {
        if (result.success) {
          this.updateState({ selectedMessages: [] });
          this.loadMessages(queueName, this.state.value.currentPage).subscribe();
          this.loadQueueStatistics(queueName).subscribe();
        }
      }),
      catchError(error => {
        return of({
          success: false,
          processedCount: 0,
          failedCount: conversationHandles.length,
          errors: [error.message || 'Failed to mark messages as received']
        });
      })
    );
  }

  exportMessagesToJson(): string {
    const messages = this.state.value.selectedMessages.length > 0
      ? this.state.value.selectedMessages
      : this.state.value.messages;

    return JSON.stringify(messages, null, 2);
  }

  getMessageTypes(): Observable<string[]> {
    return this.api.get<string[]>('services/message-types').pipe(
      catchError(() => of([]))
    );
  }

  getCurrentState(): QueueExplorerState {
    return this.state.value;
  }

  refreshCurrentQueue(): void {
    const selectedQueue = this.state.value.selectedQueue;
    if (selectedQueue) {
      this.loadQueueStatistics(selectedQueue.queueName).subscribe();
      this.loadMessages(selectedQueue.queueName, this.state.value.currentPage).subscribe();
    }
  }
}
