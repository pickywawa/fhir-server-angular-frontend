import { Component, OnDestroy, OnInit } from '@angular/core';

import { ActivatedRoute, Router } from '@angular/router';
import { Subject, takeUntil } from 'rxjs';
import { ModuleShellComponent, ModuleBreadcrumb } from '../../../shared/components/module-shell/module-shell.component';
import { BubbleCardComponent } from '../../../shared/components/bubble-card/bubble-card.component';
import { PractitionerDetailsFormComponent } from '../features/practitioner-details/components/practitioner-details-form.component';
import { EMPTY_PRACTITIONER_PROFILE, PractitionerProfile } from '../models/practitioner.model';
import { FhirPractitionerService } from '../services/fhir-practitioner.service';
import { ToastService } from '../../../core/services/toast.service';
import { TranslateModule, TranslateService } from '@ngx-translate/core';

@Component({
  selector: 'app-practitioner-detail-page',
  standalone: true,
  imports: [ModuleShellComponent, BubbleCardComponent, PractitionerDetailsFormComponent, TranslateModule],
  templateUrl: './practitioner-detail-page.component.html',
  styleUrl: './practitioner-detail-page.component.scss'
})
export class PractitionerDetailPageComponent implements OnInit, OnDestroy {
  breadcrumbs: ModuleBreadcrumb[] = [
    { label: 'menu.professionals', route: '/practitioners' },
    { label: 'practitioners.detail.practitioner' }
  ];

  loading = false;
  error = '';
  createMode = false;
  practitioner: PractitionerProfile | null = null;

  private practitionerId = '';
  private readonly destroy$ = new Subject<void>();

  constructor(
    private readonly route: ActivatedRoute,
    private readonly router: Router,
    private readonly practitionerService: FhirPractitionerService,
    private readonly toastService: ToastService,
    private readonly translateService: TranslateService
  ) {}

  ngOnInit(): void {
    this.route.paramMap
      .pipe(takeUntil(this.destroy$))
      .subscribe((params) => {
        const id = params.get('id');
        if (!id) {
          return;
        }

        this.practitionerId = id;
        this.createMode = id === 'new';

        if (this.createMode) {
          this.practitioner = { ...EMPTY_PRACTITIONER_PROFILE };
          this.breadcrumbs = [
            { label: 'menu.professionals', route: '/practitioners' },
            { label: 'practitioners.detail.newPractitioner' }
          ];
          return;
        }

        this.loadPractitioner(id);
      });
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  onSave(practitioner: PractitionerProfile): void {
    this.loading = true;
    this.error = '';

    const operation$ = this.createMode
      ? this.practitionerService.createPractitioner(practitioner)
      : this.practitionerService.updatePractitioner(this.practitionerId, practitioner);

    operation$.subscribe({
      next: (saved) => {
        this.loading = false;
        this.practitioner = saved;
        this.toastService.success(
          this.translateService.instant(
            this.createMode ? 'practitioners.detail.createdSuccess' : 'practitioners.detail.updatedSuccess'
          )
        );

        if (this.createMode && saved.id) {
          this.router.navigate(['/practitioners', saved.id]);
          return;
        }

        this.breadcrumbs = [
          { label: 'menu.professionals', route: '/practitioners' },
          { label: `${saved.firstName} ${saved.lastName}`.trim() || 'practitioners.detail.practitioner' }
        ];
      },
      error: (error: unknown) => {
        this.loading = false;
        this.error = this.formatError(error);
      }
    });
  }

  private loadPractitioner(id: string): void {
    this.loading = true;
    this.error = '';

    this.practitionerService.getPractitioner(id).subscribe({
      next: (practitioner) => {
        this.practitioner = practitioner;
        this.loading = false;
        this.breadcrumbs = [
          { label: 'menu.professionals', route: '/practitioners' },
          { label: `${practitioner.firstName} ${practitioner.lastName}`.trim() || 'practitioners.detail.practitioner' }
        ];
      },
      error: (error: unknown) => {
        this.loading = false;
        this.error = this.formatError(error);
      }
    });
  }

  private formatError(error: unknown): string {
    if (error instanceof Error) {
      return error.message;
    }
    if (typeof error === 'string') {
      return error;
    }
    if (error && typeof error === 'object' && 'message' in error) {
      return String((error as { message: unknown }).message);
    }
    return this.translateService.instant('common.unknownError');
  }
}
