import { Injectable } from '@angular/core';
import { HttpClient, HttpParams, HttpHeaders } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';

export interface ApiOptions {
  params?: HttpParams;
  headers?: HttpHeaders;
}

@Injectable({
  providedIn: 'root'
})
export class ApiService {
  private apiUrl = environment.apiUrl;

  constructor(private http: HttpClient) {}

  get<T>(endpoint: string, options?: ApiOptions): Observable<T> {
    return this.http.get<T>(`${this.apiUrl}${endpoint}`, options);
  }

  post<T>(endpoint: string, body: any, options?: ApiOptions): Observable<T> {
    return this.http.post<T>(`${this.apiUrl}${endpoint}`, body, options);
  }

  put<T>(endpoint: string, body: any, options?: ApiOptions): Observable<T> {
    return this.http.put<T>(`${this.apiUrl}${endpoint}`, body, options);
  }

  delete<T>(endpoint: string, options?: ApiOptions): Observable<T> {
    return this.http.delete<T>(`${this.apiUrl}${endpoint}`, options);
  }
}
