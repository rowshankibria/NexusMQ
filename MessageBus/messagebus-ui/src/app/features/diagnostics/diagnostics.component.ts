import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Subject } from 'rxjs';
import { takeUntil } from 'rxjs/operators';
import { DiagnosticsService } from './services';
import {
  DiagnosticsState,
  DiagnosticsTab,
  diagnosticsTabLabels
} from './models';
import { BrokerStatusPanelComponent } from './components/broker-status-panel/broker-status-panel.component';
import { TransmissionQueueComponent } from './components/transmission-queue/transmission-queue.component';
import { DialogErrorsComponent } from './components/dialog-errors/dialog-errors.component';
import { PerformanceMetricsComponent } from './components/performance-metrics/performance-metrics.component';
import { AlertRulesComponent } from './components/alert-rules/alert-rules.component';
import { HealthCheckComponent } from './components/health-check/health-check.component';

@Component({
  selector: 'app-diagnostics',
  standalone: true,
  imports: [
    CommonModule,
    BrokerStatusPanelComponent,
    TransmissionQueueComponent,
    DialogErrorsComponent,
    PerformanceMetricsComponent,
    AlertRulesComponent,
    HealthCheckComponent
  ],
  templateUrl: './diagnostics.component.html',
  styleUrls: ['./diagnostics.component.scss']
})
export class DiagnosticsComponent implements OnInit, OnDestroy {
  private destroy$ = new Subject<void>();

  state: DiagnosticsState | null = null;
  tabs: DiagnosticsTab[] = [
    'broker-status',
    'transmission-queue',
    'dialog-errors',
    'performance',
    'alerts',
    'health-checks'
  ];
  tabLabels = diagnosticsTabLabels;

  constructor(private diagnosticsService: DiagnosticsService) {}

  ngOnInit(): void {
    this.subscribeToState();
    this.loadInitialData();
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  private subscribeToState(): void {
    this.diagnosticsService.state$
      .pipe(takeUntil(this.destroy$))
      .subscribe(state => {
        this.state = state;
      });
  }

  private loadInitialData(): void {
    this.diagnosticsService.loadBrokerStatus().subscribe();
  }

  selectTab(tab: DiagnosticsTab): void {
    this.diagnosticsService.setActiveTab(tab);
    this.diagnosticsService.refreshCurrentTab();
  }

  isActiveTab(tab: DiagnosticsTab): boolean {
    return this.state?.activeTab === tab;
  }

  refresh(): void {
    this.diagnosticsService.refreshCurrentTab();
  }

  dismissError(): void {
    this.diagnosticsService.clearError();
  }

  getTabIcon(tab: DiagnosticsTab): string {
    switch (tab) {
      case 'broker-status':
        return '🔌';
      case 'transmission-queue':
        return '📤';
      case 'dialog-errors':
        return '⚠️';
      case 'performance':
        return '📊';
      case 'alerts':
        return '🔔';
      case 'health-checks':
        return '🩺';
      default:
        return '📋';
    }
  }

  isLoading(): boolean {
    if (!this.state) return false;

    return this.state.brokerStatusLoading ||
           this.state.transmissionQueueLoading ||
           this.state.dialogErrorsLoading ||
           this.state.metricsLoading ||
           this.state.alertRulesLoading ||
           this.state.healthCheckRunning !== null;
  }
}
