import {
  Component,
  EventEmitter,
  OnDestroy,
  OnInit,
  Output,
  inject
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { TranslateModule } from '@ngx-translate/core';
import { PushSubscriptionService } from '../../../core/services/push-subscription.service';
import { AuthService } from '../../../core/services/auth.service';
import { ConnectedPractitionerResolverService } from '../../../core/services/connected-practitioner-resolver.service';
import { Subject, takeUntil } from 'rxjs';

@Component({
  selector: 'app-push-permission-prompt',
  standalone: true,
  imports: [CommonModule, TranslateModule],
  template: `
    @if (visible) {
      <div class="push-prompt-overlay" role="dialog" aria-modal="true" [attr.aria-label]="'push.prompt.title' | translate">
        <div class="push-prompt">
          <div class="push-prompt__icon" aria-hidden="true">🔔</div>
          <div class="push-prompt__content">
            <p class="push-prompt__title">{{ 'push.prompt.title' | translate }}</p>
            <p class="push-prompt__desc">{{ 'push.prompt.description' | translate }}</p>
          </div>
          <div class="push-prompt__actions">
            <button class="btn btn-primary" (click)="accept()">
              {{ 'push.prompt.accept' | translate }}
            </button>
            <button class="btn btn-neutral" (click)="decline()">
              {{ 'push.prompt.decline' | translate }}
            </button>
          </div>
        </div>
      </div>
    }
  `,
  styles: [`
    .push-prompt-overlay {
      position: fixed;
      top: 1.5rem;
      left: 50%;
      transform: translateX(-50%);
      z-index: 10000;
      display: flex;
      justify-content: center;
      animation: slideDown 0.3s ease-out;
    }

    .push-prompt {
      display: flex;
      align-items: center;
      gap: 1rem;
      background: var(--card-bg);
      border: 1px solid var(--border-color);
      border-radius: 12px;
      padding: 1rem 1.5rem;
      box-shadow: 0 8px 32px rgba(0, 0, 0, 0.18);
      max-width: 520px;
      flex-wrap: wrap;
    }

    .push-prompt__icon {
      font-size: 1.75rem;
      flex-shrink: 0;
    }

    .push-prompt__content {
      flex: 1;
      min-width: 180px;
    }

    .push-prompt__title {
      font-weight: 600;
      color: var(--text-primary);
      margin: 0 0 0.25rem;
      font-size: 0.95rem;
    }

    .push-prompt__desc {
      color: var(--text-secondary);
      margin: 0;
      font-size: 0.85rem;
    }

    .push-prompt__actions {
      display: flex;
      gap: 0.5rem;
      flex-shrink: 0;
    }

    @keyframes slideDown {
      from { opacity: 0; transform: translateX(-50%) translateY(-16px); }
      to   { opacity: 1; transform: translateX(-50%) translateY(0); }
    }
  `]
})
export class PushPermissionPromptComponent implements OnInit, OnDestroy {
  @Output() accepted = new EventEmitter<void>();
  @Output() declined = new EventEmitter<void>();

  visible = false;

  private readonly pushService = inject(PushSubscriptionService);
  private readonly authService = inject(AuthService);
  private readonly practitionerResolver = inject(ConnectedPractitionerResolverService);
  private readonly destroy$ = new Subject<void>();
  private userId = '';

  ngOnInit(): void {
    if (!this.pushService.shouldAskPermission()) return;

    const fromClaims = this.authService.getConnectedPractitionerId();
    if (fromClaims) {
      this.userId = fromClaims;
      this.visible = true;
      return;
    }

    this.practitionerResolver.resolveReference()
      .pipe(takeUntil(this.destroy$))
      .subscribe((ref) => {
        const id = ref?.includes('/') ? ref.split('/')[1] : ref;
        if (id) {
          this.userId = id;
          this.visible = true;
        }
      });
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  async accept(): Promise<void> {
    this.visible = false;
    await this.pushService.requestPermissionAndSubscribe(this.userId);
    this.accepted.emit();
  }

  decline(): void {
    this.pushService.markPermissionAsked();
    this.visible = false;
    this.declined.emit();
  }
}
