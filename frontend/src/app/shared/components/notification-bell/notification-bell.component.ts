import { CommonModule } from '@angular/common';
import { ChangeDetectionStrategy, ChangeDetectorRef, Component, HostListener, NgZone, OnDestroy, OnInit, inject } from '@angular/core';
import { trigger, transition, style, animate } from '@angular/animations';
import { Subject } from 'rxjs';
import { takeUntil } from 'rxjs/operators';
import { AuthService } from '../../../core/services/auth.service';
import { NotificationService, Notification } from '../../../core/services/notification.service';
import { TranslateModule } from '@ngx-translate/core';
import { Router, RouterModule } from '@angular/router';
import { ConnectedPractitionerResolverService } from '../../../core/services/connected-practitioner-resolver.service';

interface NotificationAction {
  key: string;
  labelKey: string;
  kind: 'link' | 'decision';
  route?: string;
  url?: string;
  queryParams?: Record<string, string>;
  decision?: 'ACCEPT' | 'DECLINE';
}

@Component({
  selector: 'app-notification-bell',
  standalone: true,
  imports: [CommonModule, TranslateModule, RouterModule],
  templateUrl: './notification-bell.component.html',
  styleUrl: './notification-bell.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
  animations: [
    trigger('popoverAnimation', [
      transition(':enter', [style({ opacity: 0, transform: 'translateY(-10px)' }), animate('200ms ease-out', style({ opacity: 1, transform: 'translateY(0)' }))]),
      transition(':leave', [animate('200ms ease-in', style({ opacity: 0, transform: 'translateY(-10px)' }))])
    ])
  ]
})
export class NotificationBellComponent implements OnInit, OnDestroy {
  private readonly notificationService = inject(NotificationService);
  private readonly authService = inject(AuthService);
  private readonly practitionerResolver = inject(ConnectedPractitionerResolverService);
  private readonly cdr = inject(ChangeDetectorRef);
  private readonly zone = inject(NgZone);
  private readonly router = inject(Router);
  private readonly destroy$ = new Subject<void>();

  isPopoverOpen = false;
  isExpandedView = false;
  notifications: Notification[] = [];
  unreadCount = 0;
  isLoading = false;
  private practitionerId = '';

  ngOnInit(): void {
    this.notificationService.getState()
      .pipe(takeUntil(this.destroy$))
      .subscribe((state) => {
        // Force UI update inside Angular zone to avoid stale popover rendering.
        this.zone.run(() => {
          this.notifications = state.notifications;
          this.unreadCount = state.unreadCount;
          this.isLoading = state.isLoading;
          this.cdr.detectChanges();
        });
      });

    const fromClaims = this.authService.getConnectedPractitionerId();
    if (fromClaims) {
      this.practitionerId = fromClaims;
      this.notificationService.startPolling(this.practitionerId);
      return;
    }

    this.practitionerResolver.resolveReference()
      .pipe(takeUntil(this.destroy$))
      .subscribe((reference) => {
        const resolvedId = this.extractPractitionerId(reference);
        if (!resolvedId) {
          return;
        }

        this.practitionerId = resolvedId;
        this.notificationService.startPolling(this.practitionerId);
      });
  }

  ngOnDestroy(): void {
    this.notificationService.stopPolling();
    this.destroy$.next();
    this.destroy$.complete();
  }

  togglePopover(event: Event): void {
    event.stopPropagation();
    this.isPopoverOpen = !this.isPopoverOpen;
    if (!this.isPopoverOpen) {
      this.isExpandedView = false;
    }
    this.cdr.detectChanges();
  }

  toggleExpandedView(event: Event): void {
    event.stopPropagation();
    this.isExpandedView = !this.isExpandedView;
    this.cdr.detectChanges();
  }

  openNotificationSettings(event: Event): void {
    event.stopPropagation();
    this.isPopoverOpen = false;
    this.isExpandedView = false;
    this.router.navigate(['/parametres/notifications']);
  }

  toggleNotificationStatus(notif: Notification): void {
    const practitionerId = this.practitionerId || this.authService.getConnectedPractitionerId();
    if (!practitionerId) {
      return;
    }

    if (notif.acknowledged) {
      console.log('Mark as unread not yet implemented');
    } else {
      this.notificationService.acknowledge(notif.id, practitionerId).subscribe({
        error: (err) => console.error('Failed to acknowledge notification:', err)
      });
    }
  }

  handleNotificationAction(notif: Notification, action: NotificationAction): void {
    const practitionerId = this.practitionerId || this.authService.getConnectedPractitionerId();

    if (action.kind === 'decision' && action.decision) {
      if (!practitionerId) return;
      this.notificationService.respond(notif.id, practitionerId, action.decision)
        .pipe(takeUntil(this.destroy$))
        .subscribe({
          next: () => this.cdr.detectChanges(),
          error: (err) => console.error('Failed to respond to notification:', err)
        });
      return;
    }

    if (action.url) {
      window.open(action.url, '_blank', 'noopener,noreferrer');
    } else if (action.route) {
      this.isPopoverOpen = false;
      this.isExpandedView = false;
      this.router.navigate([action.route], { queryParams: action.queryParams || {} });
    }
  }

  getNotificationIcon(notif: Notification): string {
    const category = this.getMetadataValue(notif, 'category');
    switch (category) {
      case 'intervenants': return '⊙';
      case 'questionnaires': return '✓';
      case 'agenda': return '⏱';
      case 'visio-conferences': return '☎';
      case 'chat': return '✉';
      default: return '◇';
    }
  }

  getNotificationActions(notif: Notification): NotificationAction[] {
    const actions: NotificationAction[] = [];
    const metadata = this.getMetadataObject(notif);
    const category = this.getMetadataValue(notif, 'category');
    const subcategory = this.getMetadataValue(notif, 'subcategory');

    if (category === 'intervenants' && metadata['practitionerId']) {
      actions.push({
        key: 'open-practitioner',
        labelKey: 'push.toast.actions.openPractitioner',
        kind: 'link',
        route: '/professionnels',
        queryParams: { id: String(metadata['practitionerId']) }
      });
    }

    if (category === 'questionnaires' && metadata['questionnaireId']) {
      actions.push({
        key: 'open-questionnaire',
        labelKey: 'push.toast.actions.openQuestionnaire',
        kind: 'link',
        route: '/questionnaires',
        queryParams: { id: String(metadata['questionnaireId']) }
      });
    }

    if (category === 'agenda' && metadata['appointmentId']) {
      actions.push({
        key: 'open-appointment',
        labelKey: 'push.toast.actions.openAppointment',
        kind: 'link',
        route: '/agenda',
        queryParams: { appointmentId: String(metadata['appointmentId']) }
      });
    }

    if (category === 'visio-conferences') {
      if (metadata['meetingUrl']) {
        actions.push({
          key: 'join-visio',
          labelKey: 'push.toast.actions.joinVisio',
          kind: 'link',
          url: String(metadata['meetingUrl'])
        });
      }
      if (subcategory === 'invitation') {
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

  private getMetadataValue(notif: Notification, key: string): string | undefined {
    try {
      if (!notif.metadataJson) return undefined;
      const metadata = typeof notif.metadataJson === 'string' ? JSON.parse(notif.metadataJson) : notif.metadataJson;
      return metadata?.[key];
    } catch {
      return undefined;
    }
  }

  private getMetadataObject(notif: Notification): Record<string, unknown> {
    try {
      if (!notif.metadataJson) return {};
      return typeof notif.metadataJson === 'string' ? JSON.parse(notif.metadataJson) : notif.metadataJson;
    } catch {
      return {};
    }
  }

  markAllAsRead(): void {
    const practitionerId = this.practitionerId || this.authService.getConnectedPractitionerId();
    if (!practitionerId) {
      return;
    }

    this.notificationService.acknowledgeAll(practitionerId).subscribe({
      next: () => {
        this.isPopoverOpen = false;
        this.isExpandedView = false;
        this.cdr.detectChanges();
      },
      error: (err) => console.error('Failed to mark all as read:', err)
    });
  }

  @HostListener('document:click')
  onDocumentClick(): void {
    if (this.isPopoverOpen) {
      this.isPopoverOpen = false;
      this.isExpandedView = false;
      this.cdr.detectChanges();
    }
  }

  getInitials(text: string): string {
    return text
      .split(' ')
      .slice(0, 2)
      .map((word) => word.charAt(0).toUpperCase())
      .join('')
      .substring(0, 2);
  }

  formatTime(isoString: string): string {
    try {
      const date = new Date(isoString);
      const now = new Date();
      const diffTime = Math.abs(now.getTime() - date.getTime());
      const diffMinutes = Math.floor(diffTime / (1000 * 60));
      const diffHours = Math.floor(diffTime / (1000 * 60 * 60));
      const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));

      if (diffMinutes < 1) return 'À l\'instant';
      if (diffMinutes < 60) return `${diffMinutes}m`;
      if (diffHours < 24) return `${diffHours}h`;
      if (diffDays < 7) return `${diffDays}j`;
      if (diffDays < 30) return Math.floor(diffDays / 7) + 'sem';

      return date.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' });
    } catch {
      return '';
    }
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
