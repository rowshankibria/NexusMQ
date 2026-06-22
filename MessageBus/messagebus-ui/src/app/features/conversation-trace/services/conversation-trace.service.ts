import { Injectable, OnDestroy } from '@angular/core';
import { BehaviorSubject, Observable, Subject, of } from 'rxjs';
import { catchError, map, tap, takeUntil } from 'rxjs/operators';
import { ApiService } from '../../../core/services/api.service';
import { SignalRService } from '../../../core/services/signalr.service';
import {
  Conversation,
  ConversationMessage,
  ConversationTimeline,
  ConversationTraceState,
  ConversationFilter,
  ConversationStats,
  ExportOptions,
  initialConversationTraceState,
  initialConversationFilter
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
export class ConversationTraceService implements OnDestroy {
  private destroy$ = new Subject<void>();
  private state = new BehaviorSubject<ConversationTraceState>(initialConversationTraceState);

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
    this.signalR.conversationUpdate$
      .pipe(takeUntil(this.destroy$))
      .subscribe(update => {
        if (update && this.state.value.selectedConversation?.conversationHandle === update.conversationHandle) {
          this.loadConversationTimeline(update.conversationHandle).subscribe();
        }
      });
  }

  private updateState(partialState: Partial<ConversationTraceState>): void {
    this.state.next({
      ...this.state.value,
      ...partialState
    });
  }

  // Load Conversations
  loadConversations(page: number = 0): Observable<Conversation[]> {
    this.updateState({ loading: true, error: null });
    const { pageSize, filter } = this.state.value;

    let endpoint = `conversations?page=${page}&pageSize=${pageSize}`;

    if (filter.state && filter.state !== 'all') {
      if (filter.state === 'active') {
        endpoint += '&state=CO,SO,SI';
      } else if (filter.state === 'closed') {
        endpoint += '&state=CD';
      } else if (filter.state === 'error') {
        endpoint += '&state=ER';
      } else {
        endpoint += `&state=${filter.state}`;
      }
    }

    if (filter.dateFrom) {
      endpoint += `&dateFrom=${filter.dateFrom.toISOString()}`;
    }
    if (filter.dateTo) {
      endpoint += `&dateTo=${filter.dateTo.toISOString()}`;
    }
    if (filter.searchTerm) {
      endpoint += `&search=${encodeURIComponent(filter.searchTerm)}`;
    }
    if (filter.initiatorService) {
      endpoint += `&initiatorService=${encodeURIComponent(filter.initiatorService)}`;
    }
    if (filter.targetService) {
      endpoint += `&targetService=${encodeURIComponent(filter.targetService)}`;
    }

    endpoint += `&sortField=${filter.sortField}&sortDirection=${filter.sortDirection}`;

    return this.api.get<PageResponse<Conversation>>(endpoint).pipe(
      map(response => response.items || []),
      tap(conversations => {
        this.updateState({
          conversations,
          totalConversations: conversations.length,
          currentPage: page,
          loading: false,
          lastUpdated: new Date()
        });
      }),
      catchError(error => {
        this.updateState({
          loading: false,
          error: error.message || 'Failed to load conversations'
        });
        return of([]);
      })
    );
  }

  // Load Conversation Stats
  loadStats(): Observable<ConversationStats | null> {
    return this.api.get<ConversationStats>('conversations/stats').pipe(
      tap(stats => {
        this.updateState({ stats });
      }),
      catchError(error => {
        console.error('Failed to load conversation stats:', error);
        return of(null);
      })
    );
  }

  // Select Conversation
  selectConversation(conversation: Conversation): void {
    this.updateState({ selectedConversation: conversation });
    this.loadConversationTimeline(conversation.conversationHandle).subscribe();
    this.signalR.subscribeToConversation(conversation.conversationHandle);
  }

  // Deselect Conversation
  deselectConversation(): void {
    const currentConversation = this.state.value.selectedConversation;
    if (currentConversation) {
      this.signalR.unsubscribeFromConversation(currentConversation.conversationHandle);
    }
    this.updateState({
      selectedConversation: null,
      timeline: null,
      selectedMessage: null
    });
  }

  // Load Conversation Timeline
  loadConversationTimeline(conversationHandle: string): Observable<ConversationTimeline | null> {
    this.updateState({ timelineLoading: true });

    return this.api.get<ConversationTimeline>(`conversations/${encodeURIComponent(conversationHandle)}/timeline`).pipe(
      tap(timeline => {
        this.updateState({
          timeline,
          timelineLoading: false
        });
      }),
      catchError(error => {
        this.updateState({
          timelineLoading: false,
          error: error.message || 'Failed to load conversation timeline'
        });
        return of(null);
      })
    );
  }

  // Select Message
  selectMessage(message: ConversationMessage): void {
    this.updateState({ selectedMessage: message });
  }

  // Deselect Message
  deselectMessage(): void {
    this.updateState({ selectedMessage: null });
  }

  // Filter Management
  setFilter(filter: Partial<ConversationFilter>): void {
    const newFilter = { ...this.state.value.filter, ...filter };
    this.updateState({
      filter: newFilter,
      currentPage: 0
    });
    this.loadConversations(0).subscribe();
  }

  resetFilter(): void {
    this.updateState({
      filter: initialConversationFilter,
      currentPage: 0
    });
    this.loadConversations(0).subscribe();
  }

  // Pagination
  setPage(page: number): void {
    this.loadConversations(page).subscribe();
  }

  setPageSize(pageSize: number): void {
    this.updateState({ pageSize, currentPage: 0 });
    this.loadConversations(0).subscribe();
  }

  // Export Conversation
  exportConversation(conversationHandle: string, options: ExportOptions): Observable<Blob> {
    const endpoint = `conversations/${encodeURIComponent(conversationHandle)}/export`;
    const params: Record<string, string> = {
      format: options.format,
      includeMessageBodies: options.includeMessageBodies.toString(),
      includeStateTransitions: options.includeStateTransitions.toString()
    };

    return this.api.get<string>(endpoint, { params }).pipe(
      map(data => {
        const mimeType = options.format === 'json' ? 'application/json' : 'text/csv';
        return new Blob([typeof data === 'string' ? data : JSON.stringify(data, null, 2)], { type: mimeType });
      }),
      catchError(error => {
        this.updateState({
          error: error.message || 'Failed to export conversation'
        });
        throw error;
      })
    );
  }

  // Download Export
  downloadExport(conversationHandle: string, options: ExportOptions): void {
    this.exportConversation(conversationHandle, options).subscribe({
      next: blob => {
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = `conversation-${conversationHandle}.${options.format}`;
        link.click();
        URL.revokeObjectURL(url);
      },
      error: error => {
        console.error('Download failed:', error);
      }
    });
  }

  // Copy to Clipboard
  copyToClipboard(conversationHandle: string): Observable<boolean> {
    const timeline = this.state.value.timeline;
    if (!timeline) {
      return of(false);
    }

    const data = JSON.stringify(timeline, null, 2);
    return new Observable<boolean>(observer => {
      navigator.clipboard.writeText(data).then(
        () => {
          observer.next(true);
          observer.complete();
        },
        error => {
          console.error('Copy to clipboard failed:', error);
          observer.next(false);
          observer.complete();
        }
      );
    });
  }

  // End Conversation
  endConversation(conversationHandle: string): Observable<{ success: boolean; message: string }> {
    return this.api.post<{ success: boolean; message: string }>(
      `conversations/${encodeURIComponent(conversationHandle)}/end`,
      {}
    ).pipe(
      tap(result => {
        if (result.success) {
          this.loadConversations(this.state.value.currentPage).subscribe();
          if (this.state.value.selectedConversation?.conversationHandle === conversationHandle) {
            this.loadConversationTimeline(conversationHandle).subscribe();
          }
        }
      }),
      catchError(error => {
        this.updateState({
          error: error.message || 'Failed to end conversation'
        });
        return of({
          success: false,
          message: error.message || 'Failed to end conversation'
        });
      })
    );
  }

  // Get available services for filtering
  getServices(): Observable<string[]> {
    return this.api.get<{ serviceName: string }[]>('services').pipe(
      map(services => services.map(s => s.serviceName)),
      catchError(() => of([]))
    );
  }

  // Clear error
  clearError(): void {
    this.updateState({ error: null });
  }

  // Get current state
  getCurrentState(): ConversationTraceState {
    return this.state.value;
  }

  // Refresh all data
  refresh(): void {
    this.loadStats().subscribe();
    this.loadConversations(this.state.value.currentPage).subscribe();
    if (this.state.value.selectedConversation) {
      this.loadConversationTimeline(this.state.value.selectedConversation.conversationHandle).subscribe();
    }
  }
}
