import { Injectable, OnDestroy } from '@angular/core';
import { BehaviorSubject, Observable, Subject, interval, of } from 'rxjs';
import { catchError, map, switchMap, takeUntil, tap } from 'rxjs/operators';
import { ApiService } from '../../../core/services/api.service';
import { SignalRService } from '../../../core/services/signalr.service';
import { ConfigService } from '../../../core/services/config.service';
import {
  SystemHealth,
  QueueHealth,
  ThroughputSummary,
  DeadLetterSummary,
  BrokerStatus,
  DashboardState,
  TimeRange
} from '../models';

const initialState: DashboardState = {
  systemHealth: null,
  queueHealthList: [],
  throughput: null,
  deadLetterSummary: null,
  brokerStatus: null,
  loading: false,
  error: null,
  lastUpdated: null
};

@Injectable({
  providedIn: 'root'
})
export class DashboardService implements OnDestroy {
  private destroy$ = new Subject<void>();
  private state = new BehaviorSubject<DashboardState>(initialState);
  private selectedTimeRange = new BehaviorSubject<TimeRange>('1h');

  state$ = this.state.asObservable();
  timeRange$ = this.selectedTimeRange.asObservable();

  constructor(
    private api: ApiService,
    private signalR: SignalRService,
    private config: ConfigService
  ) {
    this.initializeSignalRSubscription();
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
    this.signalR.unsubscribeFromDashboard();
  }

  private initializeSignalRSubscription(): void {
    this.signalR.dashboardUpdate$
      .pipe(takeUntil(this.destroy$))
      .subscribe(update => {
        if (update) {
          this.handleDashboardUpdate(update);
        }
      });
  }

  private handleDashboardUpdate(update: Partial<DashboardState>): void {
    const currentState = this.state.value;
    this.state.next({
      ...currentState,
      ...update,
      lastUpdated: new Date()
    });
  }

  startAutoRefresh(): void {
    this.signalR.subscribeToDashboard();

    interval(this.config.refreshInterval)
      .pipe(
        takeUntil(this.destroy$),
        switchMap(() => this.refreshDashboard())
      )
      .subscribe();
  }

  stopAutoRefresh(): void {
    this.signalR.unsubscribeFromDashboard();
  }

  refreshDashboard(): Observable<void> {
    this.updateState({ loading: true, error: null });

    return this.loadAllDashboardData().pipe(
      tap(() => {
        this.updateState({ loading: false, lastUpdated: new Date() });
      }),
      catchError(error => {
        this.updateState({
          loading: false,
          error: error.message || 'Failed to load dashboard data'
        });
        return of(undefined);
      }),
      map(() => undefined)
    );
  }

  private loadAllDashboardData(): Observable<void> {
    return this.getSystemHealth().pipe(
      switchMap(systemHealth => {
        this.updateState({ systemHealth });
        return this.getQueueHealthList();
      }),
      switchMap(queueHealthList => {
        this.updateState({ queueHealthList });
        return this.getThroughput(this.selectedTimeRange.value);
      }),
      switchMap(throughput => {
        this.updateState({ throughput });
        return this.getDeadLetterSummary();
      }),
      switchMap(deadLetterSummary => {
        this.updateState({ deadLetterSummary });
        return this.getBrokerStatus();
      }),
      tap(brokerStatus => {
        this.updateState({ brokerStatus });
      }),
      map(() => undefined)
    );
  }

  private updateState(partialState: Partial<DashboardState>): void {
    this.state.next({
      ...this.state.value,
      ...partialState
    });
  }

  getSystemHealth(): Observable<SystemHealth> {
    return this.api.get<SystemHealth>('diagnostics/summary').pipe(
      catchError(() => {
        return of({
          overallStatus: 'Unknown',
          totalServices: 0,
          activeConversations: 0,
          totalQueueDepth: 0,
          criticalIssues: 0,
          warnings: 0,
          checkTimestamp: new Date(),
          recommendation: 'Unable to retrieve system health'
        } as SystemHealth);
      })
    );
  }

  getQueueHealthList(): Observable<QueueHealth[]> {
    return this.api.get<QueueHealth[]>('queues').pipe(
      map(queues => queues.map(q => ({
        ...q,
        displayName: this.formatQueueName(q.queueName),
        status: this.determineQueueStatus(q)
      }))),
      catchError(() => of([]))
    );
  }

  private formatQueueName(queueName: string): string {
    return queueName
      .replace(/Queue$/i, '')
      .replace(/([A-Z])/g, ' $1')
      .trim();
  }

  private determineQueueStatus(queue: QueueHealth): 'active' | 'idle' | 'disabled' | 'poison' {
    if (!queue.isReceiveEnabled) return 'disabled';
    if (queue.errors > 0) return 'poison';
    if (queue.messageCount > 0) return 'active';
    return 'idle';
  }

  getThroughput(timeRange: TimeRange): Observable<ThroughputSummary> {
    return this.api.get<ThroughputSummary>(`diagnostics/metrics?timeRange=${timeRange}`).pipe(
      map(data => ({
        ...data,
        timeRange
      })),
      catchError(() => of({
        timeRange,
        dataPoints: [],
        totalReceived: 0,
        totalSent: 0,
        totalProcessed: 0,
        averageThroughput: 0,
        peakThroughput: 0
      }))
    );
  }

  setTimeRange(timeRange: TimeRange): void {
    this.selectedTimeRange.next(timeRange);
    this.getThroughput(timeRange).subscribe(throughput => {
      this.updateState({ throughput });
    });
  }

  getDeadLetterSummary(): Observable<DeadLetterSummary> {
    return this.api.get<DeadLetterSummary>('poison-messages/stats').pipe(
      catchError(() => of({
        poisonMessageCount: 0,
        deadLetterCount: 0,
        oldestPoisonAge: null,
        oldestDeadLetterAge: null,
        recentPoisonMessages: []
      }))
    );
  }

  getBrokerStatus(): Observable<BrokerStatus> {
    return this.api.get<BrokerStatus>('diagnostics/broker').pipe(
      catchError(() => of({
        databaseName: 'Unknown',
        brokerGuid: '',
        status: 'Unknown',
        statusLevel: 'Unknown',
        serverName: 'Unknown',
        isEnabled: false,
        warnings: ['Unable to retrieve broker status']
      } as BrokerStatus))
    );
  }

  getCurrentState(): DashboardState {
    return this.state.value;
  }
}
