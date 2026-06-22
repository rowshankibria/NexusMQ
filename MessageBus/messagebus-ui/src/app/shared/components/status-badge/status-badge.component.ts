import { Component, Input } from '@angular/core';
import { CommonModule } from '@angular/common';

export type StatusType = 'active' | 'idle' | 'disabled' | 'poison' | 'healthy' | 'warning' | 'critical' | 'unknown';

@Component({
  selector: 'app-status-badge',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './status-badge.component.html',
  styleUrls: ['./status-badge.component.scss']
})
export class StatusBadgeComponent {
  @Input() status: StatusType = 'unknown';
  @Input() size: 'small' | 'medium' | 'large' = 'medium';
  @Input() showIcon: boolean = true;

  get statusClass(): string {
    return `status-badge--${this.status}`;
  }

  get sizeClass(): string {
    return `status-badge--${this.size}`;
  }

  get statusIcon(): string {
    const icons: Record<StatusType, string> = {
      active: '●',
      idle: '○',
      disabled: '⊘',
      poison: '⚠',
      healthy: '✓',
      warning: '⚠',
      critical: '✕',
      unknown: '?'
    };
    return icons[this.status];
  }

  get statusLabel(): string {
    return this.status.charAt(0).toUpperCase() + this.status.slice(1);
  }
}
