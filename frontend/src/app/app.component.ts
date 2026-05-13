import { Component, inject } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { ToastComponent } from './shared/components/toast.component';
import { SideMenuComponent } from './shared/components/side-menu/side-menu.component';
import { FloatingVisioComponent } from './shared/components/floating-visio/floating-visio.component';
import { AppPreferencesService } from './core/services/app-preferences.service';
import { MenuStateService } from './core/services/menu-state.service';
import { RightUtilityDockComponent } from './shared/components/right-utility-dock/right-utility-dock.component';
import { PushPermissionPromptComponent } from './shared/components/push-permission-prompt/push-permission-prompt.component';
import { PushNotificationToastComponent } from './shared/components/push-notification-toast/push-notification-toast.component';
import { NotificationBadgeService } from './core/services/notification-badge.service';

@Component({
  selector: 'app-root',
  imports: [
    RouterOutlet,
    SideMenuComponent,
    ToastComponent,
    FloatingVisioComponent,
    RightUtilityDockComponent,
    PushPermissionPromptComponent,
    PushNotificationToastComponent
  ],
  templateUrl: './app.component.html',
  styleUrl: './app.component.scss'
})
export class AppComponent {
  private readonly menuState = inject(MenuStateService);
  private readonly notificationBadgeService = inject(NotificationBadgeService);

  constructor(private readonly preferences: AppPreferencesService) {
    this.preferences.initialize();
    this.notificationBadgeService.init();
  }

  isMenuOpen() {
    return this.menuState.isOpen();
  }

  toggleMenu() {
    this.menuState.toggle();
  }

  closeMenu() {
    this.menuState.close();
  }
}
