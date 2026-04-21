import {
  Component,
  NgZone,
  OnDestroy,
  OnInit,
  inject
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { TranslateModule } from '@ngx-translate/core';
import { Subject, takeUntil } from 'rxjs';
import { PushSubscriptionService, PushMessagePayload } from '../../../core/services/push-subscription.service';
import { Notification, NotificationService } from '../../../core/services/notification.service';
import { AuthService } from '../../../core/services/auth.service';
import { ConnectedPractitionerResolverService } from '../../../core/services/connected-practitioner-resolver.service';
import { trigger, transition, style, animate } from '@angular/animations';

export interface PushToast {
  id: string;
  title: string;
  body: string;
  priority: string;
  type?: string;
  category?: string;
  subcategory?: string;
  metadata?: Record<string, unknown>;
  icon: string;
  actions: PushToastAction[];
  notificationId?: string;
  userId?: string;
}

interface PushToastAction {
  key: string;
  labelKey: string;
  kind: 'link' | 'decision';
  route?: string;
  url?: string;
  queryParams?: Record<string, string>;
  decision?: 'ACCEPT' | 'DECLINE';
}

@Component({
  selector: 'app-push-notification-toast',
  standalone: true,
  imports: [CommonModule, TranslateModule],
  animations: [
    trigger('toastAnim', [
      transition(':enter', [
        style({ opacity: 0, transform: 'translateX(100%)' }),
        animate('280ms ease-out', style({ opacity: 1, transform: 'translateX(0)' }))
      ]),
      transition(':leave', [
        animate('200ms ease-in', style({ opacity: 0, transform: 'translateX(100%)' }))
      ])
    ])
  ],
  template: `
    <div class="push-toast-stack" aria-live="polite" aria-label="Notifications push">
      @for (toast of toasts; track toast.id) {
        <div
          class="push-toast"
          [class.priority-critical]="toast.priority === 'CRITICAL'"
          [class.priority-high]="toast.priority === 'HIGH'"
          [class.priority-medium]="toast.priority === 'MEDIUM'"
          [class.priority-low]="toast.priority === 'LOW'"
          [@toastAnim]
          role="alert"
        >
          <div class="push-toast__priority-bar"></div>
          <div class="push-toast__content">
            <div class="push-toast__title-row">
              <span class="push-toast__icon" aria-hidden="true">{{ toast.icon }}</span>
              <p class="push-toast__title">{{ toast.title }}</p>
            </div>
            <p class="push-toast__body">{{ toast.body }}</p>

            @if (toast.actions.length > 0) {
              <div class="push-toast__actions">
                @for (action of toast.actions; track action.key) {
                  <button
                    type="button"
                    class="push-toast__action-btn"
                    [class.push-toast__action-btn--danger]="action.decision === 'DECLINE'"
                    (click)="handleToastAction(toast, action)"
                  >
                    {{ action.labelKey | translate }}
                  </button>
                }
              </div>
            }
          </div>
          <button
            class="push-toast__close"
            [attr.aria-label]="'push.toast.close' | translate"
            (click)="dismiss(toast)"
          >✕</button>
        </div>
      }
    </div>
  `,
  styles: [`
    .push-toast-stack {
      position: fixed;
      top: 1.25rem;
      right: 1.25rem;
      z-index: 9998;
      display: flex;
      flex-direction: column;
      gap: 0.6rem;
      max-width: 360px;
      pointer-events: none;
    }

    .push-toast {
      display: flex;
      align-items: stretch;
      background: var(--card-bg);
      border: 1px solid var(--border-color);
      border-radius: 10px;
      box-shadow: 0 6px 24px rgba(0, 0, 0, 0.16);
      overflow: hidden;
      pointer-events: all;
      min-width: 280px;
    }

    .push-toast__priority-bar {
      width: 5px;
      flex-shrink: 0;
    }

    .push-toast.priority-critical .push-toast__priority-bar { background: #ef4444; }
    .push-toast.priority-high    .push-toast__priority-bar { background: #f97316; }
    .push-toast.priority-medium  .push-toast__priority-bar { background: #eab308; }
    .push-toast.priority-low     .push-toast__priority-bar { background: #3b82f6; }

    .push-toast__content {
      flex: 1;
      padding: 0.75rem 0.75rem 0.75rem 0.875rem;
    }

    .push-toast__title-row {
      display: flex;
      align-items: center;
      gap: 0.45rem;
      margin-bottom: 0.2rem;
    }

    .push-toast__icon {
      width: 2rem;
      height: 2rem;
      display: inline-flex;
      align-items: center;
      justify-content: center;
      border-radius: 0;
      background: transparent;
      border: none;
      font-size: 1.6rem;
      flex-shrink: 0;
    }

    .push-toast__title {
      margin: 0;
      font-weight: 600;
      font-size: 0.88rem;
      color: var(--text-primary);
    }

    .push-toast__body {
      margin: 0;
      font-size: 0.82rem;
      color: var(--text-secondary);
      line-height: 1.4;
    }

    .push-toast__actions {
      display: flex;
      flex-wrap: wrap;
      gap: 0.45rem;
      margin-top: 0.65rem;
    }

    .push-toast__action-btn {
      border: 1px solid var(--border-color);
      background: var(--card-bg-soft);
      color: var(--text-primary);
      border-radius: 999px;
      padding: 0.28rem 0.65rem;
      font-size: 0.74rem;
      font-weight: 600;
      cursor: pointer;
    }

    .push-toast__action-btn--danger {
      border-color: #ef4444;
      color: #b91c1c;
      background: rgba(239, 68, 68, 0.1);
    }

    .push-toast__close {
      background: none;
      border: none;
      cursor: pointer;
      color: var(--text-secondary);
      font-size: 0.85rem;
      padding: 0 0.75rem;
      align-self: flex-start;
      margin-top: 0.5rem;
      line-height: 1;
      border-radius: 4px;
      transition: color 0.15s;

      &:hover { color: var(--text-primary); }
      &:focus-visible { outline: 2px solid var(--btn-primary-bg); }
    }

    @media (max-width: 480px) {
      .push-toast-stack {
        top: auto;
        bottom: 1rem;
        right: 0.75rem;
        left: 0.75rem;
        max-width: unset;
      }
    }
  `]
})
export class PushNotificationToastComponent implements OnInit, OnDestroy {
  toasts: PushToast[] = [];

  private readonly pushService = inject(PushSubscriptionService);
  private readonly notificationService = inject(NotificationService);
  private readonly authService = inject(AuthService);
  private readonly practitionerResolver = inject(ConnectedPractitionerResolverService);
  private readonly router = inject(Router);
  private readonly zone = inject(NgZone);
  private readonly destroy$ = new Subject<void>();
  private removeListeners: (() => void)[] = [];
  private readonly displayedNotificationIds = new Set<string>();
  private lastUnreadCount = 0;
  private initializedFromState = false;

  ngOnInit(): void {
    console.log('[PushToast] init');

    const connectedUserId = this.authService.getConnectedPractitionerId();
    if (connectedUserId) {
      this.notificationService.startPolling(connectedUserId);
      console.log('[PushToast] Notification polling started for userId:', connectedUserId);
    } else {
      console.warn('[PushToast] No connected practitioner id in claims, resolving via Practitioner lookup...');
      this.practitionerResolver.resolveReference()
        .pipe(takeUntil(this.destroy$))
        .subscribe((reference) => {
          const resolvedId = this.extractPractitionerId(reference);
          if (!resolvedId) {
            console.warn('[PushToast] Could not resolve practitioner id; fallback polling remains inactive');
            return;
          }

          this.notificationService.startPolling(resolvedId);
          console.log('[PushToast] Notification polling started for resolved userId:', resolvedId);
        });
    }
    
    // Listen for messages pushed by the Service Worker.
    // Must run inside NgZone since SW events fire outside Angular's zone.
    const removePushListener = this.pushService.listenForMessages((payload) => {
      console.log('[PushToast] PUSH_NOTIFICATION received from SW:', payload);
      this.zone.run(() => {
        this.addToast(payload);
        // Refresh the notification bell counter
        this.notificationService.loadNotifications();
        console.log('[PushToast] toast added from SW, stack size:', this.toasts.length);
      });
    });
    console.log('[PushToast] SW message listeners ready');

    // Listen for notification click (from native OS notification click)
    const removeClickListener = this.pushService.listenForClicks((payload) => {
      this.zone.run(() => {
        if (payload.notificationId && payload.userId) {
          this.notificationService.acknowledge(payload.notificationId, payload.userId)
            .pipe(takeUntil(this.destroy$))
            .subscribe();
        }
      });
    });

    // Fallback: when push transport is blocked (proxy/firewall), still surface
    // newly unread notifications as in-app toasts based on polled state.
    this.notificationService.getState()
      .pipe(takeUntil(this.destroy$))
      .subscribe((state) => {
        this.zone.run(() => {
          console.log('[PushToast] state update unreadCount=', state.unreadCount, 'notifications=', state.notifications.length);
          const unread = state.notifications.filter((n) => !n.acknowledged);

          if (!this.initializedFromState) {
            unread.forEach((n) => this.displayedNotificationIds.add(n.id));
            this.lastUnreadCount = state.unreadCount;
            this.initializedFromState = true;
            return;
          }

          if (state.unreadCount > this.lastUnreadCount) {
            const newestUnread = unread[0];
            if (newestUnread && !this.displayedNotificationIds.has(newestUnread.id)) {
              this.displayedNotificationIds.add(newestUnread.id);
              this.addToast({
                title: newestUnread.title,
                body: newestUnread.message,
                priority: newestUnread.priority,
                type: newestUnread.type,
                category: this.metadataValue(newestUnread, 'category'),
                subcategory: this.metadataValue(newestUnread, 'subcategory'),
                metadata: this.metadataObject(newestUnread),
                notificationId: newestUnread.id,
                userId: newestUnread.userId
              });
              console.log('[PushToast] fallback toast emitted from unread delta for notificationId:', newestUnread.id);
            }
          }

          unread.forEach((n) => {
            if (!this.displayedNotificationIds.has(n.id)) {
              this.displayedNotificationIds.add(n.id);
              this.addToast({
                title: n.title,
                body: n.message,
                priority: n.priority,
                type: n.type,
                category: this.metadataValue(n, 'category'),
                subcategory: this.metadataValue(n, 'subcategory'),
                metadata: this.metadataObject(n),
                notificationId: n.id,
                userId: n.userId
              });
              console.log('[PushToast] fallback toast emitted from unread scan for notificationId:', n.id);
            }
          });

          this.lastUnreadCount = state.unreadCount;
        });
      });

    this.removeListeners = [removePushListener, removeClickListener];
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
    this.removeListeners.forEach((fn) => fn());
  }

  dismiss(toast: PushToast): void {
    this.toasts = this.toasts.filter((t) => t.id !== toast.id);

    // Acknowledge the notification in the backend
    if (toast.notificationId && toast.userId) {
      this.notificationService.acknowledge(toast.notificationId, toast.userId)
        .pipe(takeUntil(this.destroy$))
        .subscribe();
    } else {
      // Refresh the bell count even without explicit ack
      this.notificationService.loadNotifications();
    }
  }

  handleToastAction(toast: PushToast, action: PushToastAction): void {
    if (action.kind === 'decision' && action.decision && toast.notificationId) {
      const userId = toast.userId || this.authService.getConnectedPractitionerId();
      if (!userId) {
        return;
      }

      this.notificationService.respond(toast.notificationId, userId, action.decision)
        .pipe(takeUntil(this.destroy$))
        .subscribe({
          next: () => this.dismiss(toast),
          error: () => this.dismiss(toast)
        });
      return;
    }

    if (action.url) {
      window.open(action.url, '_blank', 'noopener,noreferrer');
    } else if (action.route) {
      this.router.navigate([action.route], { queryParams: action.queryParams || {} });
    }
  }

  private addToast(payload: PushMessagePayload): void {
    console.log('[PushToast] addToast payload:', payload);
    const toast: PushToast = {
      id: `push-${Date.now()}-${Math.random()}`,
      title: payload.title,
      body: payload.body,
      priority: payload.priority ?? 'LOW',
      type: payload.type,
      category: payload.category,
      subcategory: payload.subcategory,
      metadata: payload.metadata,
      icon: this.categoryIcon(payload.category),
      actions: this.buildToastActions(payload),
      notificationId: payload.notificationId,
      userId: payload.userId
    };
    // Prepend so newest is on top
    this.toasts = [toast, ...this.toasts];
    console.log('[PushToast] toast stack updated, new size:', this.toasts.length);

    // Keep HIGH/LOW indefinitely; auto-dismiss others after 30s.
    const shouldAutoDismiss = toast.priority !== 'HIGH' && toast.priority !== 'LOW';
    if (shouldAutoDismiss) {
      const delay = 30000;
      setTimeout(() => {
        this.zone.run(() => {
          this.toasts = this.toasts.filter((t) => t.id !== toast.id);
          console.log('[PushToast] auto-dismiss toastId=', toast.id, 'remaining=', this.toasts.length);
        });
      }, delay);
    } else {
      console.log('[PushToast] sticky toast (no auto-dismiss), priority=', toast.priority, 'toastId=', toast.id);
    }
  }

  private categoryIcon(category?: string): string {
    switch (category) {
      case 'intervenants': return '⊙';
      case 'questionnaires': return '✓';
      case 'agenda': return '⏱';
      case 'visio-conferences': return '☎';
      case 'chat': return '✉';
      default: return '◇';
    }
  }

  private buildToastActions(payload: PushMessagePayload): PushToastAction[] {
    const actions: PushToastAction[] = [];
    const metadata = (payload.metadata || {}) as Record<string, unknown>;

    if (payload.category === 'intervenants' && metadata['practitionerId']) {
      actions.push({
        key: 'open-practitioner',
        labelKey: 'push.toast.actions.openPractitioner',
        kind: 'link',
        route: '/professionnels',
        queryParams: { id: String(metadata['practitionerId']) }
      });
    }

    if (payload.category === 'questionnaires' && metadata['questionnaireId']) {
      actions.push({
        key: 'open-questionnaire',
        labelKey: 'push.toast.actions.openQuestionnaire',
        kind: 'link',
        route: '/questionnaires',
        queryParams: { id: String(metadata['questionnaireId']) }
      });
    }

    if (payload.category === 'agenda' && metadata['appointmentId']) {
      actions.push({
        key: 'open-appointment',
        labelKey: 'push.toast.actions.openAppointment',
        kind: 'link',
        route: '/agenda',
        queryParams: { appointmentId: String(metadata['appointmentId']) }
      });
    }

    if (payload.category === 'visio-conferences') {
      if (metadata['meetingUrl']) {
        actions.push({
          key: 'join-visio',
          labelKey: 'push.toast.actions.joinVisio',
          kind: 'link',
          url: String(metadata['meetingUrl'])
        });
      }

      if (payload.subcategory === 'invitation') {
        actions.push({
          key: 'accept-visio',
          labelKey: 'push.toast.actions.accept',
          kind: 'decision',
          decision: 'ACCEPT'
        });
        actions.push({
          key: 'decline-visio',
          labelKey: 'push.toast.actions.decline',
          kind: 'decision',
          decision: 'DECLINE'
        });
      }
    }

    return actions;
  }

  private metadataObject(notification: Notification): Record<string, unknown> {
    if (!notification.metadataJson) {
      return {};
    }

    try {
      const parsed = JSON.parse(notification.metadataJson) as Record<string, unknown>;
      return parsed && typeof parsed === 'object' ? parsed : {};
    } catch {
      return {};
    }
  }

  private metadataValue(notification: Notification, key: string): string | undefined {
    const metadata = this.metadataObject(notification);
    const raw = metadata[key];
    if (raw === undefined || raw === null) {
      return undefined;
    }
    const value = String(raw).trim();
    return value ? value : undefined;
  }

  private extractPractitionerId(reference: string): string {
    const value = String(reference || '').trim();
    if (!value) {
      return '';
    }

    const prefix = 'Practitioner/';
    return value.startsWith(prefix) ? value.slice(prefix.length).trim() : value;
  }
}
