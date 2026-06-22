import { Injectable } from '@angular/core';
import { BehaviorSubject, Observable } from 'rxjs';
import { map } from 'rxjs/operators';

export type UserMode = 'simple' | 'advanced';

const USER_MODE_STORAGE_KEY = 'messagebus_user_mode';
const DEFAULT_MODE: UserMode = 'simple';

@Injectable({
  providedIn: 'root'
})
export class UserModeService {
  private modeSubject = new BehaviorSubject<UserMode>(this.getStoredMode());

  /** Observable for reactive mode updates */
  readonly mode$ = this.modeSubject.asObservable();

  constructor() {}

  private getStoredMode(): UserMode {
    try {
      const stored = localStorage.getItem(USER_MODE_STORAGE_KEY);
      if (stored === 'simple' || stored === 'advanced') {
        return stored;
      }
    } catch {
      // Ignore storage errors
    }
    return DEFAULT_MODE;
  }

  /** Get the current user mode */
  getMode(): UserMode {
    return this.modeSubject.value;
  }

  /** Set the user mode and persist to localStorage */
  setMode(mode: UserMode): void {
    try {
      localStorage.setItem(USER_MODE_STORAGE_KEY, mode);
    } catch (error) {
      console.error('Failed to persist user mode:', error);
    }
    this.modeSubject.next(mode);
  }

  /** Check if current mode is Simple Mode */
  isSimpleMode(): boolean {
    return this.modeSubject.value === 'simple';
  }

  /** Check if current mode is Advanced Mode */
  isAdvancedMode(): boolean {
    return this.modeSubject.value === 'advanced';
  }

  /** Observable that emits true when in Simple Mode */
  isSimpleMode$(): Observable<boolean> {
    return this.mode$.pipe(map(mode => mode === 'simple'));
  }

  /** Observable that emits true when in Advanced Mode */
  isAdvancedMode$(): Observable<boolean> {
    return this.mode$.pipe(map(mode => mode === 'advanced'));
  }

  /** Toggle between Simple and Advanced mode */
  toggleMode(): void {
    const newMode: UserMode = this.modeSubject.value === 'simple' ? 'advanced' : 'simple';
    this.setMode(newMode);
  }
}
