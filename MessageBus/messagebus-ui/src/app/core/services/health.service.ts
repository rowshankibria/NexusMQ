import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { ApiService } from './api.service';

export interface HealthCheckResult {
  overallStatus: string;
  criticalIssues: number;
  warnings: number;
  checkTimestamp: Date;
  recommendation: string;
  brokerStatus: BrokerStatus | null;
  queueHealth: QueueHealth[];
}

export interface BrokerStatus {
  databaseName: string;
  brokerGuid: string;
  status: string;
  statusLevel: string;
  serverName: string;
}

export interface QueueHealth {
  queueName: string;
  isReceiveEnabled: boolean;
  isActivationEnabled: boolean;
  receiveStatus: string;
  statusLevel: string;
  approxMessageCount: number;
}

@Injectable({
  providedIn: 'root'
})
export class HealthService {
  constructor(private api: ApiService) {}

  getHealthCheck(): Observable<HealthCheckResult> {
    return this.api.get<HealthCheckResult>('health');
  }

  ping(): Observable<{ status: string; timestamp: Date; service: string }> {
    return this.api.get('health/ping');
  }
}
