import { Injectable, OnDestroy } from '@angular/core';
import { BehaviorSubject, Observable, Subject, of } from 'rxjs';
import { catchError, map, tap, takeUntil } from 'rxjs/operators';
import { ApiService } from '../../../core/services/api.service';
import { SignalRService } from '../../../core/services/signalr.service';
import {
  PoisonMessage,
  PoisonMessageDetail,
  DeadLetterMessage,
  PoisonMessagesState,
  PoisonMessageFilter,
  DeadLetterFilter,
  PoisonMessageStats,
  BulkRetryResult,
  BulkPurgeResult,
  RetryResult,
  ResolveDeadLetterRequest,
  ResolveDeadLetterResult,
  initialPoisonMessagesState,
  initialPoisonMessageFilter,
  initialDeadLetterFilter
} from '../models';

interface PageResponse<T> {
  items: T[];
  totalCount: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

@Injectable({
  providedIn: 'root'
})
export class PoisonMessagesService implements OnDestroy {
  private destroy$ = new Subject<void>();
  private state = new BehaviorSubject<PoisonMessagesState>(initialPoisonMessagesState);

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
        if (update?.poisonMessageCount !== undefined) {
          this.refreshIfNeeded();
        }
      });
  }

  private refreshIfNeeded(): void {
    const currentState = this.state.value;
    if (currentState.activeTab === 'poison') {
      this.loadPoisonMessages().subscribe();
    }
    this.loadStats().subscribe();
  }

  private updateState(partialState: Partial<PoisonMessagesState>): void {
    this.state.next({
      ...this.state.value,
      ...partialState
    });
  }

  // Tab Management
  setActiveTab(tab: 'poison' | 'dead-letter'): void {
    this.updateState({
      activeTab: tab,
      currentPage: 0,
      selectedMessages: [],
      selectedDeadLetters: [],
      selectedPoisonMessage: null,
      selectedDeadLetterMessage: null
    });

    if (tab === 'poison') {
      this.loadPoisonMessages().subscribe();
    } else {
      this.loadDeadLetterMessages().subscribe();
    }
  }

  // Load Poison Messages
  loadPoisonMessages(page: number = 0): Observable<PoisonMessage[]> {
    this.updateState({ loading: true, error: null });
    const { pageSize, poisonFilter } = this.state.value;

    let endpoint = `poison-messages?page=${page}&pageSize=${pageSize}`;

    if (poisonFilter.queueName) {
      endpoint += `&queueName=${encodeURIComponent(poisonFilter.queueName)}`;
    }
    if (poisonFilter.messageType) {
      endpoint += `&messageType=${encodeURIComponent(poisonFilter.messageType)}`;
    }
    if (poisonFilter.searchTerm) {
      endpoint += `&search=${encodeURIComponent(poisonFilter.searchTerm)}`;
    }
    endpoint += `&sortField=${poisonFilter.sortField}&sortDirection=${poisonFilter.sortDirection}`;

    return this.api.get<PageResponse<PoisonMessage>>(endpoint).pipe(
      map(response => response.items || []),
      tap(messages => {
        this.updateState({
          poisonMessages: messages,
          totalPoisonMessages: messages.length,
          currentPage: page,
          loading: false,
          lastUpdated: new Date()
        });
      }),
      catchError(error => {
        this.updateState({
          loading: false,
          error: error.message || 'Failed to load poison messages'
        });
        return of([]);
      })
    );
  }

  // Load Dead Letter Messages
  loadDeadLetterMessages(page: number = 0): Observable<DeadLetterMessage[]> {
    this.updateState({ loading: true, error: null });
    const { pageSize, deadLetterFilter } = this.state.value;

    let endpoint = `poison-messages/dead-letter?page=${page}&pageSize=${pageSize}`;

    if (deadLetterFilter.queueName) {
      endpoint += `&queueName=${encodeURIComponent(deadLetterFilter.queueName)}`;
    }
    if (deadLetterFilter.messageType) {
      endpoint += `&messageType=${encodeURIComponent(deadLetterFilter.messageType)}`;
    }
    if (deadLetterFilter.reason !== 'all') {
      endpoint += `&reason=${deadLetterFilter.reason}`;
    }
    if (deadLetterFilter.searchTerm) {
      endpoint += `&search=${encodeURIComponent(deadLetterFilter.searchTerm)}`;
    }
    endpoint += `&sortField=${deadLetterFilter.sortField}&sortDirection=${deadLetterFilter.sortDirection}`;

    return this.api.get<PageResponse<DeadLetterMessage>>(endpoint).pipe(
      map(response => response.items || []),
      tap(messages => {
        this.updateState({
          deadLetterMessages: messages,
          totalDeadLetterMessages: messages.length,
          currentPage: page,
          loading: false,
          lastUpdated: new Date()
        });
      }),
      catchError(error => {
        this.updateState({
          loading: false,
          error: error.message || 'Failed to load dead letter messages'
        });
        return of([]);
      })
    );
  }

  // Load Stats
  loadStats(): Observable<PoisonMessageStats | null> {
    return this.api.get<PoisonMessageStats>('poison-messages/stats').pipe(
      tap(stats => {
        this.updateState({ stats });
      }),
      catchError(error => {
        console.error('Failed to load poison message stats:', error);
        return of(null);
      })
    );
  }

  // Load Poison Message Detail
  loadPoisonMessageDetail(id: number): Observable<PoisonMessageDetail | null> {
    this.updateState({ detailLoading: true });

    return this.api.get<PoisonMessageDetail>(`poison-messages/${id}`).pipe(
      tap(detail => {
        this.updateState({
          selectedPoisonMessage: detail,
          detailLoading: false
        });
      }),
      catchError(error => {
        this.updateState({
          detailLoading: false,
          error: error.message || 'Failed to load poison message details'
        });
        return of(null);
      })
    );
  }

  // Load Dead Letter Message Detail
  loadDeadLetterDetail(id: number): Observable<DeadLetterMessage | null> {
    this.updateState({ detailLoading: true });

    return this.api.get<DeadLetterMessage>(`poison-messages/dead-letter/${id}`).pipe(
      tap(detail => {
        this.updateState({
          selectedDeadLetterMessage: detail,
          detailLoading: false
        });
      }),
      catchError(error => {
        this.updateState({
          detailLoading: false,
          error: error.message || 'Failed to load dead letter message details'
        });
        return of(null);
      })
    );
  }

  // Close Detail Panel
  closeDetailPanel(): void {
    this.updateState({
      selectedPoisonMessage: null,
      selectedDeadLetterMessage: null
    });
  }

  // Retry Single Poison Message
  retryPoisonMessage(id: number): Observable<RetryResult> {
    this.updateState({ operationLoading: true });

    return this.api.post<RetryResult>(`poison-messages/${id}/retry`, {}).pipe(
      tap(result => {
        if (result.success) {
          this.loadPoisonMessages(this.state.value.currentPage).subscribe();
          this.loadStats().subscribe();
          this.closeDetailPanel();
        }
        this.updateState({ operationLoading: false });
      }),
      catchError(error => {
        this.updateState({
          operationLoading: false,
          error: error.message || 'Failed to retry poison message'
        });
        return of({
          success: false,
          message: error.message || 'Failed to retry poison message',
          queueReEnabled: false
        });
      })
    );
  }

  // Purge Single Poison Message (move to dead-letter)
  purgePoisonMessage(id: number): Observable<{ success: boolean; message: string }> {
    this.updateState({ operationLoading: true });

    return this.api.post<{ success: boolean; message: string }>(`poison-messages/${id}/purge`, {}).pipe(
      tap(result => {
        if (result.success) {
          this.loadPoisonMessages(this.state.value.currentPage).subscribe();
          this.loadDeadLetterMessages().subscribe();
          this.loadStats().subscribe();
          this.closeDetailPanel();
        }
        this.updateState({ operationLoading: false });
      }),
      catchError(error => {
        this.updateState({
          operationLoading: false,
          error: error.message || 'Failed to purge poison message'
        });
        return of({
          success: false,
          message: error.message || 'Failed to purge poison message'
        });
      })
    );
  }

  // Bulk Retry
  bulkRetry(ids: number[]): Observable<BulkRetryResult> {
    this.updateState({ operationLoading: true });

    return this.api.post<BulkRetryResult>('poison-messages/bulk-retry', { ids }).pipe(
      tap(result => {
        if (result.successCount > 0) {
          this.loadPoisonMessages(this.state.value.currentPage).subscribe();
          this.loadStats().subscribe();
        }
        this.updateState({
          operationLoading: false,
          selectedMessages: []
        });
      }),
      catchError(error => {
        this.updateState({
          operationLoading: false,
          error: error.message || 'Failed to bulk retry poison messages'
        });
        return of({
          success: false,
          totalRequested: ids.length,
          successCount: 0,
          failedCount: ids.length,
          errors: [{ id: 0, conversationHandle: '', errorMessage: error.message }]
        });
      })
    );
  }

  // Bulk Purge
  bulkPurge(ids: number[]): Observable<BulkPurgeResult> {
    this.updateState({ operationLoading: true });

    return this.api.post<BulkPurgeResult>('poison-messages/bulk-purge', { ids }).pipe(
      tap(result => {
        if (result.purgedCount > 0) {
          this.loadPoisonMessages(this.state.value.currentPage).subscribe();
          this.loadDeadLetterMessages().subscribe();
          this.loadStats().subscribe();
        }
        this.updateState({
          operationLoading: false,
          selectedMessages: []
        });
      }),
      catchError(error => {
        this.updateState({
          operationLoading: false,
          error: error.message || 'Failed to bulk purge poison messages'
        });
        return of({
          success: false,
          totalRequested: ids.length,
          purgedCount: 0,
          failedCount: ids.length,
          errors: [{ id: 0, conversationHandle: '', errorMessage: error.message }]
        });
      })
    );
  }

  // Re-enable Queue
  reEnableQueue(queueName: string): Observable<{ success: boolean; message: string }> {
    return this.api.post<{ success: boolean; message: string }>(
      `queues/${encodeURIComponent(queueName)}/resume`,
      {}
    ).pipe(
      tap(result => {
        if (result.success && this.state.value.selectedPoisonMessage) {
          const updatedDetail = {
            ...this.state.value.selectedPoisonMessage,
            queueStatus: {
              ...this.state.value.selectedPoisonMessage.queueStatus,
              isReceiveEnabled: true
            }
          };
          this.updateState({ selectedPoisonMessage: updatedDetail });
        }
      }),
      catchError(error => {
        this.updateState({
          error: error.message || 'Failed to re-enable queue'
        });
        return of({
          success: false,
          message: error.message || 'Failed to re-enable queue'
        });
      })
    );
  }

  // Resolve Dead Letter (add resolution notes)
  resolveDeadLetter(id: number, request: ResolveDeadLetterRequest): Observable<ResolveDeadLetterResult> {
    return this.api.post<ResolveDeadLetterResult>(
      `poison-messages/dead-letter/${id}/resolve`,
      request
    ).pipe(
      tap(result => {
        if (result.success) {
          this.loadDeadLetterMessages(this.state.value.currentPage).subscribe();
        }
      }),
      catchError(error => {
        return of({
          success: false,
          message: error.message || 'Failed to resolve dead letter message'
        });
      })
    );
  }

  // Filter Management
  setPoisonFilter(filter: Partial<PoisonMessageFilter>): void {
    const newFilter = { ...this.state.value.poisonFilter, ...filter };
    this.updateState({
      poisonFilter: newFilter,
      currentPage: 0
    });
    this.loadPoisonMessages(0).subscribe();
  }

  resetPoisonFilter(): void {
    this.updateState({
      poisonFilter: initialPoisonMessageFilter,
      currentPage: 0
    });
    this.loadPoisonMessages(0).subscribe();
  }

  setDeadLetterFilter(filter: Partial<DeadLetterFilter>): void {
    const newFilter = { ...this.state.value.deadLetterFilter, ...filter };
    this.updateState({
      deadLetterFilter: newFilter,
      currentPage: 0
    });
    this.loadDeadLetterMessages(0).subscribe();
  }

  resetDeadLetterFilter(): void {
    this.updateState({
      deadLetterFilter: initialDeadLetterFilter,
      currentPage: 0
    });
    this.loadDeadLetterMessages(0).subscribe();
  }

  // Pagination
  setPage(page: number): void {
    const { activeTab } = this.state.value;
    if (activeTab === 'poison') {
      this.loadPoisonMessages(page).subscribe();
    } else {
      this.loadDeadLetterMessages(page).subscribe();
    }
  }

  setPageSize(pageSize: number): void {
    this.updateState({ pageSize, currentPage: 0 });
    const { activeTab } = this.state.value;
    if (activeTab === 'poison') {
      this.loadPoisonMessages(0).subscribe();
    } else {
      this.loadDeadLetterMessages(0).subscribe();
    }
  }

  // Selection Management
  toggleMessageSelection(message: PoisonMessage): void {
    const selectedMessages = [...this.state.value.selectedMessages];
    const index = selectedMessages.findIndex(m => m.id === message.id);

    if (index >= 0) {
      selectedMessages.splice(index, 1);
    } else {
      selectedMessages.push(message);
    }

    this.updateState({ selectedMessages });
  }

  toggleDeadLetterSelection(message: DeadLetterMessage): void {
    const selectedDeadLetters = [...this.state.value.selectedDeadLetters];
    const index = selectedDeadLetters.findIndex(m => m.id === message.id);

    if (index >= 0) {
      selectedDeadLetters.splice(index, 1);
    } else {
      selectedDeadLetters.push(message);
    }

    this.updateState({ selectedDeadLetters });
  }

  selectAllMessages(): void {
    const { activeTab, poisonMessages, deadLetterMessages } = this.state.value;
    if (activeTab === 'poison') {
      this.updateState({ selectedMessages: [...poisonMessages] });
    } else {
      this.updateState({ selectedDeadLetters: [...deadLetterMessages] });
    }
  }

  deselectAllMessages(): void {
    this.updateState({
      selectedMessages: [],
      selectedDeadLetters: []
    });
  }

  isMessageSelected(message: PoisonMessage): boolean {
    return this.state.value.selectedMessages.some(m => m.id === message.id);
  }

  isDeadLetterSelected(message: DeadLetterMessage): boolean {
    return this.state.value.selectedDeadLetters.some(m => m.id === message.id);
  }

  // Get available queue names for filtering
  getQueueNames(): Observable<string[]> {
    return this.api.get<{ queueName: string }[]>('queues').pipe(
      map(queues => queues.map(q => q.queueName)),
      catchError(() => of([]))
    );
  }

  // Get available message types for filtering
  getMessageTypes(): Observable<string[]> {
    return this.api.get<string[]>('services/message-types').pipe(
      catchError(() => of([]))
    );
  }

  // Clear error
  clearError(): void {
    this.updateState({ error: null });
  }

  // Get current state
  getCurrentState(): PoisonMessagesState {
    return this.state.value;
  }

  // Refresh all data
  refresh(): void {
    const { activeTab, currentPage } = this.state.value;
    this.loadStats().subscribe();
    if (activeTab === 'poison') {
      this.loadPoisonMessages(currentPage).subscribe();
    } else {
      this.loadDeadLetterMessages(currentPage).subscribe();
    }
  }
}
