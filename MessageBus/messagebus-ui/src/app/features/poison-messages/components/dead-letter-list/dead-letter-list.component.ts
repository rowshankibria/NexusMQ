import { Component, Input, Output, EventEmitter } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { DeadLetterMessage, DeadLetterFilter, DeadLetterReason, DeadLetterSortField, SortDirection, deadLetterReasonLabels } from '../../models';
import { StatusBadgeComponent } from '../../../../shared/components';

@Component({
  selector: 'app-dead-letter-list',
  standalone: true,
  imports: [CommonModule, FormsModule, StatusBadgeComponent],
  templateUrl: './dead-letter-list.component.html',
  styleUrls: ['./dead-letter-list.component.scss']
})
export class DeadLetterListComponent {
  @Input() messages: DeadLetterMessage[] = [];
  @Input() selectedMessages: DeadLetterMessage[] = [];
  @Input() loading: boolean = false;
  @Input() filter: DeadLetterFilter | null = null;
  @Input() queueNames: string[] = [];
  @Input() messageTypes: string[] = [];
  @Input() totalItems: number = 0;
  @Input() currentPage: number = 0;
  @Input() pageSize: number = 25;

  @Output() messageSelected = new EventEmitter<DeadLetterMessage>();
  @Output() messageToggled = new EventEmitter<DeadLetterMessage>();
  @Output() selectAll = new EventEmitter<void>();
  @Output() deselectAll = new EventEmitter<void>();
  @Output() filterChanged = new EventEmitter<Partial<DeadLetterFilter>>();
  @Output() filterReset = new EventEmitter<void>();
  @Output() pageChanged = new EventEmitter<number>();
  @Output() pageSizeChanged = new EventEmitter<number>();
  @Output() resolveMessage = new EventEmitter<{ message: DeadLetterMessage; notes: string }>();
  @Output() editResolutionNotes = new EventEmitter<DeadLetterMessage>();

  pageSizeOptions: number[] = [10, 25, 50, 100];
  reasonOptions: DeadLetterReason[] = ['max_retries_exceeded', 'manual_purge', 'queue_disabled', 'invalid_message', 'processing_error'];
  reasonLabels = deadLetterReasonLabels;

  // Inline editing state
  editingMessageId: number | null = null;
  editingNotes: string = '';

  get allSelected(): boolean {
    return this.messages.length > 0 && this.selectedMessages.length === this.messages.length;
  }

  get someSelected(): boolean {
    return this.selectedMessages.length > 0 && this.selectedMessages.length < this.messages.length;
  }

  get totalPages(): number {
    return Math.ceil(this.totalItems / this.pageSize);
  }

  get startItem(): number {
    return this.currentPage * this.pageSize + 1;
  }

  get endItem(): number {
    return Math.min((this.currentPage + 1) * this.pageSize, this.totalItems);
  }

  isSelected(message: DeadLetterMessage): boolean {
    return this.selectedMessages.some(m => m.id === message.id);
  }

  onRowClick(message: DeadLetterMessage): void {
    this.messageSelected.emit(message);
  }

  onCheckboxChange(event: Event, message: DeadLetterMessage): void {
    event.stopPropagation();
    this.messageToggled.emit(message);
  }

  onSelectAllChange(): void {
    if (this.allSelected) {
      this.deselectAll.emit();
    } else {
      this.selectAll.emit();
    }
  }

  onSearchChange(searchTerm: string): void {
    this.filterChanged.emit({ searchTerm });
  }

  onQueueFilterChange(queueName: string): void {
    this.filterChanged.emit({ queueName });
  }

  onMessageTypeFilterChange(messageType: string): void {
    this.filterChanged.emit({ messageType });
  }

  onReasonFilterChange(reason: DeadLetterReason | 'all'): void {
    this.filterChanged.emit({ reason });
  }

  onSortChange(field: DeadLetterSortField): void {
    if (!this.filter) return;

    const direction: SortDirection = this.filter.sortField === field && this.filter.sortDirection === 'asc'
      ? 'desc'
      : 'asc';

    this.filterChanged.emit({ sortField: field, sortDirection: direction });
  }

  getSortIcon(field: DeadLetterSortField): string {
    if (!this.filter || this.filter.sortField !== field) return '↕';
    return this.filter.sortDirection === 'asc' ? '↑' : '↓';
  }

  onResetFilter(): void {
    this.filterReset.emit();
  }

  onPageSizeChange(): void {
    this.pageSizeChanged.emit(this.pageSize);
  }

  goToPage(page: number): void {
    if (page >= 0 && page < this.totalPages) {
      this.pageChanged.emit(page);
    }
  }

  previousPage(): void {
    this.goToPage(this.currentPage - 1);
  }

  nextPage(): void {
    this.goToPage(this.currentPage + 1);
  }

  // Resolution Notes Editing
  startEditingNotes(event: Event, message: DeadLetterMessage): void {
    event.stopPropagation();
    this.editingMessageId = message.id;
    this.editingNotes = message.resolutionNotes || '';
  }

  saveNotes(event: Event, message: DeadLetterMessage): void {
    event.stopPropagation();
    this.resolveMessage.emit({ message, notes: this.editingNotes });
    this.cancelEditing();
  }

  cancelEditing(): void {
    this.editingMessageId = null;
    this.editingNotes = '';
  }

  isEditing(message: DeadLetterMessage): boolean {
    return this.editingMessageId === message.id;
  }

  getReasonLabel(reason: DeadLetterReason): string {
    return this.reasonLabels[reason] || reason;
  }

  getReasonClass(reason: DeadLetterReason): string {
    switch (reason) {
      case 'max_retries_exceeded': return 'reason-max-retries';
      case 'manual_purge': return 'reason-manual';
      case 'queue_disabled': return 'reason-disabled';
      case 'invalid_message': return 'reason-invalid';
      case 'processing_error': return 'reason-error';
      default: return '';
    }
  }

  formatDate(date: Date | string | null): string {
    if (!date) return '-';
    const d = new Date(date);
    return d.toLocaleString();
  }

  formatAge(date: Date | string | null): string {
    if (!date) return '-';
    const d = new Date(date);
    const now = new Date();
    const diffMs = now.getTime() - d.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMins / 60);
    const diffDays = Math.floor(diffHours / 24);

    if (diffDays > 0) return `${diffDays}d ${diffHours % 24}h`;
    if (diffHours > 0) return `${diffHours}h ${diffMins % 60}m`;
    return `${diffMins}m`;
  }

  trackById(index: number, message: DeadLetterMessage): number {
    return message.id;
  }
}
