import { Injectable } from '@angular/core';
import { BehaviorSubject } from 'rxjs';

const API_KEY_STORAGE_KEY = 'messagebus_api_key';

@Injectable({
  providedIn: 'root'
})
export class AuthService {
  private apiKeySubject = new BehaviorSubject<string | null>(this.getStoredApiKey());
  apiKey$ = this.apiKeySubject.asObservable();

  constructor() {}

  private getStoredApiKey(): string | null {
    try {
      return localStorage.getItem(API_KEY_STORAGE_KEY);
    } catch {
      return null;
    }
  }

  getApiKey(): string | null {
    return this.apiKeySubject.value;
  }

  setApiKey(apiKey: string): void {
    try {
      localStorage.setItem(API_KEY_STORAGE_KEY, apiKey);
      this.apiKeySubject.next(apiKey);
    } catch (error) {
      console.error('Failed to store API key:', error);
      this.apiKeySubject.next(apiKey);
    }
  }

  clearApiKey(): void {
    try {
      localStorage.removeItem(API_KEY_STORAGE_KEY);
    } catch {
      // Ignore storage errors
    }
    this.apiKeySubject.next(null);
  }

  hasApiKey(): boolean {
    return !!this.apiKeySubject.value;
  }
}
