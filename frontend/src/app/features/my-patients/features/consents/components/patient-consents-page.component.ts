import { Component, OnDestroy, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { Store } from '@ngrx/store';
import { Subject, takeUntil, switchMap, of } from 'rxjs';
import { ModuleShellComponent, ModuleBreadcrumb } from '../../../../../shared/components/module-shell/module-shell.component';
import { TranslateModule } from '@ngx-translate/core';
import * as PatientActions from '../../../state/patient.actions';
import * as PatientSelectors from '../../../state/patient.selectors';
import { FhirPatientConsentService, ConsentSaveInput } from '../services/fhir-patient-consent.service';
import { PatientConsentSummary, CONSENT_ACTION_OPTIONS, ConsentActionOption } from '../models/patient-consent.model';
import { FhirCareTeamService } from '../../care-team/services/fhir-care-team.service';
import { AuthService } from '../../../../../core/services/auth.service';

@Component({
  selector: 'app-patient-consents-page',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, ModuleShellComponent, TranslateModule],
  templateUrl: './patient-consents-page.component.html',
  styleUrl: './patient-consents-page.component.scss'
})
export class PatientConsentsPageComponent implements OnInit, OnDestroy {
  readonly consentActionOptions: ConsentActionOption[] = CONSENT_ACTION_OPTIONS;

  breadcrumbs: ModuleBreadcrumb[] = [
    { label: 'menu.myPatients', route: '/my-patients' },
    { label: 'patients.detailPage.patient', route: '' },
    { label: 'consents.title' }
  ];

  patientId = '';
  patientName = '';

  loading = true;
  saving = false;
  error = '';
  savedSuccess = false;

  consentId: string | null = null;
  consentForm: FormGroup;

  private readonly destroy$ = new Subject<void>();

  constructor(
    private readonly fb: FormBuilder,
    private readonly route: ActivatedRoute,
    private readonly router: Router,
    private readonly store: Store,
    private readonly consentService: FhirPatientConsentService,
    private readonly careTeamService: FhirCareTeamService,
    private readonly authService: AuthService
  ) {
    const actionsGroup: Record<string, boolean> = {};
    for (const action of CONSENT_ACTION_OPTIONS) {
      actionsGroup[action.code] = true;
    }
    this.consentForm = this.fb.group({
      granted: [true, Validators.required],
      actions: this.fb.group(actionsGroup),
      confidentiality: ['N', Validators.required],
      periodStart: [''],
      periodEnd: [''],
      note: ['']
    });
  }

  ngOnInit(): void {
    this.route.paramMap.pipe(takeUntil(this.destroy$)).subscribe((params) => {
      const id = params.get('id') || '';
      this.patientId = id;

      if (id) {
        this.store.dispatch(PatientActions.loadPatient({ id }));
      }

      this.store.select(PatientSelectors.selectSelectedPatient)
        .pipe(takeUntil(this.destroy$))
        .subscribe((patient) => {
          if (patient) {
            this.patientName = `${patient.firstName} ${patient.lastName}`.trim();
            this.breadcrumbs = [
              { label: 'menu.myPatients', route: '/my-patients' },
              { label: this.patientName, route: `/my-patients/${patient.id}` },
              { label: 'consents.title' }
            ];
          }
        });

      if (id) {
        this.loadConsent(id);
      }
    });
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  get selectedActions(): string[] {
    const actionsGroup = this.consentForm.get('actions')?.value || {};
    return Object.keys(actionsGroup).filter((k) => actionsGroup[k]);
  }

  get isEditMode(): boolean {
    return !!this.consentId;
  }

  private loadConsent(patientId: string): void {
    this.loading = true;
    this.error = '';
    this.consentService.getFirstConsentForPatient(patientId).subscribe({
      next: (consent) => {
        this.loading = false;
        if (consent) {
          this.consentId = consent.id;
          this.patchForm(consent);
        }
      },
      error: () => {
        this.loading = false;
        this.error = 'Impossible de charger le consentement.';
      }
    });
  }

  private patchForm(consent: PatientConsentSummary): void {
    const actionsValue: Record<string, boolean> = {};
    for (const action of CONSENT_ACTION_OPTIONS) {
      actionsValue[action.code] = consent.actions.includes(action.code);
    }

    this.consentForm.patchValue({
      granted: consent.granted,
      actions: actionsValue,
      confidentiality: consent.confidentiality,
      periodStart: consent.periodStart || '',
      periodEnd: consent.periodEnd || '',
      note: consent.note || ''
    });
  }

  save(): void {
    if (this.saving) return;
    this.saving = true;
    this.error = '';
    this.savedSuccess = false;

    const cv = this.consentForm.value;
    const now = new Date().toISOString();
    const patientRef = `Patient/${this.patientId}`;
    const actions = this.selectedActions.length > 0
      ? this.selectedActions
      : CONSENT_ACTION_OPTIONS.map((a) => a.code);

    this.careTeamService.getOrCreateCareTeamReference(this.patientId).subscribe({
      next: (careTeamRef) => {
        const input: ConsentSaveInput = {
          patientReference: patientRef,
          granted: Boolean(cv.granted),
          actions,
          confidentiality: cv.confidentiality === 'R' ? 'R' : 'N',
          periodStart: cv.periodStart?.trim() || undefined,
          periodEnd: cv.periodEnd?.trim() || undefined,
          note: cv.note?.trim() || undefined,
          dateTime: now,
          verifiedWithReference: patientRef,
          grantorReference: careTeamRef || undefined
        };

        const op$ = this.consentId
          ? this.consentService.updateConsent(this.consentId, input)
          : this.consentService.createConsent(input);

        op$.subscribe({
          next: (saved) => {
            this.saving = false;
            this.savedSuccess = true;
            this.consentId = saved.id || this.consentId;
          },
          error: (err) => {
            this.saving = false;
            this.error = err?.message || 'Erreur lors de la sauvegarde.';
          }
        });
      },
      error: () => {
        // proceed without careTeam ref
        const input: ConsentSaveInput = {
          patientReference: patientRef,
          granted: Boolean(cv.granted),
          actions,
          confidentiality: cv.confidentiality === 'R' ? 'R' : 'N',
          periodStart: cv.periodStart?.trim() || undefined,
          periodEnd: cv.periodEnd?.trim() || undefined,
          note: cv.note?.trim() || undefined,
          dateTime: now,
          verifiedWithReference: patientRef
        };

        const op$ = this.consentId
          ? this.consentService.updateConsent(this.consentId, input)
          : this.consentService.createConsent(input);

        op$.subscribe({
          next: (saved) => {
            this.saving = false;
            this.savedSuccess = true;
            this.consentId = saved.id || this.consentId;
          },
          error: (err) => {
            this.saving = false;
            this.error = err?.message || 'Erreur lors de la sauvegarde.';
          }
        });
      }
    });
  }

  goBack(): void {
    this.router.navigate(['/my-patients', this.patientId]);
  }
}
