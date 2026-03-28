import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router } from '@angular/router';
import { Subject, takeUntil } from 'rxjs';
import { ModuleShellComponent, ModuleBreadcrumb } from '../../../shared/components/module-shell/module-shell.component';
import { BubbleCardComponent } from '../../../shared/components/bubble-card/bubble-card.component';
import { PatientDetailsFormComponent } from '../features/patient-details/components/patient-details-form.component';
import { PatientProfile } from '../models/patient-admin.model';
import { FhirPatientAdminService } from '../services/fhir-patient-admin.service';
import { ToastService } from '../../../core/services/toast.service';
import { TranslateModule, TranslateService } from '@ngx-translate/core';

@Component({
  selector: 'app-patient-detail-page',
  standalone: true,
  imports: [CommonModule, ModuleShellComponent, BubbleCardComponent, PatientDetailsFormComponent, TranslateModule],
  templateUrl: './patient-detail-page.component.html',
  styleUrl: './patient-detail-page.component.scss'
})
export class PatientDetailPageComponent implements OnInit, OnDestroy {
  breadcrumbs: ModuleBreadcrumb[] = [
    { label: 'menu.patients', route: '/patients' },
    { label: 'patients.detailPage.patient' }
  ];

  loading = false;
  error = '';
  createMode = false;
  patient: PatientProfile | null = null;

  private patientId = '';
  private readonly destroy$ = new Subject<void>();

  constructor(
    private readonly route: ActivatedRoute,
    private readonly router: Router,
    private readonly patientService: FhirPatientAdminService,
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

        this.patientId = id;
        this.createMode = id === 'new';

        if (this.createMode) {
          this.patient = {
            id: '',
            firstName: '',
            lastName: '',
            birthDate: '',
            gender: 'unknown',
            email: '',
            phoneNumber: '',
            address: '',
            city: '',
            postalCode: '',
            country: ''
          };
          this.breadcrumbs = [
            { label: 'menu.patients', route: '/patients' },
            { label: 'patients.detailPage.newPatient' }
          ];
          return;
        }

        this.loadPatient(id);
      });
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  onSave(patient: PatientProfile): void {
    this.loading = true;
    this.error = '';

    const operation$ = this.createMode
      ? this.patientService.createPatient(patient)
      : this.patientService.updatePatient(this.patientId, patient);

    operation$.subscribe({
      next: (saved) => {
        this.loading = false;
        this.patient = saved;
        this.toastService.success(
          this.translateService.instant(
            this.createMode ? 'patients.detailPage.createdSuccess' : 'patients.detailPage.updatedSuccess'
          )
        );

        if (this.createMode && saved.id) {
          this.router.navigate(['/patients', saved.id]);
          return;
        }

        this.breadcrumbs = [
          { label: 'menu.patients', route: '/patients' },
          { label: `${saved.firstName} ${saved.lastName}`.trim() || 'patients.detailPage.patient' }
        ];
      },
      error: (error: unknown) => {
        this.loading = false;
        this.error = this.formatError(error);
      }
    });
  }

  private loadPatient(id: string): void {
    this.loading = true;
    this.patientService.getPatient(id).subscribe({
      next: (patient) => {
        this.patient = patient;
        this.loading = false;
        this.breadcrumbs = [
          { label: 'menu.patients', route: '/patients' },
          { label: `${patient.firstName} ${patient.lastName}`.trim() || 'patients.detailPage.patient' }
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
