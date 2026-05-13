import { Injectable } from '@angular/core';
import { BehaviorSubject } from 'rxjs';
import { TranslateService } from '@ngx-translate/core';

export type AppTheme = 'light' | 'dark' | 'purple' | 'midnight' | 'forest' | 'sunrise' | 'white-and-black';
export type AppLanguage = 'fr' | 'en' | 'it' | 'de';
export type AccessibilityContrast = 'normal' | 'high';
export type AccessibilityColorMode = 'none' | 'daltonian-friendly';

export interface AccessibilityPreferences {
  contrast: AccessibilityContrast;
  colorMode: AccessibilityColorMode;
  textScale: number;
  lineHeightScale: number;
  reduceMotion: boolean;
}

@Injectable({
  providedIn: 'root'
})
export class AppPreferencesService {
  private readonly availableThemes: AppTheme[] = ['light', 'dark', 'purple', 'midnight', 'forest', 'sunrise', 'white-and-black'];
  private readonly themeStorageKey = 'healthapp.theme';
  private readonly languageStorageKey = 'healthapp.language';
  private readonly accessibilityStorageKey = 'healthapp.accessibility';

  private readonly themeSubject = new BehaviorSubject<AppTheme>('light');
  private readonly languageSubject = new BehaviorSubject<AppLanguage>('fr');
  private readonly accessibilitySubject = new BehaviorSubject<AccessibilityPreferences>(this.defaultAccessibilityPreferences());

  readonly theme$ = this.themeSubject.asObservable();
  readonly language$ = this.languageSubject.asObservable();
  readonly accessibility$ = this.accessibilitySubject.asObservable();

  constructor(private readonly translate: TranslateService) {}

  get currentTheme(): AppTheme {
    return this.themeSubject.value;
  }

  get currentLanguage(): AppLanguage {
    return this.languageSubject.value;
  }

  get currentAccessibility(): AccessibilityPreferences {
    return this.accessibilitySubject.value;
  }

  initialize(): void {
    this.translate.addLangs(['fr', 'en', 'it', 'de']);
    this.translate.setDefaultLang('fr');

    const storedTheme = localStorage.getItem(this.themeStorageKey);
    const storedLanguage = localStorage.getItem(this.languageStorageKey);
    const storedAccessibility = localStorage.getItem(this.accessibilityStorageKey);

    const theme: AppTheme = this.availableThemes.includes(storedTheme as AppTheme)
      ? (storedTheme as AppTheme)
      : 'light';
    const language: AppLanguage =
      storedLanguage === 'en' || storedLanguage === 'it' || storedLanguage === 'de' ? storedLanguage : 'fr';
    const accessibility = this.parseAccessibilityPreferences(storedAccessibility);

    this.themeSubject.next(theme);
    this.languageSubject.next(language);
    this.accessibilitySubject.next(accessibility);
    this.applyTheme(theme);
    this.applyLanguage(language);
    this.applyAccessibilityPreferences(accessibility);
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

  setAccessibilityPreferences(preferences: Partial<AccessibilityPreferences>): void {
    const nextPreferences = this.normalizeAccessibilityPreferences({
      ...this.currentAccessibility,
      ...preferences
    });

    this.accessibilitySubject.next(nextPreferences);
    localStorage.setItem(this.accessibilityStorageKey, JSON.stringify(nextPreferences));
    this.applyAccessibilityPreferences(nextPreferences);
  }

  private applyTheme(theme: AppTheme): void {
    document.documentElement.setAttribute('data-theme', theme);
    this.syncSystemThemeColor(theme);
  }

  private syncSystemThemeColor(theme: AppTheme): void {
    const root = document.documentElement;
    const computed = getComputedStyle(root);
    const fallback =
      theme === 'dark' || theme === 'midnight'
        ? '#0b1220'
        : theme === 'purple'
          ? '#efeaf8'
          : theme === 'forest'
            ? '#eef6ef'
            : theme === 'sunrise'
              ? '#fff5ec'
              : '#ffffff';
    const color = (computed.getPropertyValue('--app-bg') || '').trim() || fallback;

    const themeColorMeta = document.querySelector('meta[name="theme-color"]');
    if (themeColorMeta) {
      themeColorMeta.setAttribute('content', color);
    }

    const statusBarMeta = document.querySelector('meta[name="apple-mobile-web-app-status-bar-style"]');
    if (statusBarMeta) {
      statusBarMeta.setAttribute('content', theme === 'dark' || theme === 'midnight' ? 'black-translucent' : 'default');
    }
  }

  private applyLanguage(language: AppLanguage): void {
    document.documentElement.setAttribute('lang', language);
    this.translate.use(language);
  }

  private applyAccessibilityPreferences(preferences: AccessibilityPreferences): void {
    const root = document.documentElement;

    root.setAttribute('data-contrast', preferences.contrast);
    root.setAttribute('data-color-mode', preferences.colorMode);
    root.setAttribute('data-motion', preferences.reduceMotion ? 'reduced' : 'normal');
    root.style.setProperty('--app-text-scale', `${preferences.textScale / 100}`);
    root.style.setProperty('--app-line-height-scale', `${preferences.lineHeightScale / 100}`);
  }

  private parseAccessibilityPreferences(raw: string | null): AccessibilityPreferences {
    if (!raw) {
      return this.defaultAccessibilityPreferences();
    }

    try {
      const parsed = JSON.parse(raw) as Partial<AccessibilityPreferences>;
      return this.normalizeAccessibilityPreferences(parsed);
    } catch {
      return this.defaultAccessibilityPreferences();
    }
  }

  private normalizeAccessibilityPreferences(preferences: Partial<AccessibilityPreferences>): AccessibilityPreferences {
    const textScaleValue = Number(preferences.textScale);
    const lineHeightScaleValue = Number(preferences.lineHeightScale);

    return {
      contrast: preferences.contrast === 'high' ? 'high' : 'normal',
      colorMode: preferences.colorMode === 'daltonian-friendly' ? 'daltonian-friendly' : 'none',
      textScale: [100, 110, 125, 140, 160].includes(textScaleValue) ? textScaleValue : 100,
      lineHeightScale: [100, 115, 130, 145].includes(lineHeightScaleValue) ? lineHeightScaleValue : 100,
      reduceMotion: preferences.reduceMotion === true
    };
  }

  private defaultAccessibilityPreferences(): AccessibilityPreferences {
    return {
      contrast: 'normal',
      colorMode: 'none',
      textScale: 100,
      lineHeightScale: 100,
      reduceMotion: false
    };
  }
}
