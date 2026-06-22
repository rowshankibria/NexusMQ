import { Injectable, OnDestroy } from '@angular/core';
import { BehaviorSubject, Observable, Subject, of } from 'rxjs';
import { catchError, map, tap, takeUntil } from 'rxjs/operators';
import { ApiService } from '../../../core/services/api.service';
import {
  DiagnosticsState,
  initialDiagnosticsState,
  BrokerStatusSummary,
  TransmissionQueueEntry,
  TransmissionQueueFilter,
  DialogError,
  DialogErrorFilter,
  PerformanceMetrics,
  TimeRange,
  AlertRule,
  AlertRuleFormData,
  HealthCheckResult,
  HealthCheckType,
  DiagnosticsTab
} from '../models';

@Injectable({
  providedIn: 'root'
})
export class DiagnosticsService implements OnDestroy {
  private destroy$ = new Subject<void>();
  private state = new BehaviorSubject<DiagnosticsState>(initialDiagnosticsState);

  state$ = this.state.asObservable();

  constructor(private api: ApiService) {}

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  private updateState(partialState: Partial<DiagnosticsState>): void {
    this.state.next({
      ...this.state.value,
      ...partialState,
      lastUpdated: new Date()
    });
  }

  setActiveTab(tab: DiagnosticsTab): void {
    this.updateState({ activeTab: tab });
  }

  // ============== Broker Status ==============

  loadBrokerStatus(): Observable<BrokerStatusSummary> {
    this.updateState({ brokerStatusLoading: true, error: null });

    return this.api.get<BrokerStatusSummary>('diagnostics/broker').pipe(
      tap(brokerStatus => {
        this.updateState({
          brokerStatus,
          brokerStatusLoading: false
        });
      }),
      catchError(error => {
        this.updateState({
          brokerStatusLoading: false,
          error: error.message || 'Failed to load broker status'
        });
        return of({
          overallHealth: 'Unknown',
          databases: [],
          warnings: [],
          lastChecked: new Date()
        } as BrokerStatusSummary);
      })
    );
  }

  // ============== Transmission Queue ==============

  loadTransmissionQueue(): Observable<TransmissionQueueEntry[]> {
    this.updateState({ transmissionQueueLoading: true, error: null });

    const filter = this.state.value.transmissionQueueFilter;
    const params = new URLSearchParams();

    if (filter.stuckOnly) {
      params.append('stuckOnly', 'true');
    }
    if (filter.targetService) {
      params.append('targetService', filter.targetService);
    }
    if (filter.status !== 'All') {
      params.append('status', filter.status);
    }
    if (filter.minStuckMinutes > 0) {
      params.append('minStuckMinutes', filter.minStuckMinutes.toString());
    }

    const queryString = params.toString();
    const url = `diagnostics/transmission-queue${queryString ? '?' + queryString : ''}`;

    return this.api.get<TransmissionQueueEntry[]>(url).pipe(
      tap(transmissionQueue => {
        this.updateState({
          transmissionQueue,
          transmissionQueueLoading: false
        });
      }),
      catchError(error => {
        this.updateState({
          transmissionQueueLoading: false,
          error: error.message || 'Failed to load transmission queue'
        });
        return of([]);
      })
    );
  }

  setTransmissionQueueFilter(filter: Partial<TransmissionQueueFilter>): void {
    this.updateState({
      transmissionQueueFilter: {
        ...this.state.value.transmissionQueueFilter,
        ...filter
      }
    });
  }

  forceDelivery(entryId: string): Observable<boolean> {
    return this.api.post<{ success: boolean }>(`diagnostics/transmission-queue/${entryId}/force-delivery`, {}).pipe(
      map(response => response.success),
      tap(success => {
        if (success) {
          this.loadTransmissionQueue().subscribe();
        }
      }),
      catchError(error => {
        this.updateState({ error: error.message || 'Failed to force delivery' });
        return of(false);
      })
    );
  }

  deleteTransmissionEntry(entryId: string): Observable<boolean> {
    return this.api.delete<{ success: boolean }>(`diagnostics/transmission-queue/${entryId}`).pipe(
      map(response => response.success),
      tap(success => {
        if (success) {
          const currentQueue = this.state.value.transmissionQueue;
          this.updateState({
            transmissionQueue: currentQueue.filter(e => e.id !== entryId)
          });
        }
      }),
      catchError(error => {
        this.updateState({ error: error.message || 'Failed to delete entry' });
        return of(false);
      })
    );
  }

  // ============== Dialog Errors ==============

  loadDialogErrors(): Observable<DialogError[]> {
    this.updateState({ dialogErrorsLoading: true, error: null });

    const filter = this.state.value.dialogErrorFilter;
    const params = new URLSearchParams();

    if (filter.serviceName) {
      params.append('serviceName', filter.serviceName);
    }
    if (filter.minAgeMinutes > 0) {
      params.append('minAgeMinutes', filter.minAgeMinutes.toString());
    }

    const queryString = params.toString();
    const url = `diagnostics/dialog-errors${queryString ? '?' + queryString : ''}`;

    return this.api.get<DialogError[]>(url).pipe(
      tap(dialogErrors => {
        this.updateState({
          dialogErrors,
          dialogErrorsLoading: false
        });
      }),
      catchError(error => {
        this.updateState({
          dialogErrorsLoading: false,
          error: error.message || 'Failed to load dialog errors'
        });
        return of([]);
      })
    );
  }

  setDialogErrorFilter(filter: Partial<DialogErrorFilter>): void {
    this.updateState({
      dialogErrorFilter: {
        ...this.state.value.dialogErrorFilter,
        ...filter
      }
    });
  }

  endConversation(conversationHandle: string): Observable<boolean> {
    return this.api.post<{ success: boolean }>(`conversations/${conversationHandle}/end`, {}).pipe(
      map(response => response.success),
      tap(success => {
        if (success) {
          const currentErrors = this.state.value.dialogErrors;
          this.updateState({
            dialogErrors: currentErrors.filter(e => e.conversationHandle !== conversationHandle)
          });
        }
      }),
      catchError(error => {
        this.updateState({ error: error.message || 'Failed to end conversation' });
        return of(false);
      })
    );
  }

  deleteDialogError(errorId: string): Observable<boolean> {
    return this.api.delete<{ success: boolean }>(`diagnostics/dialog-errors/${errorId}`).pipe(
      map(response => response.success),
      tap(success => {
        if (success) {
          const currentErrors = this.state.value.dialogErrors;
          this.updateState({
            dialogErrors: currentErrors.filter(e => e.id !== errorId)
          });
        }
      }),
      catchError(error => {
        this.updateState({ error: error.message || 'Failed to delete error' });
        return of(false);
      })
    );
  }

  // ============== Performance Metrics ==============

  loadPerformanceMetrics(timeRange?: TimeRange): Observable<PerformanceMetrics> {
    this.updateState({ metricsLoading: true, error: null });

    const range = timeRange || this.state.value.metricsTimeRange;
    if (timeRange) {
      this.updateState({ metricsTimeRange: timeRange });
    }

    return this.api.get<PerformanceMetrics>(`diagnostics/metrics?timeRange=${range}`).pipe(
      tap(performanceMetrics => {
        this.updateState({
          performanceMetrics,
          metricsLoading: false
        });
      }),
      catchError(error => {
        this.updateState({
          metricsLoading: false,
          error: error.message || 'Failed to load performance metrics'
        });
        return of({
          messageRate: {
            timeRange: range,
            dataPoints: [],
            averageRate: 0,
            peakRate: 0,
            currentRate: 0
          },
          queueDepthTrend: {
            timeRange: range,
            dataPoints: [],
            currentDepth: 0,
            maxDepth: 0,
            minDepth: 0,
            trend: 'Stable'
          },
          slowestQueues: [],
          mostActiveServices: [],
          conversationAgeDistribution: []
        } as PerformanceMetrics);
      })
    );
  }

  setMetricsTimeRange(timeRange: TimeRange): void {
    this.loadPerformanceMetrics(timeRange).subscribe();
  }

  // ============== Alert Rules ==============

  loadAlertRules(): Observable<AlertRule[]> {
    this.updateState({ alertRulesLoading: true, error: null });

    return this.api.get<AlertRule[]>('diagnostics/alerts/rules').pipe(
      tap(alertRules => {
        this.updateState({
          alertRules,
          alertRulesLoading: false
        });
      }),
      catchError(error => {
        this.updateState({
          alertRulesLoading: false,
          error: error.message || 'Failed to load alert rules'
        });
        return of([]);
      })
    );
  }

  createAlertRule(rule: AlertRuleFormData): Observable<AlertRule | null> {
    return this.api.post<AlertRule>('diagnostics/alerts/rules', rule).pipe(
      tap(newRule => {
        const currentRules = this.state.value.alertRules;
        this.updateState({
          alertRules: [...currentRules, newRule],
          editingRule: null
        });
      }),
      catchError(error => {
        this.updateState({ error: error.message || 'Failed to create alert rule' });
        return of(null);
      })
    );
  }

  updateAlertRule(ruleId: string, rule: AlertRuleFormData): Observable<AlertRule | null> {
    return this.api.put<AlertRule>(`diagnostics/alerts/rules/${ruleId}`, rule).pipe(
      tap(updatedRule => {
        const currentRules = this.state.value.alertRules;
        this.updateState({
          alertRules: currentRules.map(r => r.id === ruleId ? updatedRule : r),
          editingRule: null
        });
      }),
      catchError(error => {
        this.updateState({ error: error.message || 'Failed to update alert rule' });
        return of(null);
      })
    );
  }

  deleteAlertRule(ruleId: string): Observable<boolean> {
    return this.api.delete<{ success: boolean }>(`diagnostics/alerts/rules/${ruleId}`).pipe(
      map(response => response.success),
      tap(success => {
        if (success) {
          const currentRules = this.state.value.alertRules;
          this.updateState({
            alertRules: currentRules.filter(r => r.id !== ruleId)
          });
        }
      }),
      catchError(error => {
        this.updateState({ error: error.message || 'Failed to delete alert rule' });
        return of(false);
      })
    );
  }

  toggleAlertRule(ruleId: string, enabled: boolean): Observable<boolean> {
    return this.api.patch<{ success: boolean }>(`diagnostics/alerts/rules/${ruleId}/toggle`, { enabled }).pipe(
      map(response => response.success),
      tap(success => {
        if (success) {
          const currentRules = this.state.value.alertRules;
          this.updateState({
            alertRules: currentRules.map(r =>
              r.id === ruleId ? { ...r, isEnabled: enabled } : r
            )
          });
        }
      }),
      catchError(error => {
        this.updateState({ error: error.message || 'Failed to toggle alert rule' });
        return of(false);
      })
    );
  }

  setEditingRule(rule: AlertRule | null): void {
    this.updateState({ editingRule: rule });
  }

  // ============== Health Checks ==============

  runHealthCheck(checkType: HealthCheckType, parameters?: Record<string, unknown>): Observable<HealthCheckResult | null> {
    this.updateState({ healthCheckRunning: checkType, error: null });

    const body = { checkType, parameters };

    return this.api.post<HealthCheckResult>('diagnostics/health-check', body).pipe(
      tap(result => {
        const currentResults = this.state.value.healthCheckResults;
        const existingIndex = currentResults.findIndex(r => r.checkType === checkType);

        let updatedResults: HealthCheckResult[];
        if (existingIndex >= 0) {
          updatedResults = [...currentResults];
          updatedResults[existingIndex] = result;
        } else {
          updatedResults = [...currentResults, result];
        }

        this.updateState({
          healthCheckResults: updatedResults,
          healthCheckRunning: null
        });
      }),
      catchError(error => {
        this.updateState({
          healthCheckRunning: null,
          error: error.message || 'Failed to run health check'
        });
        return of(null);
      })
    );
  }

  clearHealthCheckResults(): void {
    this.updateState({ healthCheckResults: [] });
  }

  // ============== Utilities ==============

  refreshCurrentTab(): void {
    const tab = this.state.value.activeTab;

    switch (tab) {
      case 'broker-status':
        this.loadBrokerStatus().subscribe();
        break;
      case 'transmission-queue':
        this.loadTransmissionQueue().subscribe();
        break;
      case 'dialog-errors':
        this.loadDialogErrors().subscribe();
        break;
      case 'performance':
        this.loadPerformanceMetrics().subscribe();
        break;
      case 'alerts':
        this.loadAlertRules().subscribe();
        break;
      case 'health-checks':
        // Don't auto-refresh health checks
        break;
    }
  }

  loadAllData(): void {
    this.loadBrokerStatus().pipe(takeUntil(this.destroy$)).subscribe();
    this.loadTransmissionQueue().pipe(takeUntil(this.destroy$)).subscribe();
    this.loadDialogErrors().pipe(takeUntil(this.destroy$)).subscribe();
    this.loadPerformanceMetrics().pipe(takeUntil(this.destroy$)).subscribe();
    this.loadAlertRules().pipe(takeUntil(this.destroy$)).subscribe();
  }

  clearError(): void {
    this.updateState({ error: null });
  }

  getCurrentState(): DiagnosticsState {
    return this.state.value;
  }
}
