import { Injectable } from '@angular/core';
import { BehaviorSubject } from 'rxjs';
import { TranslateService } from '@ngx-translate/core';

export type AppTheme = 'light' | 'dark';
export type AppLanguage = 'fr' | 'en' | 'it' | 'de';

@Injectable({
  providedIn: 'root'
})
export class AppPreferencesService {
  private readonly themeStorageKey = 'healthapp.theme';
  private readonly languageStorageKey = 'healthapp.language';

  private readonly themeSubject = new BehaviorSubject<AppTheme>('light');
  private readonly languageSubject = new BehaviorSubject<AppLanguage>('fr');

  readonly theme$ = this.themeSubject.asObservable();
  readonly language$ = this.languageSubject.asObservable();

  constructor(private readonly translate: TranslateService) {}

  get currentTheme(): AppTheme {
    return this.themeSubject.value;
  }

  get currentLanguage(): AppLanguage {
    return this.languageSubject.value;
  }

  initialize(): void {
    this.translate.addLangs(['fr', 'en', 'it', 'de']);
    this.translate.setDefaultLang('fr');

    const storedTheme = localStorage.getItem(this.themeStorageKey);
    const storedLanguage = localStorage.getItem(this.languageStorageKey);

    const theme: AppTheme = storedTheme === 'dark' ? 'dark' : 'light';
    const language: AppLanguage =
      storedLanguage === 'en' || storedLanguage === 'it' || storedLanguage === 'de' ? storedLanguage : 'fr';

    this.themeSubject.next(theme);
    this.languageSubject.next(language);
    this.applyTheme(theme);
    this.applyLanguage(language);
  }

  setTheme(theme: AppTheme): void {
    this.themeSubject.next(theme);
    localStorage.setItem(this.themeStorageKey, theme);
    this.applyTheme(theme);
  }

  setLanguage(language: AppLanguage): void {
    this.languageSubject.next(language);
    localStorage.setItem(this.languageStorageKey, language);
    this.applyLanguage(language);
  }

  private applyTheme(theme: AppTheme): void {
    document.documentElement.setAttribute('data-theme', theme);
    this.syncSystemThemeColor(theme);
  }

  private syncSystemThemeColor(theme: AppTheme): void {
    const root = document.documentElement;
    const computed = getComputedStyle(root);
    const fallback = theme === 'dark' ? '#0b1220' : '#ffffff';
    const color = (computed.getPropertyValue('--app-bg') || '').trim() || fallback;

    const themeColorMeta = document.querySelector('meta[name="theme-color"]');
    if (themeColorMeta) {
      themeColorMeta.setAttribute('content', color);
    }

    const statusBarMeta = document.querySelector('meta[name="apple-mobile-web-app-status-bar-style"]');
    if (statusBarMeta) {
      statusBarMeta.setAttribute('content', theme === 'dark' ? 'black-translucent' : 'default');
    }
  }

  private applyLanguage(language: AppLanguage): void {
    document.documentElement.setAttribute('lang', language);
    this.translate.use(language);
  }
}
