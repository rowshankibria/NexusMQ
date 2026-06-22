import { Component, Input, Output, EventEmitter, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Subject } from 'rxjs';
import { debounceTime, distinctUntilChanged, takeUntil } from 'rxjs/operators';
import { StatusBadgeComponent } from '../../../../shared/components/status-badge/status-badge.component';
import { Queue, QueueFilter, QueueStatus, QueueSortField, SortDirection } from '../../models';

@Component({
  selector: 'app-queue-list',
  standalone: true,
  imports: [CommonModule, FormsModule, StatusBadgeComponent],
  templateUrl: './queue-list.component.html',
  styleUrls: ['./queue-list.component.scss']
})
export class QueueListComponent implements OnInit, OnDestroy {
  @Input() queues: Queue[] = [];
  @Input() selectedQueue: Queue | null = null;
  @Input() filter: QueueFilter = {
    searchTerm: '',
    status: 'all',
    sortField: 'name',
    sortDirection: 'asc'
  };
  @Input() loading: boolean = false;

  @Output() queueSelected = new EventEmitter<Queue>();
  @Output() filterChanged = new EventEmitter<Partial<QueueFilter>>();
  @Output() refreshRequested = new EventEmitter<void>();

  private destroy$ = new Subject<void>();
  private searchSubject = new Subject<string>();

  searchTerm: string = '';
  statusFilter: QueueStatus | 'all' = 'all';
  sortField: QueueSortField = 'name';
  sortDirection: SortDirection = 'asc';

  statusOptions: { value: QueueStatus | 'all'; label: string }[] = [
    { value: 'all', label: 'All Queues' },
    { value: 'active', label: 'Active' },
    { value: 'idle', label: 'Idle' },
    { value: 'disabled', label: 'Disabled' },
    { value: 'poison', label: 'Has Poison' }
  ];

  sortOptions: { value: QueueSortField; label: string }[] = [
    { value: 'name', label: 'Name' },
    { value: 'messageCount', label: 'Message Count' },
    { value: 'age', label: 'Oldest Age' }
  ];

  ngOnInit(): void {
    this.searchTerm = this.filter.searchTerm;
    this.statusFilter = this.filter.status;
    this.sortField = this.filter.sortField;
    this.sortDirection = this.filter.sortDirection;

    this.searchSubject.pipe(
      debounceTime(300),
      distinctUntilChanged(),
      takeUntil(this.destroy$)
    ).subscribe(searchTerm => {
      this.filterChanged.emit({ searchTerm });
    });
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  onSearchInput(): void {
    this.searchSubject.next(this.searchTerm);
  }

  onClearSearch(): void {
    this.searchTerm = '';
    this.filterChanged.emit({ searchTerm: '' });
  }

  onStatusChange(): void {
    this.filterChanged.emit({ status: this.statusFilter });
  }

  onSortFieldChange(): void {
    this.filterChanged.emit({ sortField: this.sortField });
  }

  onSortDirectionToggle(): void {
    this.sortDirection = this.sortDirection === 'asc' ? 'desc' : 'asc';
    this.filterChanged.emit({ sortDirection: this.sortDirection });
  }

  onQueueClick(queue: Queue): void {
    this.queueSelected.emit(queue);
  }

  onRefresh(): void {
    this.refreshRequested.emit();
  }

  isSelected(queue: Queue): boolean {
    return this.selectedQueue?.queueName === queue.queueName;
  }

  formatAge(seconds: number | null): string {
    if (seconds === null || seconds === undefined) return '-';
    if (seconds < 60) return `${seconds}s`;
    if (seconds < 3600) return `${Math.floor(seconds / 60)}m`;
    if (seconds < 86400) return `${Math.floor(seconds / 3600)}h`;
    return `${Math.floor(seconds / 86400)}d`;
  }

  getQueueCountByStatus(status: QueueStatus | 'all'): number {
    if (status === 'all') return this.queues.length;
    return this.queues.filter(q => q.status === status).length;
  }

  trackByQueueName(index: number, queue: Queue): string {
    return queue.queueName;
  }
}
