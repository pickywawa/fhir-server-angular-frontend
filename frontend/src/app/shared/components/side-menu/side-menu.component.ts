import { Component, inject, Input, Output, EventEmitter, HostBinding } from '@angular/core';
import { NgClass } from '@angular/common';
import { RouterLink, RouterLinkActive } from '@angular/router';
import { TranslateModule } from '@ngx-translate/core';
import { AuthService } from '../../../core/services/auth.service';
import { PwaInstallService } from '../../../core/services/pwa-install.service';

type MenuIcon =
  | 'patients'
  | 'professionals'
  | 'questionnaires'
  | 'code-systems'
  | 'organizations'
  | 'agenda'
  | 'discussions'
  | 'search'
  | 'support'
  | 'settings';

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
export class SideMenuComponent {
  private readonly authService = inject(AuthService);
  readonly pwaInstall = inject(PwaInstallService);

  @Input() isOpen = false;
  @Output() closeMenu = new EventEmitter<void>();

  @HostBinding('class.mobile-open') get mobileOpen() {
    return this.isOpen;
  }

  collapsed = false;

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
    { labelKey: 'menu.organizations', route: '/organizations', icon: 'organizations' }
  ];

  readonly bottomMenuItems: MenuItem[] = [
    { labelKey: 'menu.support', route: '/support', icon: 'support' },
    { labelKey: 'menu.settings', route: '/parametres', icon: 'settings' }
  ];

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
}
