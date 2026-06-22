import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Subject } from 'rxjs';
import { takeUntil } from 'rxjs/operators';
import { PoisonMessagesService } from './services';
import {
  PoisonMessagesState,
  PoisonMessage,
  DeadLetterMessage,
  PoisonMessageFilter,
  DeadLetterFilter
} from './models';
import { PoisonMessageListComponent, DeadLetterListComponent, PoisonMessageDetailComponent } from './components';
import { ConfirmDialogComponent, MetricCardComponent, LoadingSpinnerComponent } from '../../shared/components';

@Component({
  selector: 'app-poison-messages',
  standalone: true,
  imports: [
    CommonModule,
    PoisonMessageListComponent,
    DeadLetterListComponent,
    PoisonMessageDetailComponent,
    ConfirmDialogComponent,
    MetricCardComponent,
    LoadingSpinnerComponent
  ],
  templateUrl: './poison-messages.component.html',
  styleUrls: ['./poison-messages.component.scss']
})
export class PoisonMessagesComponent implements OnInit, OnDestroy {
  private destroy$ = new Subject<void>();

  state: PoisonMessagesState | null = null;
  queueNames: string[] = [];
  messageTypes: string[] = [];

  // Confirmation dialog state
  showConfirmDialog: boolean = false;
  confirmDialogTitle: string = '';
  confirmDialogMessage: string = '';
  confirmDialogType: 'info' | 'warning' | 'danger' | 'success' = 'warning';
  pendingAction: (() => void) | null = null;

  constructor(private poisonMessagesService: PoisonMessagesService) {}

  ngOnInit(): void {
    this.subscribeToState();
    this.loadInitialData();
    this.loadFilterOptions();
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  private subscribeToState(): void {
    this.poisonMessagesService.state$
      .pipe(takeUntil(this.destroy$))
      .subscribe(state => {
        this.state = state;
      });
  }

  private loadInitialData(): void {
    this.poisonMessagesService.loadStats().subscribe();
    this.poisonMessagesService.loadPoisonMessages().subscribe();
  }

  private loadFilterOptions(): void {
    this.poisonMessagesService.getQueueNames()
      .pipe(takeUntil(this.destroy$))
      .subscribe(names => {
        this.queueNames = names;
      });

    this.poisonMessagesService.getMessageTypes()
      .pipe(takeUntil(this.destroy$))
      .subscribe(types => {
        this.messageTypes = types;
      });
  }

  // Tab Management
  setActiveTab(tab: 'poison' | 'dead-letter'): void {
    this.poisonMessagesService.setActiveTab(tab);
  }

  // Poison Message List Events
  onPoisonMessageSelected(message: PoisonMessage): void {
    this.poisonMessagesService.loadPoisonMessageDetail(message.id).subscribe();
  }

  onPoisonMessageToggled(message: PoisonMessage): void {
    this.poisonMessagesService.toggleMessageSelection(message);
  }

  onPoisonSelectAll(): void {
    this.poisonMessagesService.selectAllMessages();
  }

  onPoisonDeselectAll(): void {
    this.poisonMessagesService.deselectAllMessages();
  }

  onPoisonFilterChanged(filter: Partial<PoisonMessageFilter>): void {
    this.poisonMessagesService.setPoisonFilter(filter);
  }

  onPoisonFilterReset(): void {
    this.poisonMessagesService.resetPoisonFilter();
  }

  onPoisonPageChanged(page: number): void {
    this.poisonMessagesService.setPage(page);
  }

  onPoisonPageSizeChanged(pageSize: number): void {
    this.poisonMessagesService.setPageSize(pageSize);
  }

  onRetryMessage(message: PoisonMessage): void {
    this.confirmDialogTitle = 'Retry Message';
    this.confirmDialogMessage = `Are you sure you want to retry this poison message? It will be moved back to the queue for processing.`;
    this.confirmDialogType = 'warning';
    this.pendingAction = () => {
      this.poisonMessagesService.retryPoisonMessage(message.id).subscribe();
    };
    this.showConfirmDialog = true;
  }

  onPurgeMessage(message: PoisonMessage): void {
    this.confirmDialogTitle = 'Purge Message';
    this.confirmDialogMessage = `Are you sure you want to purge this poison message? It will be moved to the dead-letter queue permanently.`;
    this.confirmDialogType = 'danger';
    this.pendingAction = () => {
      this.poisonMessagesService.purgePoisonMessage(message.id).subscribe();
    };
    this.showConfirmDialog = true;
  }

  onBulkRetry(messages: PoisonMessage[]): void {
    this.confirmDialogTitle = 'Bulk Retry';
    this.confirmDialogMessage = `Are you sure you want to retry ${messages.length} poison message(s)? They will be moved back to their queues for processing.`;
    this.confirmDialogType = 'warning';
    this.pendingAction = () => {
      const ids = messages.map(m => m.id);
      this.poisonMessagesService.bulkRetry(ids).subscribe();
    };
    this.showConfirmDialog = true;
  }

  onBulkPurge(messages: PoisonMessage[]): void {
    this.confirmDialogTitle = 'Bulk Purge';
    this.confirmDialogMessage = `Are you sure you want to purge ${messages.length} poison message(s)? They will be moved to the dead-letter queue permanently.`;
    this.confirmDialogType = 'danger';
    this.pendingAction = () => {
      const ids = messages.map(m => m.id);
      this.poisonMessagesService.bulkPurge(ids).subscribe();
    };
    this.showConfirmDialog = true;
  }

  // Dead Letter List Events
  onDeadLetterSelected(message: DeadLetterMessage): void {
    this.poisonMessagesService.loadDeadLetterDetail(message.id).subscribe();
  }

  onDeadLetterToggled(message: DeadLetterMessage): void {
    this.poisonMessagesService.toggleDeadLetterSelection(message);
  }

  onDeadLetterSelectAll(): void {
    this.poisonMessagesService.selectAllMessages();
  }

  onDeadLetterDeselectAll(): void {
    this.poisonMessagesService.deselectAllMessages();
  }

  onDeadLetterFilterChanged(filter: Partial<DeadLetterFilter>): void {
    this.poisonMessagesService.setDeadLetterFilter(filter);
  }

  onDeadLetterFilterReset(): void {
    this.poisonMessagesService.resetDeadLetterFilter();
  }

  onDeadLetterPageChanged(page: number): void {
    this.poisonMessagesService.setPage(page);
  }

  onDeadLetterPageSizeChanged(pageSize: number): void {
    this.poisonMessagesService.setPageSize(pageSize);
  }

  onResolveDeadLetter(event: { message: DeadLetterMessage; notes: string }): void {
    this.poisonMessagesService.resolveDeadLetter(event.message.id, { resolutionNotes: event.notes }).subscribe();
  }

  // Detail Panel Events
  onCloseDetail(): void {
    this.poisonMessagesService.closeDetailPanel();
  }

  onRetryFromDetail(id: number): void {
    this.confirmDialogTitle = 'Retry Message';
    this.confirmDialogMessage = `Are you sure you want to retry this poison message?`;
    this.confirmDialogType = 'warning';
    this.pendingAction = () => {
      this.poisonMessagesService.retryPoisonMessage(id).subscribe();
    };
    this.showConfirmDialog = true;
  }

  onPurgeFromDetail(id: number): void {
    this.confirmDialogTitle = 'Purge Message';
    this.confirmDialogMessage = `Are you sure you want to purge this poison message?`;
    this.confirmDialogType = 'danger';
    this.pendingAction = () => {
      this.poisonMessagesService.purgePoisonMessage(id).subscribe();
    };
    this.showConfirmDialog = true;
  }

  onReEnableQueue(queueName: string): void {
    this.poisonMessagesService.reEnableQueue(queueName).subscribe();
  }

  // Confirmation Dialog Events
  onConfirmAction(): void {
    if (this.pendingAction) {
      this.pendingAction();
    }
    this.closeConfirmDialog();
  }

  onCancelAction(): void {
    this.closeConfirmDialog();
  }

  private closeConfirmDialog(): void {
    this.showConfirmDialog = false;
    this.pendingAction = null;
  }

  // Refresh
  onRefresh(): void {
    this.poisonMessagesService.refresh();
  }

  // Error handling
  onDismissError(): void {
    this.poisonMessagesService.clearError();
  }
}
