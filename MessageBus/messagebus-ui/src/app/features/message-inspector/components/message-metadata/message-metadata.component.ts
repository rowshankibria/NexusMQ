import { Component, Input } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MessageMetadata } from '../../models';
import { MessageInspectorService } from '../../services';

@Component({
  selector: 'app-message-metadata',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './message-metadata.component.html',
  styleUrls: ['./message-metadata.component.scss']
})
export class MessageMetadataComponent {
  @Input() metadata: MessageMetadata | null = null;

  constructor(private inspectorService: MessageInspectorService) {}

  formatTimestamp(date: Date | string): string {
    return this.inspectorService.formatTimestamp(date);
  }

  formatSize(bytes: number): string {
    return this.inspectorService.formatBytes(bytes);
  }

  copyValue(value: string): void {
    this.inspectorService.copyToClipboard(value);
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

  getPriorityClass(priority: number): string {
    if (priority <= 3) return 'priority--high';
    if (priority <= 6) return 'priority--medium';
    return 'priority--low';
  }
}
