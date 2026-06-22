import { Component, Input } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { DiagnosticsService } from '../../services';
import {
  TransmissionQueueEntry,
  TransmissionQueueFilter,
  TransmissionStatus,
  transmissionStatusLabels
} from '../../models';

@Component({
  selector: 'app-transmission-queue',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './transmission-queue.component.html',
  styleUrls: ['./transmission-queue.component.scss']
})
export class TransmissionQueueComponent {
  @Input() entries: TransmissionQueueEntry[] = [];
  @Input() filter: TransmissionQueueFilter | undefined;
  @Input() loading = false;

  statusOptions: { value: TransmissionStatus | 'All'; label: string }[] = [
    { value: 'All', label: 'All Statuses' },
    { value: 'Pending', label: 'Pending' },
    { value: 'Scheduled', label: 'Scheduled' },
    { value: 'Retrying', label: 'Retrying' },
    { value: 'Failed', label: 'Failed' }
  ];

  selectedEntry: TransmissionQueueEntry | null = null;
  showMessageModal = false;

  constructor(private diagnosticsService: DiagnosticsService) {}

  onStuckOnlyChange(checked: boolean): void {
    this.diagnosticsService.setTransmissionQueueFilter({ stuckOnly: checked });
    this.diagnosticsService.loadTransmissionQueue().subscribe();
  }

  onTargetServiceChange(value: string): void {
    this.diagnosticsService.setTransmissionQueueFilter({ targetService: value });
    this.diagnosticsService.loadTransmissionQueue().subscribe();
  }

  onStatusChange(value: TransmissionStatus | 'All'): void {
    this.diagnosticsService.setTransmissionQueueFilter({ status: value });
    this.diagnosticsService.loadTransmissionQueue().subscribe();
  }

  onMinStuckMinutesChange(value: number): void {
    this.diagnosticsService.setTransmissionQueueFilter({ minStuckMinutes: value });
    this.diagnosticsService.loadTransmissionQueue().subscribe();
  }

  forceDelivery(entry: TransmissionQueueEntry): void {
    if (confirm(`Force delivery of message to ${entry.targetServiceName}?`)) {
      this.diagnosticsService.forceDelivery(entry.id).subscribe();
    }
  }

  deleteEntry(entry: TransmissionQueueEntry): void {
    if (confirm(`Delete this transmission entry? This action cannot be undone.`)) {
      this.diagnosticsService.deleteTransmissionEntry(entry.id).subscribe();
    }
  }

  viewMessage(entry: TransmissionQueueEntry): void {
    this.selectedEntry = entry;
    this.showMessageModal = true;
  }

  closeModal(): void {
    this.showMessageModal = false;
    this.selectedEntry = null;
  }

  getStatusLabel(status: TransmissionStatus): string {
    return transmissionStatusLabels[status] || status;
  }

  getStatusClass(status: TransmissionStatus): string {
    switch (status) {
      case 'Pending':
        return 'status-pending';
      case 'Scheduled':
        return 'status-scheduled';
      case 'Retrying':
        return 'status-retrying';
      case 'Failed':
        return 'status-failed';
      default:
        return '';
    }
  }

  formatDuration(minutes: number): string {
    if (minutes < 60) {
      return `${minutes}m`;
    }
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    if (hours < 24) {
      return `${hours}h ${mins}m`;
    }
    const days = Math.floor(hours / 24);
    const remainingHours = hours % 24;
    return `${days}d ${remainingHours}h`;
  }

  formatSize(bytes: number): string {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
  }

  trackByEntry(index: number, entry: TransmissionQueueEntry): string {
    return entry.id;
  }
}
