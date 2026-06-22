import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { Subject } from 'rxjs';
import { takeUntil } from 'rxjs/operators';
import { QueueExplorerService } from './services';
import {
  Queue,
  QueueExplorerState,
  QueueFilter,
  QueueMessage,
  MessageFilter
} from './models';
import {
  QueueListComponent,
  QueueDetailComponent,
  QueueActionsComponent,
  MessageTableComponent,
  MessagePageEvent
} from './components';

@Component({
  selector: 'app-queue-explorer',
  standalone: true,
  imports: [
    CommonModule,
    QueueListComponent,
    QueueDetailComponent,
    QueueActionsComponent,
    MessageTableComponent
  ],
  templateUrl: './queue-explorer.component.html',
  styleUrls: ['./queue-explorer.component.scss']
})
export class QueueExplorerComponent implements OnInit, OnDestroy {
  private destroy$ = new Subject<void>();

  state: QueueExplorerState | null = null;
  messageTypes: string[] = [];

  constructor(
    private queueExplorerService: QueueExplorerService,
    private router: Router
  ) {}

  ngOnInit(): void {
    this.subscribeToState();
    this.loadInitialData();
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
    this.queueExplorerService.deselectQueue();
  }

  private subscribeToState(): void {
    this.queueExplorerService.state$
      .pipe(takeUntil(this.destroy$))
      .subscribe(state => {
        this.state = state;
      });
  }

  private loadInitialData(): void {
    this.queueExplorerService.loadQueues().subscribe();
    this.queueExplorerService.getMessageTypes()
      .pipe(takeUntil(this.destroy$))
      .subscribe(types => {
        this.messageTypes = types;
      });
  }

  onQueueSelected(queue: Queue): void {
    this.queueExplorerService.selectQueue(queue);
  }

  onFilterChanged(filter: Partial<QueueFilter>): void {
    this.queueExplorerService.setFilter(filter);
  }

  onRefreshQueues(): void {
    this.queueExplorerService.loadQueues().subscribe();
  }

  onReceiveMessage(): void {
    const queueName = this.state?.selectedQueue?.queueName;
    if (queueName) {
      this.router.navigate(['/message-inspector'], {
        queryParams: { queue: queueName, action: 'receive' }
      });
    }
  }

  onTogglePause(pause: boolean): void {
    const queueName = this.state?.selectedQueue?.queueName;
    if (!queueName) return;

    if (pause) {
      this.queueExplorerService.pauseQueue(queueName).subscribe();
    } else {
      this.queueExplorerService.resumeQueue(queueName).subscribe();
    }
  }

  onPurgeQueue(): void {
    const queueName = this.state?.selectedQueue?.queueName;
    if (queueName) {
      this.queueExplorerService.purgeQueue(queueName).subscribe();
    }
  }

  onRefreshQueue(): void {
    this.queueExplorerService.refreshCurrentQueue();
  }

  onMessageFilterChanged(filter: Partial<MessageFilter>): void {
    this.queueExplorerService.setMessageFilter(filter);
  }

  onPageChanged(event: MessagePageEvent): void {
    if (event.pageSize !== this.state?.pageSize) {
      this.queueExplorerService.setPageSize(event.pageSize);
    } else {
      this.queueExplorerService.setPage(event.page);
    }
  }

  onMessageSelected(message: QueueMessage): void {
    this.queueExplorerService.toggleMessageSelection(message);
  }

  onSelectAllMessages(): void {
    this.queueExplorerService.selectAllMessages();
  }

  onDeselectAllMessages(): void {
    this.queueExplorerService.deselectAllMessages();
  }

  onDeleteMessages(messages: QueueMessage[]): void {
    const handles = messages.map(m => m.conversationHandle);
    this.queueExplorerService.deleteMessages(handles).subscribe();
  }

  onMarkAsReceived(messages: QueueMessage[]): void {
    const handles = messages.map(m => m.conversationHandle);
    this.queueExplorerService.markMessagesAsReceived(handles).subscribe();
  }

  onExportJson(): void {
    const jsonContent = this.queueExplorerService.exportMessagesToJson();
    this.downloadJson(jsonContent);
  }

  private downloadJson(content: string): void {
    const blob = new Blob([content], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `messages-${this.state?.selectedQueue?.queueName || 'export'}-${new Date().toISOString().slice(0, 10)}.json`;
    link.click();
    URL.revokeObjectURL(url);
  }

  onViewMessage(message: QueueMessage): void {
    this.router.navigate(['/message-inspector'], {
      queryParams: {
        conversation: message.conversationHandle,
        sequence: message.sequenceNumber
      }
    });
  }
}
