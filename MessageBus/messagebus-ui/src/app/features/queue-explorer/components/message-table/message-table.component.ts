import { Component, Input, Output, EventEmitter, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterModule } from '@angular/router';
import { Subject } from 'rxjs';
import { takeUntil } from 'rxjs/operators';
import { StatusBadgeComponent } from '../../../../shared/components/status-badge/status-badge.component';
import { LoadingSpinnerComponent } from '../../../../shared/components/loading-spinner/loading-spinner.component';
import { ConfirmDialogComponent } from '../../../../shared/components/confirm-dialog/confirm-dialog.component';
import { QueueMessage, MessageFilter, MessageStatus, SortDirection } from '../../models';

export interface MessageSortEvent {
  column: string;
  direction: SortDirection;
}

export interface MessagePageEvent {
  page: number;
  pageSize: number;
}

@Component({
  selector: 'app-message-table',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    RouterModule,
    StatusBadgeComponent,
    LoadingSpinnerComponent,
    ConfirmDialogComponent
  ],
  templateUrl: './message-table.component.html',
  styleUrls: ['./message-table.component.scss']
})
export class MessageTableComponent implements OnInit, OnDestroy {
  @Input() messages: QueueMessage[] = [];
  @Input() totalMessages: number = 0;
  @Input() currentPage: number = 0;
  @Input() pageSize: number = 25;
  @Input() loading: boolean = false;
  @Input() selectedMessages: QueueMessage[] = [];
  @Input() filter: MessageFilter = { messageType: '', status: 'all' };
  @Input() messageTypes: string[] = [];

  @Output() filterChanged = new EventEmitter<Partial<MessageFilter>>();
  @Output() pageChanged = new EventEmitter<MessagePageEvent>();
  @Output() sortChanged = new EventEmitter<MessageSortEvent>();
  @Output() messageSelected = new EventEmitter<QueueMessage>();
  @Output() selectAll = new EventEmitter<void>();
  @Output() deselectAll = new EventEmitter<void>();
  @Output() deleteMessages = new EventEmitter<QueueMessage[]>();
  @Output() markAsReceived = new EventEmitter<QueueMessage[]>();
  @Output() exportJson = new EventEmitter<QueueMessage[]>();
  @Output() viewMessage = new EventEmitter<QueueMessage>();

  private destroy$ = new Subject<void>();

  sortColumn: string = 'sequenceNumber';
  sortDirection: SortDirection = 'desc';
  pageSizeOptions: number[] = [25, 50, 100];

  showDeleteConfirm: boolean = false;
  showBulkDeleteConfirm: boolean = false;
  messageToDelete: QueueMessage | null = null;

  statusOptions: { value: MessageStatus | 'all'; label: string }[] = [
    { value: 'all', label: 'All Statuses' },
    { value: 'ready', label: 'Ready' },
    { value: 'retained', label: 'Retained' },
    { value: 'received', label: 'Received' },
    { value: 'poison', label: 'Poison' }
  ];

  ngOnInit(): void {
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  get totalPages(): number {
    return Math.ceil(this.totalMessages / this.pageSize);
  }

  get startItem(): number {
    return this.currentPage * this.pageSize + 1;
  }

  get endItem(): number {
    return Math.min((this.currentPage + 1) * this.pageSize, this.totalMessages);
  }

  get allSelected(): boolean {
    return this.messages.length > 0 && this.selectedMessages.length === this.messages.length;
  }

  get someSelected(): boolean {
    return this.selectedMessages.length > 0 && this.selectedMessages.length < this.messages.length;
  }

  get hasSelection(): boolean {
    return this.selectedMessages.length > 0;
  }

  isSelected(message: QueueMessage): boolean {
    return this.selectedMessages.some(m =>
      m.conversationHandle === message.conversationHandle &&
      m.sequenceNumber === message.sequenceNumber
    );
  }

  onStatusFilterChange(): void {
    this.filterChanged.emit({ status: this.filter.status });
  }

  onTypeFilterChange(): void {
    this.filterChanged.emit({ messageType: this.filter.messageType });
  }

  onSort(column: string): void {
    if (this.sortColumn === column) {
      this.sortDirection = this.sortDirection === 'asc' ? 'desc' : 'asc';
    } else {
      this.sortColumn = column;
      this.sortDirection = 'desc';
    }
    this.sortChanged.emit({ column: this.sortColumn, direction: this.sortDirection });
  }

  getSortIcon(column: string): string {
    if (this.sortColumn !== column) return '⇅';
    return this.sortDirection === 'asc' ? '↑' : '↓';
  }

  onPageSizeChange(): void {
    this.pageChanged.emit({ page: 0, pageSize: this.pageSize });
  }

  goToPage(page: number): void {
    if (page >= 0 && page < this.totalPages) {
      this.pageChanged.emit({ page, pageSize: this.pageSize });
    }
  }

  previousPage(): void {
    this.goToPage(this.currentPage - 1);
  }

  nextPage(): void {
    this.goToPage(this.currentPage + 1);
  }

  onRowClick(message: QueueMessage): void {
    this.viewMessage.emit(message);
  }

  onCheckboxClick(event: Event, message: QueueMessage): void {
    event.stopPropagation();
    this.messageSelected.emit(message);
  }

  onSelectAllClick(event: Event): void {
    event.stopPropagation();
    if (this.allSelected) {
      this.deselectAll.emit();
    } else {
      this.selectAll.emit();
    }
  }

  onBulkDelete(): void {
    this.showBulkDeleteConfirm = true;
  }

  onConfirmBulkDelete(): void {
    this.showBulkDeleteConfirm = false;
    this.deleteMessages.emit(this.selectedMessages);
  }

  onCancelBulkDelete(): void {
    this.showBulkDeleteConfirm = false;
  }

  onBulkMarkReceived(): void {
    this.markAsReceived.emit(this.selectedMessages);
  }

  onBulkExportJson(): void {
    this.exportJson.emit(this.selectedMessages.length > 0 ? this.selectedMessages : this.messages);
  }

  formatAge(seconds: number): string {
    if (seconds < 60) return `${seconds}s`;
    if (seconds < 3600) return `${Math.floor(seconds / 60)}m ${seconds % 60}s`;
    if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ${Math.floor((seconds % 3600) / 60)}m`;
    return `${Math.floor(seconds / 86400)}d ${Math.floor((seconds % 86400) / 3600)}h`;
  }

  formatSize(bytes: number): string {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
  }

  formatTimestamp(date: Date): string {
    const d = new Date(date);
    return d.toLocaleString('en-US', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit'
    });
  }

  getStatusType(status: MessageStatus): string {
    const statusMap: Record<MessageStatus, string> = {
      ready: 'active',
      retained: 'idle',
      received: 'disabled',
      poison: 'poison'
    };
    return statusMap[status] || 'unknown';
  }

  trackByMessage(index: number, message: QueueMessage): string {
    return `${message.conversationHandle}-${message.sequenceNumber}`;
  }
}
