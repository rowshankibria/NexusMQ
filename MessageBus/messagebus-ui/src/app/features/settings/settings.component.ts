import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Subject } from 'rxjs';
import { takeUntil } from 'rxjs/operators';
import { AuthService } from '../../core/services';
import { ModeSwitchComponent, ApplicationRegistrationComponent } from './components';
import { SettingsService, UserSettings, AlertPreferences } from './services';

@Component({
  selector: 'app-settings',
  standalone: true,
  imports: [CommonModule, FormsModule, ModeSwitchComponent, ApplicationRegistrationComponent],
  templateUrl: './settings.component.html',
  styleUrls: ['./settings.component.scss']
})
export class SettingsComponent implements OnInit, OnDestroy {
  apiKey = '';
  showApiKey = false;
  userSettings: UserSettings = {
    refreshInterval: 30,
    alertsEnabled: true,
    soundEnabled: false,
    desktopNotifications: false,
    defaultPageSize: 25,
    theme: 'system'
  };
  alertPreferences: AlertPreferences = {
    poisonMessages: true,
    queueDepthWarning: true,
    queueDepthThreshold: 1000,
    systemHealthCritical: true,
    transmissionQueueStuck: true,
    emailNotifications: false,
    emailAddress: ''
  };
  isDirty = false;
  saveMessage = '';
  saveMessageType: 'success' | 'error' = 'success';

  readonly refreshIntervalOptions = [
    { value: 10, label: '10 seconds' },
    { value: 30, label: '30 seconds' },
    { value: 60, label: '1 minute' },
    { value: 120, label: '2 minutes' },
    { value: 300, label: '5 minutes' }
  ];

  readonly pageSizeOptions = [10, 25, 50, 100];

  readonly themeOptions = [
    { value: 'light', label: 'Light' },
    { value: 'dark', label: 'Dark' },
    { value: 'system', label: 'System default' }
  ];

  private destroy$ = new Subject<void>();

  constructor(
    private authService: AuthService,
    private settingsService: SettingsService
  ) {}

  ngOnInit(): void {
    // Load API key
    this.authService.apiKey$
      .pipe(takeUntil(this.destroy$))
      .subscribe(key => {
        this.apiKey = key || '';
      });

    // Load user settings
    this.settingsService.state$
      .pipe(takeUntil(this.destroy$))
      .subscribe(state => {
        this.userSettings = { ...state.userSettings };
        this.alertPreferences = { ...state.alertPreferences };
        this.isDirty = state.isDirty;
      });
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  toggleApiKeyVisibility(): void {
    this.showApiKey = !this.showApiKey;
  }

  onApiKeyChange(): void {
    this.authService.setApiKey(this.apiKey);
    this.showSaveMessage('API key saved', 'success');
  }

  clearApiKey(): void {
    this.apiKey = '';
    this.authService.clearApiKey();
    this.showSaveMessage('API key cleared', 'success');
  }

  onUserSettingsChange(): void {
    this.settingsService.updateUserSettings(this.userSettings);
  }

  onAlertPreferencesChange(): void {
    this.settingsService.updateAlertPreferences(this.alertPreferences);
  }

  saveSettings(): void {
    this.settingsService.saveSettings();
    this.showSaveMessage('Settings saved successfully', 'success');
  }

  resetToDefaults(): void {
    this.settingsService.resetToDefaults();
    this.showSaveMessage('Settings reset to defaults', 'success');
  }

  discardChanges(): void {
    this.settingsService.discardChanges();
    this.showSaveMessage('Changes discarded', 'success');
  }

  private showSaveMessage(message: string, type: 'success' | 'error'): void {
    this.saveMessage = message;
    this.saveMessageType = type;
    setTimeout(() => {
      this.saveMessage = '';
    }, 3000);
  }

  requestNotificationPermission(): void {
    if ('Notification' in window) {
      Notification.requestPermission().then(permission => {
        if (permission === 'granted') {
          this.userSettings.desktopNotifications = true;
          this.onUserSettingsChange();
          this.showSaveMessage('Desktop notifications enabled', 'success');
        } else {
          this.userSettings.desktopNotifications = false;
          this.onUserSettingsChange();
          this.showSaveMessage('Desktop notifications permission denied', 'error');
        }
      });
    }
  }
}
