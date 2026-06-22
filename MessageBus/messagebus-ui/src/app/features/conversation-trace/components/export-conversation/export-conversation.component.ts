import { Component, Input, Output, EventEmitter } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Conversation, ConversationTimeline, ExportOptions } from '../../models';

@Component({
  selector: 'app-export-conversation',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './export-conversation.component.html',
  styleUrls: ['./export-conversation.component.scss']
})
export class ExportConversationComponent {
  @Input() conversation: Conversation | null = null;
  @Input() timeline: ConversationTimeline | null = null;
  @Input() loading: boolean = false;

  @Output() downloadJson = new EventEmitter<ExportOptions>();
  @Output() downloadCsv = new EventEmitter<ExportOptions>();
  @Output() copyToClipboard = new EventEmitter<void>();

  includeMessageBodies: boolean = true;
  includeStateTransitions: boolean = true;

  copySuccess: boolean = false;
  copyTimeout: ReturnType<typeof setTimeout> | null = null;

  get canExport(): boolean {
    return this.conversation !== null;
  }

  onDownloadJson(): void {
    if (!this.canExport) return;
    this.downloadJson.emit({
      format: 'json',
      includeMessageBodies: this.includeMessageBodies,
      includeStateTransitions: this.includeStateTransitions
    });
  }

  onDownloadCsv(): void {
    if (!this.canExport) return;
    this.downloadCsv.emit({
      format: 'csv',
      includeMessageBodies: this.includeMessageBodies,
      includeStateTransitions: this.includeStateTransitions
    });
  }

  onCopyToClipboard(): void {
    if (!this.canExport || !this.timeline) return;

    const data = JSON.stringify(this.timeline, null, 2);
    navigator.clipboard.writeText(data).then(
      () => {
        this.copySuccess = true;
        if (this.copyTimeout) {
          clearTimeout(this.copyTimeout);
        }
        this.copyTimeout = setTimeout(() => {
          this.copySuccess = false;
        }, 2000);
      },
      error => {
        console.error('Failed to copy:', error);
      }
    );

    this.copyToClipboard.emit();
  }

  get messageCount(): number {
    return this.timeline?.messages?.length || 0;
  }

  get transitionCount(): number {
    return this.timeline?.stateTransitions?.length || 0;
  }

  get estimatedSize(): string {
    if (!this.timeline) return '0 KB';

    let size = 0;

    // Rough estimate based on data
    if (this.includeMessageBodies) {
      this.timeline.messages.forEach(m => {
        size += m.messageSize || 0;
        size += 200; // Metadata overhead
      });
    } else {
      size += this.timeline.messages.length * 200; // Just metadata
    }

    if (this.includeStateTransitions) {
      size += this.timeline.stateTransitions.length * 100;
    }

    size += 500; // Conversation info overhead

    if (size < 1024) return `${size} B`;
    if (size < 1024 * 1024) return `${(size / 1024).toFixed(1)} KB`;
    return `${(size / (1024 * 1024)).toFixed(2)} MB`;
  }
}
