import { Component, Input } from '@angular/core';
import { CommonModule } from '@angular/common';
import { SystemHealth, HealthLevel } from '../../models';
import { MetricCardComponent } from '../../../../shared/components/metric-card/metric-card.component';
import { StatusBadgeComponent } from '../../../../shared/components/status-badge/status-badge.component';

@Component({
  selector: 'app-system-health-summary',
  standalone: true,
  imports: [CommonModule, MetricCardComponent, StatusBadgeComponent],
  templateUrl: './system-health-summary.component.html',
  styleUrls: ['./system-health-summary.component.scss']
})
export class SystemHealthSummaryComponent {
  @Input() systemHealth: SystemHealth | null = null;
  @Input() loading: boolean = false;

  get statusType(): 'healthy' | 'warning' | 'critical' | 'unknown' {
    if (!this.systemHealth) return 'unknown';
    return this.systemHealth.overallStatus.toLowerCase() as 'healthy' | 'warning' | 'critical' | 'unknown';
  }

  get statusVariant(): 'success' | 'warning' | 'danger' | 'default' {
    const map: Record<HealthLevel, 'success' | 'warning' | 'danger' | 'default'> = {
      Healthy: 'success',
      Warning: 'warning',
      Critical: 'danger',
      Unknown: 'default'
    };
    return this.systemHealth ? map[this.systemHealth.overallStatus] : 'default';
  }

  get issuesVariant(): 'success' | 'warning' | 'danger' | 'default' {
    if (!this.systemHealth) return 'default';
    if (this.systemHealth.criticalIssues > 0) return 'danger';
    if (this.systemHealth.warnings > 0) return 'warning';
    return 'success';
  }
}
