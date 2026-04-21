import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { BehaviorSubject, interval, Observable, Subject } from 'rxjs';
import { map, switchMap, takeUntil, tap } from 'rxjs/operators';
import { environment } from '../../../environments/environment';

export interface Notification {
  id: string;
  userId: string;
  eventId: string;
  type: string;
  title: string;
  message: string;
  actorUserId?: string;
  metadataJson?: string;
  acknowledged: boolean;
  createdAt: string;
  acknowledgedAt?: string;
  priority: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
}

export interface NotificationState {
  notifications: Notification[];
  unreadCount: number;
  isLoading: boolean;
}

export interface NotificationResponsePayload {
  status: string;
  sent?: number;
}

export interface NotificationMetadataSchemas {
  [key: string]: string[];
}

@Injectable({
  providedIn: 'root'
})
export class NotificationService {
  private readonly notificationsApiBase = `${environment.eventsApiUrl}/api/v1/notifications`;

  private readonly state$ = new BehaviorSubject<NotificationState>({
    notifications: [],
    unreadCount: 0,
    isLoading: false
  });

  private readonly destroy$ = new Subject<void>();
  private readonly pollingInterval = 10000; // 10 seconds
  private currentUserId: string | null = null;
  private isPolling = false;

  constructor(private readonly http: HttpClient) {}

  /**
   * Start polling for notifications for a given user.
   */
  startPolling(userId: string): void {
    if (this.isPolling && this.currentUserId === userId) {
      return;
    }

    this.currentUserId = userId;
    this.isPolling = true;

    // Immediate load + then start polling
    this.loadNotifications();

    interval(this.pollingInterval)
      .pipe(
        switchMap(() => this.fetchNotifications(userId)),
        takeUntil(this.destroy$)
      )
      .subscribe({
        next: (notifications) => this.updateState(notifications),
        error: (err) => console.error('[NotificationService] Polling error:', err)
      });
  }

  /**
   * Stop polling.
   */
  stopPolling(): void {
    this.isPolling = false;
    this.destroy$.next();
    this.currentUserId = null;
  }

  /**
   * Get the notifications state observable.
   */
  getState(): Observable<NotificationState> {
    return this.state$.asObservable();
  }

  /**
   * Force a refresh of notifications.
   */
  loadNotifications(): void {
    if (!this.currentUserId) {
      return;
    }

    this.state$.next({ ...this.state$.value, isLoading: true });

    this.fetchNotifications(this.currentUserId)
      .subscribe({
        next: (notifications) => {
          this.updateState(notifications);
          this.state$.next({ ...this.state$.value, isLoading: false });
        },
        error: (err) => {
          console.error('[NotificationService] Failed to load notifications:', err);
          this.state$.next({ ...this.state$.value, isLoading: false });
        }
      });
  }

  /**
   * Acknowledge a single notification.
   */
  acknowledge(notificationId: string, userId: string): Observable<void> {
    return this.http
      .post<void>(`${this.notificationsApiBase}/${notificationId}/ack?userId=${userId}`, {})
      .pipe(
        tap(() => {
          this.loadNotifications();
        })
      );
  }

  /**
   * Acknowledge all notifications for a user.
   */
  acknowledgeAll(userId: string): Observable<{ status: string; updated: number }> {
    return this.http.post<{ status: string; updated: number }>(`${this.notificationsApiBase}/${userId}/ack-all`, {}).pipe(
      tap(() => {
        this.loadNotifications();
      })
    );
  }

  sendPushTest(userId: string): Observable<{ status: string }> {
    return this.http.post<{ status: string }>(`${this.notificationsApiBase}/${userId}/test-push`, {});
  }

  sendPushScenarioTests(userId: string): Observable<NotificationResponsePayload> {
    return this.http.post<NotificationResponsePayload>(`${this.notificationsApiBase}/${userId}/test-push-scenarios`, {});
  }

  getMetadataSchemas(): Observable<NotificationMetadataSchemas> {
    return this.http.get<NotificationMetadataSchemas>(`${this.notificationsApiBase}/metadata-schemas`);
  }

  respond(notificationId: string, userId: string, decision: 'ACCEPT' | 'DECLINE'): Observable<void> {
    return this.http.post<void>(
      `${this.notificationsApiBase}/${notificationId}/respond?userId=${encodeURIComponent(userId)}&decision=${decision}`,
      {}
    ).pipe(
      tap(() => this.loadNotifications())
    );
  }

  /**
   * Fetch notifications for a user (internal).
   */
  private fetchNotifications(userId: string): Observable<Notification[]> {
    return this.http.get<Notification[]>(`${this.notificationsApiBase}/${userId}?limit=50&onlyUnread=false`).pipe(
      map((notifications) =>
        notifications.map((n) => ({
          ...n,
          createdAt: n.createdAt
        }))
      )
    );
  }

  /**
   * Update the internal state.
   */
  private updateState(notifications: Notification[]): void {
    const unreadCount = notifications.filter((n) => !n.acknowledged).length;
    this.state$.next({
      notifications: notifications.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()),
      unreadCount,
      isLoading: false
    });
  }
}
