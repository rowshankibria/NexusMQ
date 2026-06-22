import { Injectable } from '@angular/core';
import { HttpClient, HttpHeaders, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { ConfigService } from './config.service';
import { AuthService } from './auth.service';

export interface RequestOptions {
  params?: HttpParams | { [param: string]: string | string[] };
  headers?: HttpHeaders | { [header: string]: string | string[] };
}

@Injectable({
  providedIn: 'root'
})
export class ApiService {
  constructor(
    private http: HttpClient,
    private configService: ConfigService,
    private authService: AuthService
  ) {}

  private get baseUrl(): string {
    return this.configService.apiUrl;
  }

  private getHeaders(additionalHeaders?: HttpHeaders | { [header: string]: string | string[] }): HttpHeaders {
    let headers = new HttpHeaders({
      'Content-Type': 'application/json'
    });

    const apiKey = this.authService.getApiKey();
    if (apiKey) {
      headers = headers.set('X-API-Key', apiKey);
    }

    if (additionalHeaders) {
      const headersObj = additionalHeaders instanceof HttpHeaders
        ? this.httpHeadersToObject(additionalHeaders)
        : additionalHeaders;

      Object.entries(headersObj).forEach(([key, value]) => {
        headers = headers.set(key, value as string);
      });
    }

    return headers;
  }

  private httpHeadersToObject(headers: HttpHeaders): { [key: string]: string } {
    const result: { [key: string]: string } = {};
    headers.keys().forEach(key => {
      const value = headers.get(key);
      if (value) {
        result[key] = value;
      }
    });
    return result;
  }

  get<T>(endpoint: string, options?: RequestOptions): Observable<T> {
    return this.http.get<T>(`${this.baseUrl}/${endpoint}`, {
      headers: this.getHeaders(options?.headers),
      params: options?.params
    });
  }

  post<T>(endpoint: string, data: unknown, options?: RequestOptions): Observable<T> {
    return this.http.post<T>(`${this.baseUrl}/${endpoint}`, data, {
      headers: this.getHeaders(options?.headers),
      params: options?.params
    });
  }

  put<T>(endpoint: string, data: unknown, options?: RequestOptions): Observable<T> {
    return this.http.put<T>(`${this.baseUrl}/${endpoint}`, data, {
      headers: this.getHeaders(options?.headers),
      params: options?.params
    });
  }

  patch<T>(endpoint: string, data: unknown, options?: RequestOptions): Observable<T> {
    return this.http.patch<T>(`${this.baseUrl}/${endpoint}`, data, {
      headers: this.getHeaders(options?.headers),
      params: options?.params
    });
  }

  delete<T>(endpoint: string, options?: RequestOptions): Observable<T> {
    return this.http.delete<T>(`${this.baseUrl}/${endpoint}`, {
      headers: this.getHeaders(options?.headers),
      params: options?.params
    });
  }
}
