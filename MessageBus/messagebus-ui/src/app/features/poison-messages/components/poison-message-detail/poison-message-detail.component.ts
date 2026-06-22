import { Component, Input, Output, EventEmitter } from '@angular/core';
import { CommonModule } from '@angular/common';
import { PoisonMessageDetail, DeadLetterMessage, RetryHistoryEntry, deadLetterReasonLabels } from '../../models';
import { MessageBodyViewerComponent } from '../../../../shared/components/message-body-viewer/message-body-viewer.component';
import { LoadingSpinnerComponent, StatusBadgeComponent } from '../../../../shared/components';

@Component({
  selector: 'app-poison-message-detail',
  standalone: true,
  imports: [CommonModule, MessageBodyViewerComponent, LoadingSpinnerComponent, StatusBadgeComponent],
  templateUrl: './poison-message-detail.component.html',
  styleUrls: ['./poison-message-detail.component.scss']
})
export class PoisonMessageDetailComponent {
  @Input() poisonMessage: PoisonMessageDetail | null = null;
  @Input() deadLetterMessage: DeadLetterMessage | null = null;
  @Input() loading: boolean = false;
  @Input() operationLoading: boolean = false;

  @Output() close = new EventEmitter<void>();
  @Output() retry = new EventEmitter<number>();
  @Output() purge = new EventEmitter<number>();
  @Output() reEnableQueue = new EventEmitter<string>();

  activeTab: 'details' | 'body' | 'error' | 'history' = 'details';
  reasonLabels = deadLetterReasonLabels;

  get isPoisonMessage(): boolean {
    return this.poisonMessage !== null;
  }

  get message(): PoisonMessageDetail | DeadLetterMessage | null {
    return this.poisonMessage || this.deadLetterMessage;
  }

  get messageBody(): string | null {
    return this.message?.messageBody || null;
  }

  get errorMessage(): string | null {
    if (this.poisonMessage) {
      return this.poisonMessage.errorMessage;
    }
    if (this.deadLetterMessage) {
      return this.deadLetterMessage.errorMessage || null;
    }
    return null;
  }

  get errorTrace(): string | null {
    if (this.poisonMessage) {
      return this.poisonMessage.errorTrace;
    }
    if (this.deadLetterMessage) {
      return this.deadLetterMessage.errorTrace || null;
    }
    return null;
  }

  get retryHistory(): RetryHistoryEntry[] {
    return this.poisonMessage?.retryHistory || [];
  }

  get queueDisabled(): boolean {
    return this.poisonMessage?.queueStatus?.isReceiveEnabled === false;
  }

  onClose(): void {
    this.close.emit();
  }

  onRetry(): void {
    if (this.poisonMessage) {
      this.retry.emit(this.poisonMessage.id);
    }
  }

  onPurge(): void {
    if (this.poisonMessage) {
      this.purge.emit(this.poisonMessage.id);
    }
  }

  onReEnableQueue(): void {
    if (this.poisonMessage) {
      this.reEnableQueue.emit(this.poisonMessage.queueName);
    }
  }

  setActiveTab(tab: 'details' | 'body' | 'error' | 'history'): void {
    this.activeTab = tab;
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

    if (diffDays > 0) return `${diffDays}d ${diffHours % 24}h ago`;
    if (diffHours > 0) return `${diffHours}h ${diffMins % 60}m ago`;
    return `${diffMins}m ago`;
  }

  formatBytes(bytes: number): string {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  }

  getReasonLabel(reason: string): string {
    return this.reasonLabels[reason as keyof typeof this.reasonLabels] || reason;
  }
}
