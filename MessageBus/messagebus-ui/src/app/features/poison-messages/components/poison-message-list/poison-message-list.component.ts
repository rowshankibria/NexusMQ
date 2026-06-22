import { Component, Input, Output, EventEmitter } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { PoisonMessage, PoisonMessageFilter, PoisonMessageSortField, SortDirection } from '../../models';
import { StatusBadgeComponent } from '../../../../shared/components';

@Component({
  selector: 'app-poison-message-list',
  standalone: true,
  imports: [CommonModule, FormsModule, StatusBadgeComponent],
  templateUrl: './poison-message-list.component.html',
  styleUrls: ['./poison-message-list.component.scss']
})
export class PoisonMessageListComponent {
  @Input() messages: PoisonMessage[] = [];
  @Input() selectedMessages: PoisonMessage[] = [];
  @Input() loading: boolean = false;
  @Input() filter: PoisonMessageFilter | null = null;
  @Input() queueNames: string[] = [];
  @Input() messageTypes: string[] = [];
  @Input() totalItems: number = 0;
  @Input() currentPage: number = 0;
  @Input() pageSize: number = 25;

  @Output() messageSelected = new EventEmitter<PoisonMessage>();
  @Output() messageToggled = new EventEmitter<PoisonMessage>();
  @Output() selectAll = new EventEmitter<void>();
  @Output() deselectAll = new EventEmitter<void>();
  @Output() filterChanged = new EventEmitter<Partial<PoisonMessageFilter>>();
  @Output() filterReset = new EventEmitter<void>();
  @Output() pageChanged = new EventEmitter<number>();
  @Output() pageSizeChanged = new EventEmitter<number>();
  @Output() retryMessage = new EventEmitter<PoisonMessage>();
  @Output() purgeMessage = new EventEmitter<PoisonMessage>();
  @Output() bulkRetry = new EventEmitter<PoisonMessage[]>();
  @Output() bulkPurge = new EventEmitter<PoisonMessage[]>();

  pageSizeOptions: number[] = [10, 25, 50, 100];

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

  isSelected(message: PoisonMessage): boolean {
    return this.selectedMessages.some(m => m.id === message.id);
  }

  onRowClick(message: PoisonMessage): void {
    this.messageSelected.emit(message);
  }

  onCheckboxChange(event: Event, message: PoisonMessage): void {
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

  onSortChange(field: PoisonMessageSortField): void {
    if (!this.filter) return;

    const direction: SortDirection = this.filter.sortField === field && this.filter.sortDirection === 'asc'
      ? 'desc'
      : 'asc';

    this.filterChanged.emit({ sortField: field, sortDirection: direction });
  }

  getSortIcon(field: PoisonMessageSortField): string {
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

  onRetryClick(event: Event, message: PoisonMessage): void {
    event.stopPropagation();
    this.retryMessage.emit(message);
  }

  onPurgeClick(event: Event, message: PoisonMessage): void {
    event.stopPropagation();
    this.purgeMessage.emit(message);
  }

  onBulkRetry(): void {
    this.bulkRetry.emit(this.selectedMessages);
  }

  onBulkPurge(): void {
    this.bulkPurge.emit(this.selectedMessages);
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

  trackById(index: number, message: PoisonMessage): number {
    return message.id;
  }
}
