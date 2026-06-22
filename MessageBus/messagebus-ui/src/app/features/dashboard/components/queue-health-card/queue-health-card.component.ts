import { Component, Input } from '@angular/core';
import { CommonModule } from '@angular/common';
import { QueueHealth } from '../../models';
import { StatusBadgeComponent, StatusType } from '../../../../shared/components/status-badge/status-badge.component';

@Component({
  selector: 'app-queue-health-card',
  standalone: true,
  imports: [CommonModule, StatusBadgeComponent],
  templateUrl: './queue-health-card.component.html',
  styleUrls: ['./queue-health-card.component.scss']
})
export class QueueHealthCardComponent {
  @Input() queue!: QueueHealth;

  get statusType(): StatusType {
    return this.queue.status as StatusType;
  }

  get cardClass(): string {
    return `queue-card--${this.queue.statusLevel.toLowerCase()}`;
  }

  get formattedAge(): string {
    if (!this.queue.oldestMessageAge) return '-';

    const minutes = this.queue.oldestMessageAge;
    if (minutes < 60) return `${minutes}m`;
    if (minutes < 1440) return `${Math.floor(minutes / 60)}h ${minutes % 60}m`;
    return `${Math.floor(minutes / 1440)}d ${Math.floor((minutes % 1440) / 60)}h`;
  }

  get throughputDisplay(): string {
    return `${this.queue.throughputPerMinute}/min`;
  }
}
