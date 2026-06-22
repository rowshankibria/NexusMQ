import { Injectable } from '@angular/core';
import { BehaviorSubject, Observable, of } from 'rxjs';
import { catchError, map, tap } from 'rxjs/operators';
import { ApiService } from '../../../core/services/api.service';
import {
  InspectedMessage,
  MessageInspectorState,
  MessageFormat,
  ConversationMessages,
  ConversationContext,
  MessageMetadata,
  MessageBody,
  RelatedMessage,
  initialMessageInspectorState
} from '../models';

@Injectable({
  providedIn: 'root'
})
export class MessageInspectorService {
  private state = new BehaviorSubject<MessageInspectorState>(initialMessageInspectorState);
  state$ = this.state.asObservable();

  constructor(private apiService: ApiService) {}

  private updateState(partialState: Partial<MessageInspectorState>): void {
    this.state.next({ ...this.state.value, ...partialState });
  }

  loadMessage(queueName: string, conversationHandle: string): void {
    this.updateState({ loading: true, error: null });

    this.apiService.get<InspectedMessage>(`messages/${queueName}/${conversationHandle}`)
      .pipe(
        tap(message => {
          this.updateState({
            currentMessage: message,
            loading: false
          });
        }),
        catchError(error => {
          this.updateState({
            loading: false,
            error: error.message || 'Failed to load message'
          });
          return of(null);
        })
      )
      .subscribe();
  }

  loadConversationContext(conversationHandle: string): Observable<ConversationContext | null> {
    return this.apiService.get<ConversationContext>(`conversations/${conversationHandle}/context`)
      .pipe(
        tap(context => {
          if (this.state.value.currentMessage) {
            this.updateState({
              currentMessage: {
                ...this.state.value.currentMessage,
                conversationContext: context
              }
            });
          }
        }),
        catchError(error => {
          console.error('Failed to load conversation context:', error);
          return of(null);
        })
      );
  }

  loadRelatedMessages(conversationHandle: string): Observable<ConversationMessages | null> {
    return this.apiService.get<ConversationMessages>(`conversations/${conversationHandle}/messages`)
      .pipe(
        tap(relatedMessages => {
          if (this.state.value.currentMessage) {
            this.updateState({
              currentMessage: {
                ...this.state.value.currentMessage,
                relatedMessages
              }
            });
          }
        }),
        catchError(error => {
          console.error('Failed to load related messages:', error);
          return of(null);
        })
      );
  }

  navigateToMessage(queueName: string, relatedMessage: RelatedMessage): void {
    this.loadMessage(queueName, relatedMessage.conversationHandle);
  }

  navigateToPrevious(): void {
    const current = this.state.value.currentMessage;
    if (!current?.relatedMessages || !current.metadata) return;

    const currentIndex = current.relatedMessages.currentIndex;
    if (currentIndex > 0) {
      const prevMessage = current.relatedMessages.messages[currentIndex - 1];
      this.loadMessage(current.metadata.queueName, prevMessage.conversationHandle);
    }
  }

  navigateToNext(): void {
    const current = this.state.value.currentMessage;
    if (!current?.relatedMessages || !current.metadata) return;

    const currentIndex = current.relatedMessages.currentIndex;
    if (currentIndex < current.relatedMessages.messages.length - 1) {
      const nextMessage = current.relatedMessages.messages[currentIndex + 1];
      this.loadMessage(current.metadata.queueName, nextMessage.conversationHandle);
    }
  }

  setBodyViewMode(mode: 'formatted' | 'raw'): void {
    this.updateState({ bodyViewMode: mode });
  }

  toggleBinaryView(): void {
    this.updateState({ showBinaryView: !this.state.value.showBinaryView });
  }

  detectMessageFormat(content: string | null): MessageFormat {
    if (!content) return 'text';

    const trimmed = content.trim();

    // Check for JSON
    if ((trimmed.startsWith('{') && trimmed.endsWith('}')) ||
        (trimmed.startsWith('[') && trimmed.endsWith(']'))) {
      try {
        JSON.parse(trimmed);
        return 'json';
      } catch {
        // Not valid JSON
      }
    }

    // Check for XML
    if (trimmed.startsWith('<?xml') ||
        (trimmed.startsWith('<') && trimmed.endsWith('>') && !trimmed.startsWith('<!'))) {
      const xmlPattern = /<[a-zA-Z][\w-]*(\s+[a-zA-Z][\w-]*="[^"]*")*\s*\/?>/;
      if (xmlPattern.test(trimmed)) {
        return 'xml';
      }
    }

    // Check for binary (non-printable characters)
    const nonPrintablePattern = /[\x00-\x08\x0B\x0C\x0E-\x1F]/;
    if (nonPrintablePattern.test(content)) {
      return 'binary';
    }

    return 'text';
  }

  formatMessageBody(content: string | null, format: MessageFormat): string {
    if (!content) return '';

    switch (format) {
      case 'json':
        try {
          return JSON.stringify(JSON.parse(content), null, 2);
        } catch {
          return content;
        }
      case 'xml':
        return this.formatXml(content);
      default:
        return content;
    }
  }

  private formatXml(xml: string): string {
    let formatted = '';
    let indent = '';
    const tab = '  ';

    xml.split(/>\s*</).forEach(node => {
      if (node.match(/^\/\w/)) {
        indent = indent.substring(tab.length);
      }
      formatted += indent + '<' + node + '>\n';
      if (node.match(/^<?\w[^>]*[^\/]$/) && !node.startsWith('?')) {
        indent += tab;
      }
    });

    return formatted.substring(1, formatted.length - 2);
  }

  copyToClipboard(content: string): Promise<void> {
    return navigator.clipboard.writeText(content);
  }

  exportToFile(message: InspectedMessage): void {
    if (!message.body.content) return;

    const format = message.body.format;
    const extension = format === 'json' ? 'json' : format === 'xml' ? 'xml' : 'txt';
    const filename = `message_${message.metadata.sequenceNumber}_${Date.now()}.${extension}`;

    const blob = new Blob([message.body.content], { type: 'text/plain;charset=utf-8' });
    const url = window.URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    link.click();
    window.URL.revokeObjectURL(url);
  }

  clearCurrentMessage(): void {
    this.updateState(initialMessageInspectorState);
  }

  formatBytes(bytes: number): string {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  }

  formatTimestamp(date: Date | string): string {
    const d = new Date(date);
    return d.toLocaleString('en-US', {
      year: 'numeric',
      month: 'short',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: false
    });
  }

  formatAge(seconds: number): string {
    if (seconds < 60) return `${seconds}s`;
    if (seconds < 3600) return `${Math.floor(seconds / 60)}m ${seconds % 60}s`;
    if (seconds < 86400) {
      const hours = Math.floor(seconds / 3600);
      const mins = Math.floor((seconds % 3600) / 60);
      return `${hours}h ${mins}m`;
    }
    const days = Math.floor(seconds / 86400);
    const hours = Math.floor((seconds % 86400) / 3600);
    return `${days}d ${hours}h`;
  }
}
