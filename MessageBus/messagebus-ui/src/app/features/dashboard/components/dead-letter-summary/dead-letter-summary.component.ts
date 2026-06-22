import { Component, Input } from '@angular/core';
import { CommonModule } from '@angular/common';
import { DeadLetterSummary, PoisonMessageInfo } from '../../models';
import { LoadingSpinnerComponent } from '../../../../shared/components/loading-spinner/loading-spinner.component';

@Component({
  selector: 'app-dead-letter-summary',
  standalone: true,
  imports: [CommonModule, LoadingSpinnerComponent],
  templateUrl: './dead-letter-summary.component.html',
  styleUrls: ['./dead-letter-summary.component.scss']
})
export class DeadLetterSummaryComponent {
  @Input() summary: DeadLetterSummary | null = null;
  @Input() loading: boolean = false;

  get hasIssues(): boolean {
    if (!this.summary) return false;
    return this.summary.poisonMessageCount > 0 || this.summary.deadLetterCount > 0;
  }

  get statusClass(): string {
    if (!this.summary) return '';
    if (this.summary.poisonMessageCount > 0) return 'dead-letter-summary--critical';
    if (this.summary.deadLetterCount > 0) return 'dead-letter-summary--warning';
    return 'dead-letter-summary--healthy';
  }

  formatAge(minutes: number | null): string {
    if (minutes === null) return '-';
    if (minutes < 60) return `${minutes}m`;
    if (minutes < 1440) return `${Math.floor(minutes / 60)}h ${minutes % 60}m`;
    return `${Math.floor(minutes / 1440)}d ${Math.floor((minutes % 1440) / 60)}h`;
  }

  formatTimestamp(timestamp: Date): string {
    return new Date(timestamp).toLocaleString();
  }

  truncateMessage(message: string, maxLength: number = 50): string {
    if (message.length <= maxLength) return message;
    return message.substring(0, maxLength) + '...';
  }

  trackByPoisonId(index: number, item: PoisonMessageInfo): string {
    return item.id;
  }
}
