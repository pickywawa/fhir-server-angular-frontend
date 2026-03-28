import { Component, inject } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { ToastComponent } from './shared/components/toast.component';
import { SideMenuComponent } from './shared/components/side-menu/side-menu.component';
import { AppPreferencesService } from './core/services/app-preferences.service';
import { MenuStateService } from './core/services/menu-state.service';

@Component({
  selector: 'app-root',
  imports: [RouterOutlet, SideMenuComponent, ToastComponent],
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
