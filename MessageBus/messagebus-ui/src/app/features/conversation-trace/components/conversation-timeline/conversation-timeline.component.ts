import { Component, Input, Output, EventEmitter } from '@angular/core';
import { CommonModule } from '@angular/common';
import {
  ConversationTimeline,
  ConversationMessage,
  StateTransition,
  conversationStateLabels,
  conversationStateColors,
  ConversationState
} from '../../models';
import { TimelineMessageComponent } from '../timeline-message/timeline-message.component';

@Component({
  selector: 'app-conversation-timeline',
  standalone: true,
  imports: [CommonModule, TimelineMessageComponent],
  templateUrl: './conversation-timeline.component.html',
  styleUrls: ['./conversation-timeline.component.scss']
})
export class ConversationTimelineComponent {
  @Input() timeline: ConversationTimeline | null = null;
  @Input() loading: boolean = false;
  @Input() selectedMessage: ConversationMessage | null = null;

  @Output() messageSelected = new EventEmitter<ConversationMessage>();
  @Output() messageInspect = new EventEmitter<ConversationMessage>();

  stateLabels = conversationStateLabels;
  stateColors = conversationStateColors;

  hoveredMessage: ConversationMessage | null = null;
  hoverPosition: { x: number; y: number } = { x: 0, y: 0 };

  get timelineItems(): Array<{ type: 'message' | 'transition'; data: ConversationMessage | StateTransition; timestamp: Date }> {
    if (!this.timeline) return [];

    const items: Array<{ type: 'message' | 'transition'; data: ConversationMessage | StateTransition; timestamp: Date }> = [];

    // Add messages
    this.timeline.messages.forEach(message => {
      items.push({
        type: 'message',
        data: message,
        timestamp: new Date(message.sentTimestamp)
      });
    });

    // Add state transitions
    this.timeline.stateTransitions.forEach(transition => {
      items.push({
        type: 'transition',
        data: transition,
        timestamp: new Date(transition.transitionTime)
      });
    });

    // Sort by timestamp
    items.sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime());

    return items;
  }

  onMessageClick(message: ConversationMessage): void {
    this.messageSelected.emit(message);
  }

  onMessageInspect(message: ConversationMessage): void {
    this.messageInspect.emit(message);
  }

  onMessageHover(event: MouseEvent, message: ConversationMessage | null): void {
    if (message) {
      this.hoveredMessage = message;
      this.hoverPosition = { x: event.clientX, y: event.clientY };
    } else {
      this.hoveredMessage = null;
    }
  }

  isMessageSelected(message: ConversationMessage): boolean {
    return this.selectedMessage?.id === message.id;
  }

  isMessage(item: { type: 'message' | 'transition'; data: unknown }): item is { type: 'message'; data: ConversationMessage } {
    return item.type === 'message';
  }

  isTransition(item: { type: 'message' | 'transition'; data: unknown }): item is { type: 'transition'; data: StateTransition } {
    return item.type === 'transition';
  }

  asMessage(data: unknown): ConversationMessage {
    return data as ConversationMessage;
  }

  asTransition(data: unknown): StateTransition {
    return data as StateTransition;
  }

  getTransitionLabel(transition: StateTransition): string {
    if (!transition.fromState) {
      return `Started: ${this.stateLabels[transition.toState]}`;
    }
    return `${this.stateLabels[transition.fromState]} → ${this.stateLabels[transition.toState]}`;
  }

  getTransitionStateColor(state: ConversationState): string {
    return this.stateColors[state] || 'info';
  }

  formatTime(date: Date | string): string {
    const d = new Date(date);
    return d.toLocaleTimeString();
  }

  formatDate(date: Date | string): string {
    const d = new Date(date);
    return d.toLocaleDateString();
  }

  formatDateTime(date: Date | string): string {
    const d = new Date(date);
    return d.toLocaleString();
  }

  formatSize(bytes: number): string {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
  }

  trackByTimestamp(index: number, item: { timestamp: Date }): number {
    return item.timestamp.getTime();
  }
}
