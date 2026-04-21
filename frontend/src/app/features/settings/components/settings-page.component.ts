import { CommonModule } from '@angular/common';
import { Component, OnDestroy, OnInit, inject } from '@angular/core';
import { FormArray, FormBuilder, FormGroup, ReactiveFormsModule } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { TranslateModule } from '@ngx-translate/core';
import { Subject, finalize, takeUntil } from 'rxjs';
import { ModuleShellComponent } from '../../../shared/components/module-shell/module-shell.component';
import { BubbleCardComponent } from '../../../shared/components/bubble-card/bubble-card.component';
import {
  AccessibilityColorMode,
  AccessibilityContrast,
  AppLanguage,
  AppPreferencesService,
  AppTheme
} from '../../../core/services/app-preferences.service';
import { PushState, PushSubscriptionService } from '../../../core/services/push-subscription.service';
import { AuthService } from '../../../core/services/auth.service';
import { ConnectedPractitionerResolverService } from '../../../core/services/connected-practitioner-resolver.service';
import { NotificationService as UserNotificationService } from '../../../core/services/notification.service';
import {
  NotificationPreferenceCategory,
  NotificationPreferenceUpdate,
  NotificationPreferenceValue,
  NotificationPreferencesService,
  NotificationPriority
} from '../../../core/services/notification-preferences.service';

@Component({
  selector: 'app-settings-page',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, TranslateModule, ModuleShellComponent, BubbleCardComponent],
  templateUrl: './settings-page.component.html',
  styleUrl: './settings-page.component.scss'
})
export class SettingsPageComponent implements OnInit, OnDestroy {
  private readonly preferences = inject(AppPreferencesService);
  private readonly pushService = inject(PushSubscriptionService);
  private readonly authService = inject(AuthService);
  private readonly practitionerResolver = inject(ConnectedPractitionerResolverService);
  private readonly userNotificationService = inject(UserNotificationService);
  private readonly notificationPreferencesService = inject(NotificationPreferencesService);
  private readonly formBuilder = inject(FormBuilder);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly destroy$ = new Subject<void>();

  pushState: PushState = 'default';
  pushTargetUserId = '';
  preferenceUserId = '';
  notificationCategories: NotificationPreferenceCategory[] = [];
  isLoadingPreferences = false;
  isSavingPreferences = false;
  isSendingPushTest = false;
  isSendingPushScenarioTests = false;
  pushTestFeedbackKey = '';
  pushTestFeedbackTone: 'success' | 'error' | null = null;
  saveFeedbackKey = '';
  saveFeedbackTone: 'success' | 'error' | null = null;
  activeTab: 'general' | 'notifications' = 'general';
  activeNotificationCategoryKey = '';

  readonly priorityOptions: Array<{ value: NotificationPriority; labelKey: string }> = [
    { value: 'LOW', labelKey: 'settings.notifications.priorities.low' },
    { value: 'MEDIUM', labelKey: 'settings.notifications.priorities.medium' },
    { value: 'HIGH', labelKey: 'settings.notifications.priorities.high' },
    { value: 'CRITICAL', labelKey: 'settings.notifications.priorities.critical' }
  ];

  readonly notificationPreferencesForm = this.formBuilder.group({
    categories: this.formBuilder.array<FormGroup>([])
  });

  readonly textScaleOptions = [100, 110, 125, 140, 160];
  readonly lineHeightScaleOptions = [100, 115, 130, 145];

  get breadcrumbs(): { label: string }[] {
    return [{ label: 'settings.title' }];
  }

  get language(): AppLanguage {
    return this.preferences.currentLanguage;
  }

  get theme(): AppTheme {
    return this.preferences.currentTheme;
  }

  get accessibility() {
    return this.preferences.currentAccessibility;
  }

  get pushSupported(): boolean {
    return this.pushState !== 'unsupported';
  }

  get pushEnabled(): boolean {
    return this.pushState === 'granted';
  }

  get pushPermissionDenied(): boolean {
    return this.pushState === 'denied';
  }

  get pushUnsubscribed(): boolean {
    return this.pushState === 'unsubscribed';
  }

  get categoryForms(): FormArray<FormGroup> {
    return this.notificationPreferencesForm.controls.categories as FormArray<FormGroup>;
  }

  ngOnInit(): void {
    this.route.paramMap
      .pipe(takeUntil(this.destroy$))
      .subscribe((params) => {
        const currentTab = this.normalizeTab(params.get('tab'));
        this.activeTab = currentTab;

        // Canonicalize invalid tab values to /parametres/general
        if (params.get('tab') !== currentTab) {
          this.router.navigate(['/parametres', currentTab], { replaceUrl: true });
        }
      });

    this.pushService.pushState$
      .pipe(takeUntil(this.destroy$))
      .subscribe((state) => (this.pushState = state));

    const knownPushTargetUserId = this.resolvePushTargetUserId();
    if (knownPushTargetUserId) {
      this.pushTargetUserId = knownPushTargetUserId;
    }

    const knownPreferenceUserId = this.resolvePreferenceUserId();
    if (knownPreferenceUserId) {
      this.preferenceUserId = knownPreferenceUserId;
      this.loadNotificationPreferences();
      if (this.pushTargetUserId) {
        return;
      }
    }

    this.practitionerResolver.resolveReference()
      .pipe(takeUntil(this.destroy$))
      .subscribe((reference) => {
        const resolvedId = this.extractPractitionerId(reference);
        if (!resolvedId) {
          return;
        }

        if (!this.pushTargetUserId) {
          this.pushTargetUserId = resolvedId;
        }

        if (!this.preferenceUserId) {
          this.preferenceUserId = resolvedId;
          this.loadNotificationPreferences();
        }
      });
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  setTheme(theme: AppTheme): void {
    this.preferences.setTheme(theme);
  }

  setLanguage(language: AppLanguage): void {
    this.preferences.setLanguage(language);
  }

  setContrast(contrast: AccessibilityContrast): void {
    this.preferences.setAccessibilityPreferences({ contrast });
  }

  setColorMode(colorMode: AccessibilityColorMode): void {
    this.preferences.setAccessibilityPreferences({ colorMode });
  }

  setTextScale(textScale: number): void {
    this.preferences.setAccessibilityPreferences({ textScale });
  }

  setLineHeightScale(lineHeightScale: number): void {
    this.preferences.setAccessibilityPreferences({ lineHeightScale });
  }

  toggleReduceMotion(reduceMotion: boolean): void {
    this.preferences.setAccessibilityPreferences({ reduceMotion });
  }

  async togglePush(enable: boolean): Promise<void> {
    if (!this.pushTargetUserId) {
      return;
    }

    await this.pushService.setPushEnabled(this.pushTargetUserId, enable);
  }

  sendPushTest(): void {
    if (!this.pushTargetUserId || this.isSendingPushTest) {
      return;
    }

    this.isSendingPushTest = true;
    this.pushTestFeedbackKey = '';
    this.pushTestFeedbackTone = null;

    this.userNotificationService.sendPushTest(this.pushTargetUserId)
      .pipe(
        takeUntil(this.destroy$),
        finalize(() => {
          this.isSendingPushTest = false;
        })
      )
      .subscribe({
        next: () => {
          this.pushTestFeedbackKey = 'settings.notifications.pushTestSent';
          this.pushTestFeedbackTone = 'success';
        },
        error: () => {
          this.pushTestFeedbackKey = 'settings.notifications.pushTestError';
          this.pushTestFeedbackTone = 'error';
        }
      });
  }

  sendPushScenarioTests(): void {
    if (!this.pushTargetUserId || this.isSendingPushScenarioTests) {
      return;
    }

    this.isSendingPushScenarioTests = true;
    this.pushTestFeedbackKey = '';
    this.pushTestFeedbackTone = null;

    this.userNotificationService.sendPushScenarioTests(this.pushTargetUserId)
      .pipe(
        takeUntil(this.destroy$),
        finalize(() => {
          this.isSendingPushScenarioTests = false;
        })
      )
      .subscribe({
        next: () => {
          this.pushTestFeedbackKey = 'settings.notifications.pushScenarioTestSent';
          this.pushTestFeedbackTone = 'success';
        },
        error: () => {
          this.pushTestFeedbackKey = 'settings.notifications.pushScenarioTestError';
          this.pushTestFeedbackTone = 'error';
        }
      });
  }

  setActiveTab(tab: 'general' | 'notifications'): void {
    if (this.activeTab === tab && this.route.snapshot.paramMap.get('tab') === tab) {
      return;
    }

    this.router.navigate(['/parametres', tab]);
  }

  subcategoryForms(categoryIndex: number): FormArray<FormGroup> {
    return this.categoryForms.at(categoryIndex).get('subcategories') as FormArray<FormGroup>;
  }

  get selectedNotificationCategoryIndex(): number {
    if (!this.notificationCategories.length) {
      return -1;
    }

    const index = this.notificationCategories.findIndex(
      (category) => category.key === this.activeNotificationCategoryKey
    );

    return index >= 0 ? index : 0;
  }

  selectNotificationCategory(categoryKey: string): void {
    this.activeNotificationCategoryKey = categoryKey;
  }

  saveNotificationPreferences(): void {
    if (!this.preferenceUserId || this.notificationPreferencesForm.invalid || this.isSavingPreferences) {
      return;
    }

    this.isSavingPreferences = true;
    this.saveFeedbackKey = '';
    this.saveFeedbackTone = null;

    this.notificationPreferencesService.updatePreferences(this.preferenceUserId, this.buildPreferenceUpdates())
      .pipe(
        takeUntil(this.destroy$),
        finalize(() => {
          this.isSavingPreferences = false;
        })
      )
      .subscribe({
        next: (response) => {
          this.notificationCategories = response.categories;
          this.buildPreferencesForm(response.categories);
          this.saveFeedbackKey = 'settings.notifications.saved';
          this.saveFeedbackTone = 'success';
        },
        error: () => {
          this.saveFeedbackKey = 'settings.notifications.saveError';
          this.saveFeedbackTone = 'error';
        }
      });
  }

  private loadNotificationPreferences(): void {
    if (!this.preferenceUserId || this.isLoadingPreferences) {
      return;
    }

    this.isLoadingPreferences = true;
    this.notificationPreferencesService.getPreferences(this.preferenceUserId)
      .pipe(
        takeUntil(this.destroy$),
        finalize(() => {
          this.isLoadingPreferences = false;
        })
      )
      .subscribe({
        next: (response) => {
          this.notificationCategories = response.categories;
          this.ensureSelectedNotificationCategory();
          this.buildPreferencesForm(response.categories);
        },
        error: () => {
          this.notificationCategories = [];
          this.activeNotificationCategoryKey = '';
          this.categoryForms.clear();
        }
      });
  }

  private buildPreferencesForm(categories: NotificationPreferenceCategory[]): void {
    const categoryGroups = categories.map((category) => this.formBuilder.group({
      key: this.formBuilder.control(category.key, { nonNullable: true }),
      preference: this.buildPreferenceGroup(category.preference),
      subcategories: this.formBuilder.array(
        category.subcategories.map((subcategory) => this.formBuilder.group({
          key: this.formBuilder.control(subcategory.key, { nonNullable: true }),
          preference: this.buildPreferenceGroup(subcategory.preference)
        }))
      )
    }));

    this.notificationPreferencesForm.setControl('categories', this.formBuilder.array(categoryGroups));
    this.notificationPreferencesForm.markAsPristine();
  }

  private ensureSelectedNotificationCategory(): void {
    if (!this.notificationCategories.length) {
      this.activeNotificationCategoryKey = '';
      return;
    }

    const exists = this.notificationCategories.some(
      (category) => category.key === this.activeNotificationCategoryKey
    );

    if (!exists) {
      this.activeNotificationCategoryKey = this.notificationCategories[0].key;
    }
  }

  private buildPreferenceGroup(preference: NotificationPreferenceValue): FormGroup {
    return this.formBuilder.group({
      enabled: this.formBuilder.control(preference.enabled, { nonNullable: true }),
      priority: this.formBuilder.control<NotificationPriority>(preference.priority, { nonNullable: true }),
      channels: this.formBuilder.group({
        push: this.formBuilder.control(preference.channels.push, { nonNullable: true }),
        email: this.formBuilder.control(preference.channels.email, { nonNullable: true }),
        sms: this.formBuilder.control(preference.channels.sms, { nonNullable: true })
      })
    });
  }

  private buildPreferenceUpdates(): NotificationPreferenceUpdate[] {
    return this.categoryForms.controls.flatMap((categoryControl) => {
      const categoryValue = categoryControl.getRawValue() as {
        key: string;
        preference: NotificationPreferenceValue;
        subcategories: Array<{ key: string; preference: NotificationPreferenceValue }>;
      };

      return [
        {
          categoryKey: categoryValue.key,
          preference: categoryValue.preference
        },
        ...categoryValue.subcategories.map((subcategory) => ({
          categoryKey: categoryValue.key,
          subcategoryKey: subcategory.key,
          preference: subcategory.preference
        }))
      ];
    });
  }

  private resolvePreferenceUserId(): string {
    const username = this.authService.getUsername().trim();
    if (username) {
      return username;
    }

    return this.authService.getConnectedPractitionerId();
  }

  private resolvePushTargetUserId(): string {
    return this.authService.getConnectedPractitionerId();
  }

  private extractPractitionerId(reference: string): string {
    const value = String(reference || '').trim();
    if (!value) {
      return '';
    }

    const prefix = 'Practitioner/';
    return value.startsWith(prefix) ? value.slice(prefix.length).trim() : value;
  }

  private normalizeTab(value: string | null): 'general' | 'notifications' {
    return value === 'notifications' ? 'notifications' : 'general';
  }
}
