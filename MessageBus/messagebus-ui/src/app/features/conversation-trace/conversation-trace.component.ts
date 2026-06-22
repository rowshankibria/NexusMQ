import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { Subject } from 'rxjs';
import { takeUntil } from 'rxjs/operators';
import { ConversationTraceService } from './services';
import {
  ConversationTraceState,
  Conversation,
  ConversationMessage,
  ConversationFilter,
  ConversationSortField,
  SortDirection,
  ExportOptions
} from './models';
import {
  ConversationListComponent,
  ConversationTimelineComponent,
  StateTransitionDiagramComponent,
  ExportConversationComponent
} from './components';
import { MetricCardComponent, LoadingSpinnerComponent } from '../../shared/components';

@Component({
  selector: 'app-conversation-trace',
  standalone: true,
  imports: [
    CommonModule,
    ConversationListComponent,
    ConversationTimelineComponent,
    StateTransitionDiagramComponent,
    ExportConversationComponent,
    MetricCardComponent,
    LoadingSpinnerComponent
  ],
  templateUrl: './conversation-trace.component.html',
  styleUrls: ['./conversation-trace.component.scss']
})
export class ConversationTraceComponent implements OnInit, OnDestroy {
  private destroy$ = new Subject<void>();

  state: ConversationTraceState | null = null;
  services: string[] = [];

  constructor(
    private conversationTraceService: ConversationTraceService,
    private router: Router
  ) {}

  ngOnInit(): void {
    this.subscribeToState();
    this.loadInitialData();
    this.loadFilterOptions();
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
    this.conversationTraceService.deselectConversation();
  }

  private subscribeToState(): void {
    this.conversationTraceService.state$
      .pipe(takeUntil(this.destroy$))
      .subscribe(state => {
        this.state = state;
      });
  }

  private loadInitialData(): void {
    this.conversationTraceService.loadStats().subscribe();
    this.conversationTraceService.loadConversations().subscribe();
  }

  private loadFilterOptions(): void {
    this.conversationTraceService.getServices()
      .pipe(takeUntil(this.destroy$))
      .subscribe(services => {
        this.services = services;
      });
  }

  // Conversation List Events
  onConversationSelected(conversation: Conversation): void {
    this.conversationTraceService.selectConversation(conversation);
  }

  onFilterChanged(filter: Partial<ConversationFilter>): void {
    this.conversationTraceService.setFilter(filter);
  }

  onFilterReset(): void {
    this.conversationTraceService.resetFilter();
  }

  onPageChanged(page: number): void {
    this.conversationTraceService.setPage(page);
  }

  onPageSizeChanged(pageSize: number): void {
    this.conversationTraceService.setPageSize(pageSize);
  }

  onSortChanged(event: { field: ConversationSortField; direction: SortDirection }): void {
    this.conversationTraceService.setFilter({
      sortField: event.field,
      sortDirection: event.direction
    });
  }

  // Timeline Events
  onMessageSelected(message: ConversationMessage): void {
    this.conversationTraceService.selectMessage(message);
  }

  onMessageInspect(message: ConversationMessage): void {
    // Navigate to message inspector with the message details
    if (this.state?.selectedConversation) {
      this.router.navigate(['/message-inspector'], {
        queryParams: {
          conversationHandle: this.state.selectedConversation.conversationHandle,
          messageId: message.id
        }
      });
    }
  }

  // Export Events
  onDownloadJson(options: ExportOptions): void {
    if (this.state?.selectedConversation) {
      this.conversationTraceService.downloadExport(
        this.state.selectedConversation.conversationHandle,
        { ...options, format: 'json' }
      );
    }
  }

  onDownloadCsv(options: ExportOptions): void {
    if (this.state?.selectedConversation) {
      this.conversationTraceService.downloadExport(
        this.state.selectedConversation.conversationHandle,
        { ...options, format: 'csv' }
      );
    }
  }

  onCopyToClipboard(): void {
    if (this.state?.selectedConversation) {
      this.conversationTraceService.copyToClipboard(
        this.state.selectedConversation.conversationHandle
      ).subscribe();
    }
  }

  // Refresh
  onRefresh(): void {
    this.conversationTraceService.refresh();
  }

  // Close detail panel
  onCloseDetail(): void {
    this.conversationTraceService.deselectConversation();
  }

  // Error handling
  onDismissError(): void {
    this.conversationTraceService.clearError();
  }
}
