import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';

export type NotificationPriority = 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';

export interface NotificationChannelsPreference {
  push: boolean;
  email: boolean;
  sms: boolean;
}

export interface NotificationPreferenceValue {
  enabled: boolean;
  priority: NotificationPriority;
  channels: NotificationChannelsPreference;
}

export interface NotificationPreferenceSubcategory {
  key: string;
  title: string;
  description: string;
  defaultPreference: NotificationPreferenceValue;
  preference: NotificationPreferenceValue;
  customized: boolean;
}

export interface NotificationPreferenceCategory {
  key: string;
  title: string;
  description: string;
  defaultPreference: NotificationPreferenceValue;
  preference: NotificationPreferenceValue;
  customized: boolean;
  subcategories: NotificationPreferenceSubcategory[];
}

export interface NotificationPreferencesResponse {
  userId: string;
  categories: NotificationPreferenceCategory[];
}

export interface NotificationPreferenceUpdate {
  categoryKey: string;
  subcategoryKey?: string;
  preference: NotificationPreferenceValue;
}

@Injectable({
  providedIn: 'root'
})
export class NotificationPreferencesService {
  private readonly apiBase = `${environment.eventsApiUrl}/api/v1/notification-preferences`;

  constructor(private readonly http: HttpClient) {}

  getPreferences(userId: string): Observable<NotificationPreferencesResponse> {
    return this.http.get<NotificationPreferencesResponse>(`${this.apiBase}/${userId}`);
  }

  updatePreferences(userId: string, preferences: NotificationPreferenceUpdate[]): Observable<NotificationPreferencesResponse> {
    return this.http.put<NotificationPreferencesResponse>(`${this.apiBase}/${userId}`, { preferences });
  }
}
