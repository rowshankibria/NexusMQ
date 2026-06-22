import { Component, Input } from '@angular/core';
import { CommonModule } from '@angular/common';
import {
  BrokerStatusSummary,
  DatabaseBrokerStatus,
  ConfigurationWarning,
  HealthLevel,
  healthLevelColors
} from '../../models';

@Component({
  selector: 'app-broker-status-panel',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './broker-status-panel.component.html',
  styleUrls: ['./broker-status-panel.component.scss']
})
export class BrokerStatusPanelComponent {
  @Input() brokerStatus: BrokerStatusSummary | null = null;
  @Input() loading = false;

  getHealthIcon(level: HealthLevel): string {
    switch (level) {
      case 'Healthy':
        return '✓';
      case 'Warning':
        return '⚠';
      case 'Critical':
        return '✕';
      default:
        return '?';
    }
  }

  getHealthColor(level: HealthLevel): string {
    return healthLevelColors[level] || healthLevelColors['Unknown'];
  }

  getHealthLabel(level: HealthLevel): string {
    return level;
  }

  getDatabaseIcon(db: DatabaseBrokerStatus): string {
    return db.isEnabled ? '🗄️' : '⊘';
  }

  getWarningIcon(warning: ConfigurationWarning): string {
    return warning.level === 'Critical' ? '🔴' : '🟡';
  }

  trackByDatabase(index: number, db: DatabaseBrokerStatus): string {
    return db.databaseName;
  }

  trackByWarning(index: number, warning: ConfigurationWarning): string {
    return `${warning.category}-${warning.message}`;
  }
}
