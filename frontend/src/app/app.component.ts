import { Component, inject } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { ToastComponent } from './shared/components/toast.component';
import { SideMenuComponent } from './shared/components/side-menu/side-menu.component';
import { FloatingVisioComponent } from './shared/components/floating-visio/floating-visio.component';
import { AppPreferencesService } from './core/services/app-preferences.service';
import { MenuStateService } from './core/services/menu-state.service';
import { ChatAssistantComponent } from './shared/components/chat-assistant/chat-assistant.component';
import { PushPermissionPromptComponent } from './shared/components/push-permission-prompt/push-permission-prompt.component';
import { PushNotificationToastComponent } from './shared/components/push-notification-toast/push-notification-toast.component';

@Component({
  selector: 'app-root',
  imports: [
    RouterOutlet,
    SideMenuComponent,
    ToastComponent,
    FloatingVisioComponent,
    ChatAssistantComponent,
    PushPermissionPromptComponent,
    PushNotificationToastComponent
  ],
  templateUrl: './app.component.html',
  styleUrl: './app.component.scss'
})
export class AppComponent {
  private readonly menuState = inject(MenuStateService);

  constructor(private readonly preferences: AppPreferencesService) {
    this.preferences.initialize();
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
