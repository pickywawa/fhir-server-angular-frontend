import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule, FormBuilder, FormGroup } from '@angular/forms';
import { AuthService } from '../../../core/services/auth.service';
import { KeycloakAccountService } from '../../../core/services/keycloak-account.service';
import { ConnectedPractitionerResolverService } from '../../../core/services/connected-practitioner-resolver.service';
import { ToastService } from '../../../core/services/toast.service';
import { ModuleShellComponent, ModuleBreadcrumb } from '../../../shared/components/module-shell/module-shell.component';
import { BubbleCardComponent } from '../../../shared/components/bubble-card/bubble-card.component';

@Component({
  selector: 'app-profile-page',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, ModuleShellComponent, BubbleCardComponent],
  templateUrl: './profile-page.component.html',
  styleUrl: './profile-page.component.scss'
})
export class ProfilePageComponent implements OnInit {
  protected readonly auth = inject(AuthService);
  private readonly accountService = inject(KeycloakAccountService);
  private readonly practitionerResolver = inject(ConnectedPractitionerResolverService);
  private readonly toast = inject(ToastService);
  private readonly fb = inject(FormBuilder);

  editMode = false;
  saving = false;
  loading = false;

  readonly breadcrumbs: ModuleBreadcrumb[] = [{ label: 'Mon compte' }];

  form!: FormGroup;

  ngOnInit(): void {
    const hints = this.auth.getConnectedUserHints();
    this.form = this.fb.group({
      login: [{ value: hints.username, disabled: true }],
      firstName: [{ value: hints.firstName, disabled: true }],
      lastName: [{ value: hints.lastName, disabled: true }],
      email: [{ value: hints.email, disabled: true }],
      phone: [{ value: this.auth.getPhoneNumber(), disabled: true }],
      practitionerId: [{ value: this.auth.getConnectedPractitionerId(), disabled: true }]
    });

    this.practitionerResolver.resolveReference().subscribe({
      next: (reference) => {
        const id = this.extractPractitionerId(reference);
        if (id) {
          this.form.patchValue({ practitionerId: id });
        }
      }
    });

    this.loading = true;
    this.accountService.getAccountInfo().subscribe({
      next: (info) => {
        this.loading = false;
        const current = this.form.getRawValue();
        this.form.patchValue({
          firstName: info.firstName ?? current.firstName,
          lastName: info.lastName ?? current.lastName,
          email: info.email ?? current.email,
          phone:
            info.attributes?.['phoneNumber']?.[0] ??
            info.attributes?.['phone_number']?.[0] ??
            current.phone,
          practitionerId:
            this.extractPractitionerId(info.attributes?.['practitioner_id']?.[0] ?? '') ||
            current.practitionerId
        });
      },
      error: () => {
        this.loading = false;
      }
    });
  }

  startEdit(): void {
    this.editMode = true;
    this.form.get('firstName')?.enable();
    this.form.get('lastName')?.enable();
    this.form.get('email')?.enable();
    this.form.get('phone')?.enable();
    this.form.get('practitionerId')?.enable();
  }

  cancel(): void {
    this.editMode = false;
    this.form.get('firstName')?.disable();
    this.form.get('lastName')?.disable();
    this.form.get('email')?.disable();
    this.form.get('phone')?.disable();
    this.form.get('practitionerId')?.disable();
  }

  save(): void {
    this.saving = true;
    const raw = this.form.getRawValue();
    const attributes: Record<string, string[]> = {};
    if (raw.phone) { attributes['phoneNumber'] = [raw.phone]; }
    if (raw.practitionerId) { attributes['practitioner_id'] = [raw.practitionerId]; }

    this.accountService.updateAccountInfo({
      firstName: raw.firstName,
      lastName: raw.lastName,
      email: raw.email,
      attributes
    }).subscribe({
      next: () => {
        this.saving = false;
        this.cancel();
        this.toast.success('Profil enregistré avec succès.');
      },
      error: (err: { status?: number }) => {
        this.saving = false;
        const msg =
          err?.status === 403
            ? 'Accès refusé. Vérifiez les droits du compte sur Keycloak.'
            : 'Erreur lors de la mise à jour du profil.';
        this.toast.error(msg);
      }
    });
  }

  private extractPractitionerId(reference: string): string {
    const value = String(reference || '').trim();
    if (!value) {
      return '';
    }

    const forbiddenValues = new Set(['openid', 'profile', 'email', 'roles', 'offline_access', 'microprofile-jwt']);
    if (forbiddenValues.has(value)) {
      return '';
    }

    const prefix = 'Practitioner/';
    return value.startsWith(prefix) ? value.slice(prefix.length).trim() : value;
  }
}
