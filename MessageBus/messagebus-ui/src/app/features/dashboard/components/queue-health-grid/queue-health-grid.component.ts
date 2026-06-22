import { Component, Input } from '@angular/core';
import { CommonModule } from '@angular/common';
import { QueueHealth } from '../../models';
import { QueueHealthCardComponent } from '../queue-health-card/queue-health-card.component';
import { LoadingSpinnerComponent } from '../../../../shared/components/loading-spinner/loading-spinner.component';

@Component({
  selector: 'app-queue-health-grid',
  standalone: true,
  imports: [CommonModule, QueueHealthCardComponent, LoadingSpinnerComponent],
  templateUrl: './queue-health-grid.component.html',
  styleUrls: ['./queue-health-grid.component.scss']
})
export class QueueHealthGridComponent {
  @Input() queues: QueueHealth[] = [];
  @Input() loading: boolean = false;

  get sortedQueues(): QueueHealth[] {
    return [...this.queues].sort((a, b) => {
      const statusOrder = { Critical: 0, Warning: 1, Healthy: 2, Unknown: 3 };
      const aOrder = statusOrder[a.statusLevel as keyof typeof statusOrder] ?? 3;
      const bOrder = statusOrder[b.statusLevel as keyof typeof statusOrder] ?? 3;
      if (aOrder !== bOrder) return aOrder - bOrder;
      return b.messageCount - a.messageCount;
    });
  }

  get healthySummary(): { healthy: number; warning: number; critical: number } {
    return this.queues.reduce(
      (acc, q) => {
        switch (q.statusLevel) {
          case 'Healthy':
            acc.healthy++;
            break;
          case 'Warning':
            acc.warning++;
            break;
          case 'Critical':
            acc.critical++;
            break;
        }
        return acc;
      },
      { healthy: 0, warning: 0, critical: 0 }
    );
  }

  trackByQueueName(index: number, queue: QueueHealth): string {
    return queue.queueName;
  }
}
