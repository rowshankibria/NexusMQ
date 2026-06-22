import { Injectable } from '@angular/core';
import { BehaviorSubject, Observable } from 'rxjs';
import { map } from 'rxjs/operators';

export interface UserSettings {
  refreshInterval: number; // in seconds
  alertsEnabled: boolean;
  soundEnabled: boolean;
  desktopNotifications: boolean;
  defaultPageSize: number;
  theme: 'light' | 'dark' | 'system';
}

export interface AlertPreferences {
  poisonMessages: boolean;
  queueDepthWarning: boolean;
  queueDepthThreshold: number;
  systemHealthCritical: boolean;
  transmissionQueueStuck: boolean;
  emailNotifications: boolean;
  emailAddress: string;
}

export interface SettingsState {
  userSettings: UserSettings;
  alertPreferences: AlertPreferences;
  isDirty: boolean;
}

const SETTINGS_STORAGE_KEY = 'messagebus_settings';
const ALERT_PREFS_STORAGE_KEY = 'messagebus_alert_prefs';

const DEFAULT_USER_SETTINGS: UserSettings = {
  refreshInterval: 30,
  alertsEnabled: true,
  soundEnabled: false,
  desktopNotifications: false,
  defaultPageSize: 25,
  theme: 'system'
};

const DEFAULT_ALERT_PREFERENCES: AlertPreferences = {
  poisonMessages: true,
  queueDepthWarning: true,
  queueDepthThreshold: 1000,
  systemHealthCritical: true,
  transmissionQueueStuck: true,
  emailNotifications: false,
  emailAddress: ''
};

@Injectable({
  providedIn: 'root'
})
export class SettingsService {
  private stateSubject = new BehaviorSubject<SettingsState>({
    userSettings: this.loadUserSettings(),
    alertPreferences: this.loadAlertPreferences(),
    isDirty: false
  });

  readonly state$ = this.stateSubject.asObservable();
  readonly userSettings$ = this.state$.pipe(map(s => s.userSettings));
  readonly alertPreferences$ = this.state$.pipe(map(s => s.alertPreferences));
  readonly isDirty$ = this.state$.pipe(map(s => s.isDirty));

  constructor() {}

  private loadUserSettings(): UserSettings {
    try {
      const stored = localStorage.getItem(SETTINGS_STORAGE_KEY);
      if (stored) {
        return { ...DEFAULT_USER_SETTINGS, ...JSON.parse(stored) };
      }
    } catch {
      // Ignore storage errors
    }
    return { ...DEFAULT_USER_SETTINGS };
  }

  private loadAlertPreferences(): AlertPreferences {
    try {
      const stored = localStorage.getItem(ALERT_PREFS_STORAGE_KEY);
      if (stored) {
        return { ...DEFAULT_ALERT_PREFERENCES, ...JSON.parse(stored) };
      }
    } catch {
      // Ignore storage errors
    }
    return { ...DEFAULT_ALERT_PREFERENCES };
  }

  getUserSettings(): UserSettings {
    return this.stateSubject.value.userSettings;
  }

  getAlertPreferences(): AlertPreferences {
    return this.stateSubject.value.alertPreferences;
  }

  updateUserSettings(updates: Partial<UserSettings>): void {
    const currentState = this.stateSubject.value;
    this.stateSubject.next({
      ...currentState,
      userSettings: { ...currentState.userSettings, ...updates },
      isDirty: true
    });
  }

  updateAlertPreferences(updates: Partial<AlertPreferences>): void {
    const currentState = this.stateSubject.value;
    this.stateSubject.next({
      ...currentState,
      alertPreferences: { ...currentState.alertPreferences, ...updates },
      isDirty: true
    });
  }

  saveSettings(): void {
    const { userSettings, alertPreferences } = this.stateSubject.value;
    try {
      localStorage.setItem(SETTINGS_STORAGE_KEY, JSON.stringify(userSettings));
      localStorage.setItem(ALERT_PREFS_STORAGE_KEY, JSON.stringify(alertPreferences));
      this.stateSubject.next({
        ...this.stateSubject.value,
        isDirty: false
      });
    } catch (error) {
      console.error('Failed to save settings:', error);
    }
  }

  resetToDefaults(): void {
    this.stateSubject.next({
      userSettings: { ...DEFAULT_USER_SETTINGS },
      alertPreferences: { ...DEFAULT_ALERT_PREFERENCES },
      isDirty: true
    });
  }

  discardChanges(): void {
    this.stateSubject.next({
      userSettings: this.loadUserSettings(),
      alertPreferences: this.loadAlertPreferences(),
      isDirty: false
    });
  }

  getRefreshInterval(): number {
    return this.stateSubject.value.userSettings.refreshInterval * 1000; // Return in milliseconds
  }

  getRefreshInterval$(): Observable<number> {
    return this.userSettings$.pipe(
      map(settings => settings.refreshInterval * 1000)
    );
  }

  getDefaultPageSize(): number {
    return this.stateSubject.value.userSettings.defaultPageSize;
  }

  isAlertsEnabled(): boolean {
    return this.stateSubject.value.userSettings.alertsEnabled;
  }
}
