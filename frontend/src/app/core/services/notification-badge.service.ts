import { Injectable } from '@angular/core';
import { distinctUntilChanged, map } from 'rxjs/operators';
import { NotificationService } from './notification.service';

type NavigatorWithBadge = Navigator & {
  setAppBadge?: (contents?: number) => Promise<void>;
  clearAppBadge?: () => Promise<void>;
};

@Injectable({
  providedIn: 'root'
})
export class NotificationBadgeService {
  private readonly appTitle = 'Doctocare';
  private readonly defaultFavicon = this.getDefaultFavicon();
  private initialized = false;

  constructor(private readonly notificationService: NotificationService) {}

  init(): void {
    if (this.initialized) {
      return;
    }

    this.initialized = true;

    this.notificationService.getState()
      .pipe(
        map((state) => state.unreadCount),
        distinctUntilChanged()
      )
      .subscribe((unreadCount) => {
        this.applyUnreadCount(unreadCount);
      });
  }

  private applyUnreadCount(unreadCount: number): void {
    this.updatePageTitle(unreadCount);
    this.updateFavicon(unreadCount);
    this.updateAppBadge(unreadCount);
    this.syncServiceWorkerBadge(unreadCount);
  }

  private updatePageTitle(unreadCount: number): void {
    document.title = unreadCount > 0 ? `(${unreadCount}) ${this.appTitle}` : this.appTitle;
  }

  private updateFavicon(unreadCount: number): void {
    const href = unreadCount > 0 ? this.buildBadgeFavicon(unreadCount) : this.defaultFavicon;
    const iconLinks = document.querySelectorAll<HTMLLinkElement>('link[rel="icon"], link[rel="shortcut icon"]');

    if (iconLinks.length === 0) {
      const fallback = document.createElement('link');
      fallback.rel = 'icon';
      fallback.type = 'image/svg+xml';
      fallback.href = href;
      document.head.appendChild(fallback);
      return;
    }

    iconLinks.forEach((link) => {
      link.href = href;
      if (href.startsWith('data:image/svg+xml')) {
        link.type = 'image/svg+xml';
      } else if (href.toLowerCase().endsWith('.ico')) {
        link.type = 'image/x-icon';
      } else {
        link.removeAttribute('type');
      }
    });
  }

  private async updateAppBadge(unreadCount: number): Promise<void> {
    const nav = navigator as NavigatorWithBadge;

    if (typeof nav.setAppBadge !== 'function' && typeof nav.clearAppBadge !== 'function') {
      return;
    }

    try {
      if (unreadCount > 0 && typeof nav.setAppBadge === 'function') {
        await nav.setAppBadge(Math.min(unreadCount, 99));
      } else if (typeof nav.clearAppBadge === 'function') {
        await nav.clearAppBadge();
      }
    } catch {
      // Badge API is best-effort and browser-dependent.
    }
  }

  private syncServiceWorkerBadge(unreadCount: number): void {
    if (!('serviceWorker' in navigator)) {
      return;
    }

    const payload = { type: 'SYNC_BADGE', unreadCount };
    navigator.serviceWorker.controller?.postMessage(payload);

    navigator.serviceWorker.ready
      .then((registration) => {
        registration.active?.postMessage(payload);
      })
      .catch(() => {
        // No active service worker yet.
      });
  }

  private getDefaultFavicon(): string {
    const link = document.querySelector<HTMLLinkElement>('link[rel="icon"], link[rel="shortcut icon"]');
    return link?.href || '/favicon.ico';
  }

  private buildBadgeFavicon(unreadCount: number): string {
    const countText = unreadCount > 99 ? '99+' : String(unreadCount);

    // Self-contained favicon so the icon remains visible in all browsers.
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 96 96"><defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#17b8a0"/><stop offset="1" stop-color="#1d4ed8"/></linearGradient></defs><rect x="8" y="8" width="80" height="80" rx="18" fill="url(#g)"/><rect x="14" y="14" width="68" height="68" rx="14" fill="rgba(255,255,255,0.12)"/><text x="48" y="58" text-anchor="middle" font-family="Arial, sans-serif" font-size="36" font-weight="700" fill="#ffffff">D</text><circle cx="74" cy="24" r="24" fill="#dc2626" stroke="#ffffff" stroke-width="3"/><text x="74" y="33" text-anchor="middle" font-family="Arial, sans-serif" font-size="20" font-weight="700" fill="#fff">${countText}</text></svg>`;

    return `data:image/svg+xml,${encodeURIComponent(svg)}`;
  }
}