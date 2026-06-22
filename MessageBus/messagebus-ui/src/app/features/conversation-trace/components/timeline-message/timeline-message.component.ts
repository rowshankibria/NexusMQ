import { Component, Input, Output, EventEmitter } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ConversationMessage } from '../../models';

@Component({
  selector: 'app-timeline-message',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './timeline-message.component.html',
  styleUrls: ['./timeline-message.component.scss']
})
export class TimelineMessageComponent {
  @Input() message!: ConversationMessage;
  @Input() selected: boolean = false;

  @Output() inspect = new EventEmitter<ConversationMessage>();

  onInspectClick(event: MouseEvent): void {
    event.stopPropagation();
    this.inspect.emit(this.message);
  }

  get directionLabel(): string {
    return this.message.direction === 'sent' ? 'Sent' : 'Received';
  }

  get directionIcon(): string {
    return this.message.direction === 'sent' ? '↑' : '↓';
  }

  get processingDurationText(): string {
    if (this.message.processingDuration === null || this.message.processingDuration === undefined) {
      return '-';
    }
    if (this.message.processingDuration < 1000) {
      return `${this.message.processingDuration}ms`;
    }
    return `${(this.message.processingDuration / 1000).toFixed(2)}s`;
  }

  get statusClass(): string {
    switch (this.message.status) {
      case 'pending':
        return 'status-pending';
      case 'sent':
        return 'status-sent';
      case 'received':
        return 'status-received';
      case 'processed':
        return 'status-processed';
      case 'error':
        return 'status-error';
      default:
        return '';
    }
  }

  get statusLabel(): string {
    switch (this.message.status) {
      case 'pending':
        return 'Pending';
      case 'sent':
        return 'Sent';
      case 'received':
        return 'Received';
      case 'processed':
        return 'Processed';
      case 'error':
        return 'Error';
      default:
        return this.message.status;
    }
  }

  get priorityLabel(): string {
    switch (this.message.priority) {
      case 1:
        return 'Low';
      case 2:
        return 'Normal';
      case 3:
        return 'High';
      case 4:
        return 'Urgent';
      default:
        return `Priority ${this.message.priority}`;
    }
  }

  get priorityClass(): string {
    switch (this.message.priority) {
      case 1:
        return 'priority-low';
      case 2:
        return 'priority-normal';
      case 3:
        return 'priority-high';
      case 4:
        return 'priority-urgent';
      default:
        return '';
    }
  }

  formatTimestamp(date: Date | string | null): string {
    if (!date) return '-';
    const d = new Date(date);
    return d.toLocaleString();
  }

  formatSize(bytes: number): string {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
  }

  truncateBody(text: string | null, maxLength: number = 100): string {
    if (!text) return '';
    if (text.length <= maxLength) return text;
    return text.substring(0, maxLength) + '...';
  }
}
