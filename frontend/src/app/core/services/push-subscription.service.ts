import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { BehaviorSubject } from 'rxjs';
import { environment } from '../../../environments/environment';

const PUSH_PERM_KEY = 'healthapp.push.permission-asked';

export type PushState = 'granted' | 'unsubscribed' | 'denied' | 'default' | 'unsupported';

export interface PushPermissionStatus {
  permission: NotificationPermission;
  hasSubscription: boolean;
}

@Injectable({
  providedIn: 'root'
})
export class PushSubscriptionService {

  private readonly apiBase = `${environment.eventsApiUrl}/api/v1/push-subscriptions`;
  private readonly vapidPublicKey = environment.vapidPublicKey;

  /**
   * Reflects the real browser push state so components can react reactively.
   * Initialized from the current Notification.permission.
   */
  private readonly pushStateSubject = new BehaviorSubject<PushState>(this.readBrowserState());
  readonly pushState$ = this.pushStateSubject.asObservable();

  /** Convenience: true when browser has granted permission and a subscription is active. */
  get pushEnabled(): boolean {
    return this.pushStateSubject.value === 'granted';
  }

  /** Permission granted but no active subscription (user disabled via toggle). */
  get pushUnsubscribed(): boolean {
    return this.pushStateSubject.value === 'unsubscribed';
  }

  get pushState(): PushState {
    return this.pushStateSubject.value;
  }

  constructor(private readonly http: HttpClient) {
    this.logVapidKeyHealth();
    // Async-correct the initial state: if permission is granted but no active
    // subscription exists, the user previously disabled push via the toggle.
    this.initSubscriptionState();
  }

  private initSubscriptionState(): void {
    if (!this.isPushSupported() || Notification.permission !== 'granted') return;
    navigator.serviceWorker.ready.then((reg) =>
      reg.pushManager.getSubscription().then((sub) => {
        if (!sub) {
          this.pushStateSubject.next('unsubscribed');
        }
      })
    ).catch(() => {});
  }

  /**
   * Returns true if the user has not yet been asked for push permission
   * in this browser (or permission is not already granted/denied).
   */
  shouldAskPermission(): boolean {
    if (!this.isPushSupported()) return false;
    const perm = Notification.permission;
    if (perm === 'granted' || perm === 'denied') return false;
    // Already asked during this session?
    return localStorage.getItem(PUSH_PERM_KEY) !== 'asked';
  }

  markPermissionAsked(): void {
    localStorage.setItem(PUSH_PERM_KEY, 'asked');
  }

  isPushSupported(): boolean {
    const supported = 'Notification' in window && 'serviceWorker' in navigator && 'PushManager' in window;
    console.log('[PushSvc] isPushSupported:', supported, { Notification: 'Notification' in window, serviceWorker: 'serviceWorker' in navigator, PushManager: 'PushManager' in window });
    return supported;
  }

  async requestPermissionAndSubscribe(userId: string): Promise<boolean> {
    console.log('[PushSvc] requestPermissionAndSubscribe() for userId:', userId);
    if (!this.isPushSupported()) {
      console.warn('[PushSvc] Push not supported in this browser');
      return false;
    }
    this.markPermissionAsked();
    console.log('[PushSvc] Requesting notification permission...');
    const permission = await Notification.requestPermission();
    console.log('[PushSvc] Permission result:', permission);
    this.pushStateSubject.next(permission === 'granted' ? 'granted' : permission === 'denied' ? 'denied' : 'default');
    if (permission !== 'granted') {
      console.warn('[PushSvc] Permission not granted:', permission);
      return false;
    }
    return this.subscribe(userId);
  }

  async subscribe(userId: string): Promise<boolean> {
    try {
      console.log('[PushSvc] subscribe() for userId:', userId);
      this.assertValidVapidPublicKey();
      console.log('[PushSvc] Waiting for ServiceWorker ready...');
      const registration = await navigator.serviceWorker.ready;
      console.log('[PushSvc] SW ready, scope:', registration.scope, 'active state:', registration.active?.state);
      const existing = await registration.pushManager.getSubscription();
      console.log('[PushSvc] Existing subscription:', existing ? existing.endpoint.slice(0, 60) + '...' : 'none');
      if (existing) console.log('[PushSvc] Reusing existing subscription');
      else console.log('[PushSvc] Creating new subscription with VAPID key:', this.vapidPublicKey.slice(0, 20) + '...');
      const sub = existing ?? await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: this.urlBase64ToUint8Array(this.vapidPublicKey) as unknown as BufferSource
      });
      console.log('[PushSvc] PushSubscription endpoint:', sub.endpoint.slice(0, 60) + '...');
      console.log('[PushSvc] Sending subscription to backend...');
      await this.sendToBackend(userId, sub).toPromise();
      console.log('[PushSvc] ✅ Subscription registered on backend for userId:', userId);
      return true;
    } catch (err) {
      console.error('[PushSvc] ❌ subscribe() failed:', err);
      return false;
    }
  }

  async unsubscribe(): Promise<void> {
    try {
      const registration = await navigator.serviceWorker.ready;
      const sub = await registration.pushManager.getSubscription();
      if (!sub) return;

      await this.http.delete(`${this.apiBase}?endpoint=${encodeURIComponent(sub.endpoint)}`).toPromise();
      await sub.unsubscribe();
    } catch (err) {
      console.error('[PushSubscriptionService] Failed to unsubscribe:', err);
    }
  }

  private sendToBackend(userId: string, sub: PushSubscription) {
    const json = sub.toJSON();
    return this.http.post(this.apiBase, {
      userId,
      endpoint: sub.endpoint,
      keys: {
        p256dh: json.keys?.['p256dh'] ?? '',
        auth: json.keys?.['auth'] ?? ''
      }
    });
  }

  /**
   * Listen for push messages forwarded by the Service Worker.
   */
  listenForMessages(handler: (payload: PushMessagePayload) => void): () => void {
    if (!('serviceWorker' in navigator)) {
      console.warn('[PushSvc] Service Worker not available');
      return () => {};
    }

    const listener = (event: MessageEvent) => {
      console.log('[PushSvc] SW message event received:', event.data);
      if (event.data?.type === 'PUSH_NOTIFICATION') {
        console.log('[PushSvc] PUSH_NOTIFICATION detected, payload:', event.data.payload);
        handler(event.data.payload as PushMessagePayload);
      } else {
        console.log('[PushSvc] SW message ignored, type:', event.data?.type);
      }
    };

    console.log('[PushSvc] Adding SW message listener');
    navigator.serviceWorker.addEventListener('message', listener);
    return () => {
      console.log('[PushSvc] Removing SW message listener');
      navigator.serviceWorker.removeEventListener('message', listener);
    };
  }

  /**
   * Listen for notification click events forwarded by the Service Worker.
   */
  listenForClicks(handler: (payload: NotificationClickPayload) => void): () => void {
    if (!('serviceWorker' in navigator)) return () => {};

    const listener = (event: MessageEvent) => {
      if (event.data?.type === 'NOTIFICATION_CLICKED') {
        handler(event.data.payload as NotificationClickPayload);
      }
    };

    navigator.serviceWorker.addEventListener('message', listener);
    return () => navigator.serviceWorker.removeEventListener('message', listener);
  }

  /**
   * Enable or disable push from the settings.
   * - enable=true and permission=default  → triggers browser permission prompt
   * - enable=true and permission=granted   → (re-)subscribes the device
   * - enable=true and permission=denied    → no-op (browser blocks it)
   * - enable=false                         → unsubscribes the device
   */
  async setPushEnabled(userId: string, enabled: boolean): Promise<void> {
    if (!enabled) {
      await this.unsubscribe();
      // Keep permission as-is in the browser; mark locally as unsubscribed.
      // The browser permission can only be revoked by the user via browser UI.
      this.pushStateSubject.next('unsubscribed');
      return;
    }

    const current = Notification.permission;
    if (current === 'denied') return;

    if (current === 'granted' || this.pushStateSubject.value === 'unsubscribed') {
      // Re-subscribe without asking for permission again
      await this.subscribe(userId);
      this.pushStateSubject.next('granted');
    } else {
      // permission === 'default': ask the browser
      await this.requestPermissionAndSubscribe(userId);
    }
  }

  private readBrowserState(): PushState {
    if (!this.isPushSupported()) return 'unsupported';
    const p = Notification.permission;
    if (p === 'granted') return 'granted';
    if (p === 'denied') return 'denied';
    return 'default';
  }

  private urlBase64ToUint8Array(base64String: string): Uint8Array {
    const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
    const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
    const rawData = window.atob(base64);
    return Uint8Array.from([...rawData].map((char) => char.charCodeAt(0)));
  }

  private assertValidVapidPublicKey(): void {
    const key = this.vapidPublicKey;
    if (!key || key.includes('CHANGE_ME_GENERATE_WITH_WEB_PUSH')) {
      throw new Error('[PushSvc] Invalid VAPID key: placeholder value detected');
    }

    const bytes = this.urlBase64ToUint8Array(key);
    // VAPID public key must be an uncompressed P-256 EC point (65 bytes, first byte 0x04)
    if (bytes.length !== 65 || bytes[0] !== 0x04) {
      throw new Error(`[PushSvc] Invalid VAPID key format: length=${bytes.length}, firstByte=${bytes[0]}`);
    }
  }

  private logVapidKeyHealth(): void {
    try {
      const bytes = this.urlBase64ToUint8Array(this.vapidPublicKey);
      console.log('[PushSvc] VAPID key loaded:', {
        prefix: this.vapidPublicKey.slice(0, 20) + '...',
        length: bytes.length,
        firstByte: bytes[0]
      });
    } catch (e) {
      console.error('[PushSvc] VAPID key decode failed at startup:', e);
    }
  }
}

export interface PushMessagePayload {
  title: string;
  body: string;
  notificationId?: string;
  userId?: string;
  priority: string;
  type?: string;
  category?: string;
  subcategory?: string;
  metadata?: Record<string, unknown>;
}

export interface NotificationClickPayload {
  notificationId?: string;
  userId?: string;
}
