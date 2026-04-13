import { CommonModule } from '@angular/common';
import { Component, HostListener, OnDestroy, OnInit, inject } from '@angular/core';
import { trigger, transition, style, animate } from '@angular/animations';
import { Observable, Subject } from 'rxjs';
import { map, takeUntil } from 'rxjs/operators';
import { AuthService } from '../../../core/services/auth.service';
import { NotificationService, Notification, NotificationState } from '../../../core/services/notification.service';
import { TranslateModule } from '@ngx-translate/core';
import { RouterModule } from '@angular/router';
import { ConnectedPractitionerResolverService } from '../../../core/services/connected-practitioner-resolver.service';

@Component({
  selector: 'app-notification-bell',
  standalone: true,
  imports: [CommonModule, TranslateModule, RouterModule],
  templateUrl: './notification-bell.component.html',
  styleUrl: './notification-bell.component.scss',
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
  private readonly destroy$ = new Subject<void>();

  isPopoverOpen = false;
  unreadCount$!: Observable<number>;
  notifications$!: Observable<Notification[]>;
  isLoading$!: Observable<boolean>;
  private practitionerId = '';

  ngOnInit(): void {
    const state$: Observable<NotificationState> = this.notificationService.getState();
    this.unreadCount$ = state$.pipe(map((state) => state.unreadCount));
    this.notifications$ = state$.pipe(map((state) => state.notifications));
    this.isLoading$ = state$.pipe(map((state) => state.isLoading));

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
  }

  toggleNotificationStatus(notif: Notification): void {
    const practitionerId = this.practitionerId || this.authService.getConnectedPractitionerId();
    if (!practitionerId) {
      return;
    }

    if (notif.acknowledged) {
      // TODO: Implement mark as unread when API supports it
      console.log('Mark as unread not yet implemented');
    } else {
      this.notificationService.acknowledge(notif.id, practitionerId).subscribe({
        error: (err) => console.error('Failed to acknowledge notification:', err)
      });
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
      },
      error: (err) => console.error('Failed to mark all as read:', err)
    });
  }

  @HostListener('document:click')
  onDocumentClick(): void {
    this.isPopoverOpen = false;
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
