import { Component, Input, Output, EventEmitter, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import {
  Conversation,
  ConversationFilter,
  ConversationState,
  ConversationSortField,
  SortDirection,
  conversationStateLabels,
  conversationStateColors
} from '../../models';
import { StatusBadgeComponent } from '../../../../shared/components';

@Component({
  selector: 'app-conversation-list',
  standalone: true,
  imports: [CommonModule, FormsModule, StatusBadgeComponent],
  templateUrl: './conversation-list.component.html',
  styleUrls: ['./conversation-list.component.scss']
})
export class ConversationListComponent implements OnInit, OnDestroy {
  @Input() conversations: Conversation[] = [];
  @Input() selectedConversation: Conversation | null = null;
  @Input() filter: ConversationFilter | null = null;
  @Input() loading: boolean = false;
  @Input() totalCount: number = 0;
  @Input() currentPage: number = 0;
  @Input() pageSize: number = 25;
  @Input() services: string[] = [];

  @Output() conversationSelected = new EventEmitter<Conversation>();
  @Output() filterChanged = new EventEmitter<Partial<ConversationFilter>>();
  @Output() filterReset = new EventEmitter<void>();
  @Output() pageChanged = new EventEmitter<number>();
  @Output() pageSizeChanged = new EventEmitter<number>();
  @Output() sortChanged = new EventEmitter<{ field: ConversationSortField; direction: SortDirection }>();

  stateLabels = conversationStateLabels;
  stateColors = conversationStateColors;

  // Filter values
  stateFilter: ConversationState | 'all' | 'active' | 'closed' | 'error' = 'all';
  dateFrom: string = '';
  dateTo: string = '';
  searchTerm: string = '';
  initiatorServiceFilter: string = '';
  targetServiceFilter: string = '';

  // Sort state
  currentSortField: ConversationSortField = 'lastActivity';
  currentSortDirection: SortDirection = 'desc';

  private searchDebounce: ReturnType<typeof setTimeout> | null = null;

  stateOptions = [
    { value: 'all', label: 'All States' },
    { value: 'active', label: 'Active' },
    { value: 'closed', label: 'Closed' },
    { value: 'error', label: 'Error' },
    { value: 'CO', label: 'Conversing' },
    { value: 'SO', label: 'Started Outbound' },
    { value: 'SI', label: 'Started Inbound' },
    { value: 'DI', label: 'Disconnected Inbound' },
    { value: 'DO', label: 'Disconnected Outbound' },
    { value: 'CD', label: 'Closed' },
    { value: 'ER', label: 'Error' }
  ];

  pageSizeOptions = [10, 25, 50, 100];

  ngOnInit(): void {
    if (this.filter) {
      this.stateFilter = this.filter.state;
      this.searchTerm = this.filter.searchTerm;
      this.initiatorServiceFilter = this.filter.initiatorService;
      this.targetServiceFilter = this.filter.targetService;
      this.currentSortField = this.filter.sortField;
      this.currentSortDirection = this.filter.sortDirection;
      if (this.filter.dateFrom) {
        this.dateFrom = this.formatDateForInput(this.filter.dateFrom);
      }
      if (this.filter.dateTo) {
        this.dateTo = this.formatDateForInput(this.filter.dateTo);
      }
    }
  }

  ngOnDestroy(): void {
    if (this.searchDebounce) {
      clearTimeout(this.searchDebounce);
    }
  }

  onStateFilterChange(): void {
    this.filterChanged.emit({ state: this.stateFilter });
  }

  onDateFromChange(): void {
    const dateFrom = this.dateFrom ? new Date(this.dateFrom) : null;
    this.filterChanged.emit({ dateFrom });
  }

  onDateToChange(): void {
    const dateTo = this.dateTo ? new Date(this.dateTo) : null;
    this.filterChanged.emit({ dateTo });
  }

  onSearchChange(): void {
    if (this.searchDebounce) {
      clearTimeout(this.searchDebounce);
    }
    this.searchDebounce = setTimeout(() => {
      this.filterChanged.emit({ searchTerm: this.searchTerm });
    }, 300);
  }

  onInitiatorServiceChange(): void {
    this.filterChanged.emit({ initiatorService: this.initiatorServiceFilter });
  }

  onTargetServiceChange(): void {
    this.filterChanged.emit({ targetService: this.targetServiceFilter });
  }

  onResetFilters(): void {
    this.stateFilter = 'all';
    this.dateFrom = '';
    this.dateTo = '';
    this.searchTerm = '';
    this.initiatorServiceFilter = '';
    this.targetServiceFilter = '';
    this.filterReset.emit();
  }

  onSort(field: ConversationSortField): void {
    if (this.currentSortField === field) {
      this.currentSortDirection = this.currentSortDirection === 'asc' ? 'desc' : 'asc';
    } else {
      this.currentSortField = field;
      this.currentSortDirection = 'desc';
    }
    this.sortChanged.emit({ field: this.currentSortField, direction: this.currentSortDirection });
  }

  getSortIcon(field: ConversationSortField): string {
    if (this.currentSortField !== field) {
      return '↕';
    }
    return this.currentSortDirection === 'asc' ? '↑' : '↓';
  }

  selectConversation(conversation: Conversation): void {
    this.conversationSelected.emit(conversation);
  }

  isSelected(conversation: Conversation): boolean {
    return this.selectedConversation?.conversationHandle === conversation.conversationHandle;
  }

  onPageChange(page: number): void {
    this.pageChanged.emit(page);
  }

  onPageSizeChange(): void {
    this.pageSizeChanged.emit(this.pageSize);
  }

  getStateStatus(state: ConversationState): string {
    const colorMap: Record<string, string> = {
      'info': 'active',
      'warning': 'idle',
      'success': 'healthy',
      'danger': 'poison'
    };
    return colorMap[this.stateColors[state]] || 'active';
  }

  formatDate(date: Date | null | undefined): string {
    if (!date) return '-';
    const d = new Date(date);
    return d.toLocaleString();
  }

  formatAge(date: Date | null | undefined): string {
    if (!date) return '-';
    const now = new Date();
    const d = new Date(date);
    const diffMs = now.getTime() - d.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMins / 60);
    const diffDays = Math.floor(diffHours / 24);

    if (diffDays > 0) {
      return `${diffDays}d ${diffHours % 24}h`;
    }
    if (diffHours > 0) {
      return `${diffHours}h ${diffMins % 60}m`;
    }
    return `${diffMins}m`;
  }

  get totalPages(): number {
    return Math.ceil(this.totalCount / this.pageSize);
  }

  get pageNumbers(): number[] {
    const pages: number[] = [];
    const maxVisible = 5;
    let start = Math.max(0, this.currentPage - Math.floor(maxVisible / 2));
    const end = Math.min(this.totalPages, start + maxVisible);
    start = Math.max(0, end - maxVisible);

    for (let i = start; i < end; i++) {
      pages.push(i);
    }
    return pages;
  }

  private formatDateForInput(date: Date): string {
    const d = new Date(date);
    return d.toISOString().split('T')[0];
  }

  trackByHandle(index: number, conversation: Conversation): string {
    return conversation.conversationHandle;
  }
}
