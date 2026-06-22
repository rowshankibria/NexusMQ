import { Injectable } from '@angular/core';
import { BehaviorSubject, Observable, of } from 'rxjs';
import { catchError, map, tap } from 'rxjs/operators';
import { ApiService } from '../../../core/services';

export interface Application {
  id: number;
  name: string;
  apiKeyMasked: string;
  description?: string;
  isActive: boolean;
  createdAt: string;
  expiresAt?: string;
  permissions: string[];
  allowedQueues: string[];
  contactEmail?: string;
  lastUsedAt?: string;
}

export interface RegisterApplicationRequest {
  name: string;
  description?: string;
  contactEmail?: string;
  expiresAt?: string;
  permissions: string[];
  allowedQueues: string[];
}

export interface UpdateApplicationRequest {
  name?: string;
  description?: string;
  contactEmail?: string;
  isActive?: boolean;
  expiresAt?: string;
  permissions?: string[];
  allowedQueues?: string[];
}

export interface RegisterApplicationResponse {
  id: number;
  name: string;
  apiKey: string; // Full key, shown only once
  description?: string;
  isActive: boolean;
  createdAt: string;
  expiresAt?: string;
  permissions: string[];
  allowedQueues: string[];
  contactEmail?: string;
}

export interface RegenerateKeyResponse {
  id: number;
  name: string;
  apiKey: string; // New key, shown only once
}

interface ApplicationState {
  applications: Application[];
  loading: boolean;
  error: string | null;
}

@Injectable({
  providedIn: 'root'
})
export class ApplicationService {
  private readonly endpoint = 'applications';

  private state = new BehaviorSubject<ApplicationState>({
    applications: [],
    loading: false,
    error: null
  });

  readonly state$ = this.state.asObservable();
  readonly applications$ = this.state$.pipe(map(s => s.applications));
  readonly loading$ = this.state$.pipe(map(s => s.loading));
  readonly error$ = this.state$.pipe(map(s => s.error));

  constructor(private apiService: ApiService) {}

  loadApplications(): Observable<Application[]> {
    this.updateState({ loading: true, error: null });

    return this.apiService.get<Application[]>(this.endpoint).pipe(
      tap(applications => {
        this.updateState({ applications, loading: false });
      }),
      catchError(error => {
        console.error('Failed to load applications', error);
        this.updateState({ loading: false, error: 'Failed to load applications' });
        return of([]);
      })
    );
  }

  getApplication(id: number): Observable<Application | null> {
    return this.apiService.get<Application>(`${this.endpoint}/${id}`).pipe(
      catchError(error => {
        console.error('Failed to get application', error);
        return of(null);
      })
    );
  }

  registerApplication(request: RegisterApplicationRequest): Observable<RegisterApplicationResponse | null> {
    return this.apiService.post<RegisterApplicationResponse>(this.endpoint, request).pipe(
      tap(() => {
        // Reload applications after registration
        this.loadApplications().subscribe();
      }),
      catchError(error => {
        console.error('Failed to register application', error);
        return of(null);
      })
    );
  }

  updateApplication(id: number, request: UpdateApplicationRequest): Observable<Application | null> {
    return this.apiService.put<Application>(`${this.endpoint}/${id}`, request).pipe(
      tap(updated => {
        if (updated) {
          const current = this.state.value.applications;
          const index = current.findIndex(a => a.id === id);
          if (index !== -1) {
            const applications = [...current];
            applications[index] = updated;
            this.updateState({ applications });
          }
        }
      }),
      catchError(error => {
        console.error('Failed to update application', error);
        return of(null);
      })
    );
  }

  deleteApplication(id: number): Observable<boolean> {
    return this.apiService.delete<{ success: boolean }>(`${this.endpoint}/${id}`).pipe(
      tap(result => {
        if (result?.success) {
          const applications = this.state.value.applications.filter(a => a.id !== id);
          this.updateState({ applications });
        }
      }),
      map(result => result?.success ?? false),
      catchError(error => {
        console.error('Failed to delete application', error);
        return of(false);
      })
    );
  }

  regenerateApiKey(id: number): Observable<RegenerateKeyResponse | null> {
    return this.apiService.post<RegenerateKeyResponse>(`${this.endpoint}/${id}/regenerate-key`, {}).pipe(
      tap(() => {
        // Reload applications to get updated masked key
        this.loadApplications().subscribe();
      }),
      catchError(error => {
        console.error('Failed to regenerate API key', error);
        return of(null);
      })
    );
  }

  private updateState(partial: Partial<ApplicationState>): void {
    this.state.next({ ...this.state.value, ...partial });
  }
}
