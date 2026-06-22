import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Subject } from 'rxjs';
import { takeUntil } from 'rxjs/operators';
import { DashboardService } from './services/dashboard.service';
import { DashboardState, TimeRange } from './models';
import { LoadingSpinnerComponent } from '../../shared/components/loading-spinner/loading-spinner.component';
import { SystemHealthSummaryComponent } from './components/system-health-summary/system-health-summary.component';
import { QueueHealthGridComponent } from './components/queue-health-grid/queue-health-grid.component';
import { ThroughputChartComponent } from './components/throughput-chart/throughput-chart.component';
import { DeadLetterSummaryComponent } from './components/dead-letter-summary/dead-letter-summary.component';
import { BrokerStatusComponent } from './components/broker-status/broker-status.component';

@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [
    CommonModule,
    LoadingSpinnerComponent,
    SystemHealthSummaryComponent,
    QueueHealthGridComponent,
    ThroughputChartComponent,
    DeadLetterSummaryComponent,
    BrokerStatusComponent
  ],
  templateUrl: './dashboard.component.html',
  styleUrls: ['./dashboard.component.scss']
})
export class DashboardComponent implements OnInit, OnDestroy {
  private destroy$ = new Subject<void>();

  state: DashboardState | null = null;
  selectedTimeRange: TimeRange = '1h';

  constructor(private dashboardService: DashboardService) {}

  ngOnInit(): void {
    this.subscribeToState();
    this.dashboardService.startAutoRefresh();
    this.dashboardService.refreshDashboard().subscribe();
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
    this.dashboardService.stopAutoRefresh();
  }

  private subscribeToState(): void {
    this.dashboardService.state$
      .pipe(takeUntil(this.destroy$))
      .subscribe(state => {
        this.state = state;
      });

    this.dashboardService.timeRange$
      .pipe(takeUntil(this.destroy$))
      .subscribe(timeRange => {
        this.selectedTimeRange = timeRange;
      });
  }

  onRefresh(): void {
    this.dashboardService.refreshDashboard().subscribe();
  }

  onTimeRangeChange(timeRange: TimeRange): void {
    this.dashboardService.setTimeRange(timeRange);
  }
}
