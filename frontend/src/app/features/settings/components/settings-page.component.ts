import { CommonModule } from '@angular/common';
import { Component, inject } from '@angular/core';
import { TranslateModule } from '@ngx-translate/core';
import { ModuleShellComponent } from '../../../shared/components/module-shell/module-shell.component';
import { BubbleCardComponent } from '../../../shared/components/bubble-card/bubble-card.component';
import { AppLanguage, AppPreferencesService, AppTheme } from '../../../core/services/app-preferences.service';

@Component({
  selector: 'app-settings-page',
  standalone: true,
  imports: [CommonModule, TranslateModule, ModuleShellComponent, BubbleCardComponent],
  templateUrl: './settings-page.component.html',
  styleUrl: './settings-page.component.scss'
})
export class SettingsPageComponent {
  private readonly preferences = inject(AppPreferencesService);

  get breadcrumbs(): { label: string }[] {
    return [{ label: 'settings.title' }];
  }

  get language(): AppLanguage {
    return this.preferences.currentLanguage;
  }

  get theme(): AppTheme {
    return this.preferences.currentTheme;
  }

  setTheme(theme: AppTheme): void {
    this.preferences.setTheme(theme);
  }

  setLanguage(language: AppLanguage): void {
    this.preferences.setLanguage(language);
  }

}
