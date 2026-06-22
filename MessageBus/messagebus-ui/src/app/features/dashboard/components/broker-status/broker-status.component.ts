import { Component, Input } from '@angular/core';
import { CommonModule } from '@angular/common';
import { BrokerStatus } from '../../models';
import { StatusBadgeComponent, StatusType } from '../../../../shared/components/status-badge/status-badge.component';
import { LoadingSpinnerComponent } from '../../../../shared/components/loading-spinner/loading-spinner.component';

@Component({
  selector: 'app-broker-status',
  standalone: true,
  imports: [CommonModule, StatusBadgeComponent, LoadingSpinnerComponent],
  templateUrl: './broker-status.component.html',
  styleUrls: ['./broker-status.component.scss']
})
export class BrokerStatusComponent {
  @Input() brokerStatus: BrokerStatus | null = null;
  @Input() loading: boolean = false;

  get statusType(): StatusType {
    if (!this.brokerStatus) return 'unknown';
    const level = this.brokerStatus.statusLevel.toLowerCase();
    if (level === 'healthy') return 'active';
    if (level === 'warning') return 'warning';
    if (level === 'critical') return 'critical';
    return 'unknown';
  }

  get enabledClass(): string {
    if (!this.brokerStatus) return '';
    return this.brokerStatus.isEnabled ? 'broker-status--enabled' : 'broker-status--disabled';
  }

  get hasWarnings(): boolean {
    return !!this.brokerStatus?.warnings?.length;
  }

  truncateGuid(guid: string): string {
    if (!guid || guid.length <= 8) return guid;
    return guid.substring(0, 8) + '...';
  }
}
