import { Component, Input } from '@angular/core';
import { CommonModule } from '@angular/common';

export type MetricTrend = 'up' | 'down' | 'stable' | 'none';
export type MetricVariant = 'default' | 'success' | 'warning' | 'danger' | 'info';

@Component({
  selector: 'app-metric-card',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './metric-card.component.html',
  styleUrls: ['./metric-card.component.scss']
})
export class MetricCardComponent {
  @Input() label: string = '';
  @Input() value: string | number = '';
  @Input() icon: string = '';
  @Input() trend: MetricTrend = 'none';
  @Input() trendValue: string = '';
  @Input() variant: MetricVariant = 'default';
  @Input() subtitle: string = '';
  @Input() loading: boolean = false;

  get variantClass(): string {
    return `metric-card--${this.variant}`;
  }

  get trendIcon(): string {
    const icons: Record<MetricTrend, string> = {
      up: '↑',
      down: '↓',
      stable: '→',
      none: ''
    };
    return icons[this.trend];
  }

  get trendClass(): string {
    return `metric-card__trend--${this.trend}`;
  }
}
