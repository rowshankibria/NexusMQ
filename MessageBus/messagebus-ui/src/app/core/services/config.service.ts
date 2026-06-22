import { Injectable } from '@angular/core';
import { environment } from '../../../environments/environment';

export interface AppConfig {
  apiUrl: string;
  signalRUrl: string;
  refreshInterval: number;
  defaultPageSize: number;
  maxRetries: number;
}

@Injectable({
  providedIn: 'root'
})
export class ConfigService {
  private config: AppConfig = {
    apiUrl: environment.apiUrl,
    signalRUrl: `${environment.apiUrl}/hubs/messagebus`,
    refreshInterval: 30000,
    defaultPageSize: 25,
    maxRetries: 3
  };

  get apiUrl(): string {
    return this.config.apiUrl;
  }

  get signalRUrl(): string {
    return this.config.signalRUrl;
  }

  get refreshInterval(): number {
    return this.config.refreshInterval;
  }

  get defaultPageSize(): number {
    return this.config.defaultPageSize;
  }

  get maxRetries(): number {
    return this.config.maxRetries;
  }

  getConfig(): AppConfig {
    return { ...this.config };
  }

  updateConfig(updates: Partial<AppConfig>): void {
    this.config = { ...this.config, ...updates };
  }
}
