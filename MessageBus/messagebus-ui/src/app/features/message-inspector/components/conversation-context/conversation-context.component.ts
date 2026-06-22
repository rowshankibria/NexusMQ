import { Component, Input } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ConversationContext, DialogState, dialogStateLabels, dialogStateColors } from '../../models';
import { MessageInspectorService } from '../../services';

@Component({
  selector: 'app-conversation-context',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './conversation-context.component.html',
  styleUrls: ['./conversation-context.component.scss']
})
export class ConversationContextComponent {
  @Input() context: ConversationContext | null = null;

  constructor(private inspectorService: MessageInspectorService) {}

  getDialogStateLabel(state: DialogState): string {
    return dialogStateLabels[state] || state;
  }

  getDialogStateColor(state: DialogState): string {
    return dialogStateColors[state] || '#6c757d';
  }

  getDialogStateClass(state: DialogState): string {
    switch (state) {
      case 'conversing':
        return 'state--active';
      case 'disconnected_inbound':
      case 'disconnected_outbound':
        return 'state--warning';
      case 'error':
        return 'state--error';
      case 'closed':
        return 'state--closed';
      default:
        return 'state--unknown';
    }
  }

  formatLifetime(seconds: number | null): string {
    if (seconds === null) return 'Not set';
    return this.inspectorService.formatAge(seconds);
  }

  formatTimestamp(date: Date | string): string {
    return this.inspectorService.formatTimestamp(date);
  }

  copyValue(value: string): void {
    this.inspectorService.copyToClipboard(value);
  }
}
