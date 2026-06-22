import { Component, Input, Output, EventEmitter } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ConversationMessages, RelatedMessage, DialogState } from '../../models';
import { MessageInspectorService } from '../../services';

@Component({
  selector: 'app-related-messages',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './related-messages.component.html',
  styleUrls: ['./related-messages.component.scss']
})
export class RelatedMessagesComponent {
  @Input() conversationMessages: ConversationMessages | null = null;
  @Input() dialogState: DialogState | null = null;
  @Output() messageSelected = new EventEmitter<RelatedMessage>();
  @Output() navigatePrevious = new EventEmitter<void>();
  @Output() navigateNext = new EventEmitter<void>();

  constructor(private inspectorService: MessageInspectorService) {}

  get currentIndex(): number {
    return this.conversationMessages?.currentIndex ?? -1;
  }

  get totalCount(): number {
    return this.conversationMessages?.totalCount ?? 0;
  }

  get hasPrevious(): boolean {
    return this.currentIndex > 0;
  }

  get hasNext(): boolean {
    return this.currentIndex < this.totalCount - 1;
  }

  get messages(): RelatedMessage[] {
    return this.conversationMessages?.messages ?? [];
  }

  onPrevious(): void {
    if (this.hasPrevious) {
      this.navigatePrevious.emit();
    }
  }

  onNext(): void {
    if (this.hasNext) {
      this.navigateNext.emit();
    }
  }

  onMessageClick(message: RelatedMessage): void {
    this.messageSelected.emit(message);
  }

  isCurrentMessage(index: number): boolean {
    return index === this.currentIndex;
  }

  formatTimestamp(date: Date | string): string {
    return this.inspectorService.formatTimestamp(date);
  }

  formatSize(bytes: number): string {
    return this.inspectorService.formatBytes(bytes);
  }

  getStatusClass(status: string): string {
    switch (status.toLowerCase()) {
      case 'ready':
        return 'status--ready';
      case 'retained':
        return 'status--retained';
      case 'received':
        return 'status--received';
      case 'poison':
        return 'status--poison';
      default:
        return 'status--unknown';
    }
  }

  getDialogStateClass(): string {
    if (!this.dialogState) return '';
    switch (this.dialogState) {
      case 'conversing':
        return 'diagram--conversing';
      case 'disconnected_inbound':
      case 'disconnected_outbound':
        return 'diagram--disconnected';
      case 'error':
        return 'diagram--error';
      case 'closed':
        return 'diagram--closed';
      default:
        return '';
    }
  }

  getDialogStateLabel(): string {
    if (!this.dialogState) return '';
    switch (this.dialogState) {
      case 'conversing':
        return 'Active';
      case 'disconnected_inbound':
        return 'Disconnected (In)';
      case 'disconnected_outbound':
        return 'Disconnected (Out)';
      case 'error':
        return 'Error';
      case 'closed':
        return 'Closed';
      default:
        return this.dialogState;
    }
  }
}
