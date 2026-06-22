import { Component, Input } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { DiagnosticsService } from '../../services';
import {
  HealthCheckResult,
  HealthCheckType,
  HealthCheckDetail,
  HealthLevel,
  healthCheckTypeLabels,
  healthLevelColors
} from '../../models';

interface HealthCheckButton {
  type: HealthCheckType;
  label: string;
  description: string;
  icon: string;
  requiresInput?: boolean;
  inputLabel?: string;
  inputPlaceholder?: string;
}

@Component({
  selector: 'app-health-check',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './health-check.component.html',
  styleUrls: ['./health-check.component.scss']
})
export class HealthCheckComponent {
  @Input() results: HealthCheckResult[] = [];
  @Input() runningCheck: HealthCheckType | null = null;

  oldMessagesDays = 30;

  healthChecks: HealthCheckButton[] = [
    {
      type: 'BrokerEnabled',
      label: 'Verify Service Broker',
      description: 'Check if Service Broker is enabled on all databases',
      icon: '🔌'
    },
    {
      type: 'OrphanedConversations',
      label: 'Orphaned Conversations',
      description: 'Find conversations without active endpoints',
      icon: '🔍'
    },
    {
      type: 'OldMessages',
      label: 'Old Messages',
      description: 'Scan for messages older than specified days',
      icon: '📅',
      requiresInput: true,
      inputLabel: 'Days',
      inputPlaceholder: '30'
    },
    {
      type: 'ServiceQueues',
      label: 'Verify Service Queues',
      description: 'Ensure all services have valid queues',
      icon: '📬'
    },
    {
      type: 'ContractValidity',
      label: 'Contract Validity',
      description: 'Check that all contracts are properly configured',
      icon: '📋'
    },
    {
      type: 'MessageTypeDefinitions',
      label: 'Message Type Definitions',
      description: 'Validate all message type definitions',
      icon: '📝'
    }
  ];

  constructor(private diagnosticsService: DiagnosticsService) {}

  runCheck(check: HealthCheckButton): void {
    const parameters: Record<string, unknown> = {};

    if (check.type === 'OldMessages') {
      parameters['days'] = this.oldMessagesDays;
    }

    this.diagnosticsService.runHealthCheck(check.type, parameters).subscribe();
  }

  clearResults(): void {
    this.diagnosticsService.clearHealthCheckResults();
  }

  isRunning(checkType: HealthCheckType): boolean {
    return this.runningCheck === checkType;
  }

  getResult(checkType: HealthCheckType): HealthCheckResult | undefined {
    return this.results.find(r => r.checkType === checkType);
  }

  getStatusIcon(status: HealthLevel): string {
    switch (status) {
      case 'Healthy': return '✓';
      case 'Warning': return '⚠';
      case 'Critical': return '✕';
      default: return '?';
    }
  }

  getStatusColor(status: HealthLevel): string {
    return healthLevelColors[status] || healthLevelColors['Unknown'];
  }

  getStatusClass(status: HealthLevel): string {
    switch (status) {
      case 'Healthy': return 'status-healthy';
      case 'Warning': return 'status-warning';
      case 'Critical': return 'status-critical';
      default: return 'status-unknown';
    }
  }

  formatDuration(ms: number): string {
    if (ms < 1000) return `${ms}ms`;
    return `${(ms / 1000).toFixed(2)}s`;
  }

  trackByCheck(index: number, check: HealthCheckButton): HealthCheckType {
    return check.type;
  }

  trackByResult(index: number, result: HealthCheckResult): HealthCheckType {
    return result.checkType;
  }

  trackByDetail(index: number, detail: HealthCheckDetail): string {
    return detail.item;
  }
}
