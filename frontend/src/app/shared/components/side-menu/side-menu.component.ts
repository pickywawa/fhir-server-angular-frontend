import { Component, inject, Input, Output, EventEmitter, HostBinding, OnDestroy, OnInit } from '@angular/core';
import { NgClass } from '@angular/common';
import { RouterLink, RouterLinkActive } from '@angular/router';
import { TranslateModule } from '@ngx-translate/core';
import { Subject } from 'rxjs';
import { takeUntil } from 'rxjs/operators';
import { AuthService } from '../../../core/services/auth.service';
import { PwaInstallService } from '../../../core/services/pwa-install.service';
import { NotificationService } from '../../../core/services/notification.service';

type MenuIcon =
  | 'patients'
  | 'professionals'
  | 'questionnaires'
  | 'code-systems'
  | 'organizations'
  | 'care-plans'
  | 'agenda'
  | 'discussions'
  | 'search';

interface MenuItem {
  labelKey: string;
  route: string;
  icon: MenuIcon;
}

interface UserInfo {
  firstName: string;
  lastName: string;
  fullName: string;
  email: string;
  avatarInitials: string;
}

@Component({
  selector: 'app-side-menu',
  standalone: true,
  imports: [NgClass, RouterLink, RouterLinkActive, TranslateModule],
  templateUrl: './side-menu.component.html',
  styleUrl: './side-menu.component.scss'
})
export class SideMenuComponent implements OnInit, OnDestroy {
  private readonly authService = inject(AuthService);
  private readonly notificationService = inject(NotificationService);
  private readonly destroy$ = new Subject<void>();
  readonly pwaInstall = inject(PwaInstallService);

  @Input() isOpen = false;
  @Output() closeMenu = new EventEmitter<void>();

  @HostBinding('class.mobile-open') get mobileOpen() {
    return this.isOpen;
  }

  collapsed = false;
  unreadDiscussionsCount = 0;

  readonly topMenuItems: MenuItem[] = [
    { labelKey: 'menu.myPatients', route: '/my-patients', icon: 'patients' },
    { labelKey: 'menu.agenda', route: '/agenda', icon: 'agenda' },
    { labelKey: 'menu.discussions', route: '/discussions', icon: 'discussions' },
    { labelKey: 'menu.search', route: '/rechercher', icon: 'search' }
  ];

  readonly administrationMenuItems: MenuItem[] = [
    { labelKey: 'menu.professionals', route: '/practitioners', icon: 'professionals' },
    { labelKey: 'menu.patients', route: '/patients', icon: 'patients' },
    { labelKey: 'menu.questionnaires', route: '/questionnaires', icon: 'questionnaires' },
    { labelKey: 'menu.codeSystems', route: '/code-systems', icon: 'code-systems' },
    { labelKey: 'menu.organizations', route: '/organizations', icon: 'organizations' },
    { labelKey: 'menu.carePlans', route: '/care-plans', icon: 'care-plans' }
  ];

  readonly bottomMenuItems: MenuItem[] = [];

  ngOnInit(): void {
    this.notificationService.getUnreadDiscussionCount()
      .pipe(takeUntil(this.destroy$))
      .subscribe((count) => {
        this.unreadDiscussionsCount = count;
      });
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  get user(): UserInfo {
    return this.authService.getUserInfo();
  }

  toggleCollapsed(): void {
    this.collapsed = !this.collapsed;
  }

  onMobileMenuClick(): void {
    // On mobile, close menu when link is clicked
    if (window.innerWidth <= 900 && this.isOpen) {
      this.closeMenu.emit();
    }
  }

  onBackdropClick(): void {
    this.closeMenu.emit();
  }

  t(key: string): string {
    return key;
  }

  installPwa(): void {
    this.pwaInstall.install();
  }

  dismissPwaPrompt(): void {
    this.pwaInstall.dismiss();
  }

  menuBadgeCount(item: MenuItem): number {
    return item.route === '/discussions' ? this.unreadDiscussionsCount : 0;
  }
}
