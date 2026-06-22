import { Component, Input } from '@angular/core';
import { CommonModule } from '@angular/common';
import { StatusBadgeComponent } from '../../../../shared/components/status-badge/status-badge.component';
import { MetricCardComponent } from '../../../../shared/components/metric-card/metric-card.component';
import { Queue, QueueStatistics } from '../../models';

@Component({
  selector: 'app-queue-detail',
  standalone: true,
  imports: [CommonModule, StatusBadgeComponent, MetricCardComponent],
  templateUrl: './queue-detail.component.html',
  styleUrls: ['./queue-detail.component.scss']
})
export class QueueDetailComponent {
  @Input() queue: Queue | null = null;
  @Input() statistics: QueueStatistics | null = null;

  formatAge(seconds: number | null): string {
    if (seconds === null || seconds === undefined) return '-';
    if (seconds < 60) return `${seconds} sec`;
    if (seconds < 3600) return `${Math.floor(seconds / 60)} min`;
    if (seconds < 86400) return `${Math.floor(seconds / 3600)} hrs`;
    return `${Math.floor(seconds / 86400)} days`;
  }

  formatThroughput(value: number): string {
    if (value === 0) return '0';
    if (value < 1) return `${(value * 60).toFixed(1)}/hr`;
    return `${value.toFixed(1)}/min`;
  }

  getActivationLabel(): string {
    if (!this.queue) return '-';
    if (!this.queue.isActivationEnabled) return 'Disabled';
    if (this.queue.activationProcedure) {
      return this.queue.activationProcedure;
    }
    return 'Enabled';
  }

  getEnqueueStatusLabel(): string {
    return this.queue?.isEnqueueEnabled ? 'Enabled' : 'Disabled';
  }

  getReceiveStatusLabel(): string {
    return this.queue?.isReceiveEnabled ? 'Enabled' : 'Disabled';
  }
}
