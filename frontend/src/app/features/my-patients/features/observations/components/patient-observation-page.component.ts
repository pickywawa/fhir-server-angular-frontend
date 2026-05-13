import { Component, Input, OnChanges, OnDestroy, OnInit, SimpleChanges } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { Store } from '@ngrx/store';
import { Subject, takeUntil, debounceTime, distinctUntilChanged, switchMap } from 'rxjs';
import { of } from 'rxjs';
import { ModuleShellComponent, ModuleBreadcrumb } from '../../../../../shared/components/module-shell/module-shell.component';
import { TranslateModule } from '@ngx-translate/core';
import * as PatientActions from '../../../state/patient.actions';
import * as PatientSelectors from '../../../state/patient.selectors';
import { FhirPatientObservationService } from '../services/fhir-patient-observation.service';
import { AuthService } from '../../../../../core/services/auth.service';
import { LoincSearchService, LoincSuggestion } from '../../../../../core/services/loinc-search.service';
import { ChatAssistantStateService } from '../../../../../core/services/chat-assistant-state.service';
import {
  ObservationDetail,
  ObservationSaveInput,
  ObservationValueType,
  OBSERVATION_CATEGORIES,
  OBSERVATION_VALUE_TYPES,
  OBSERVATION_INTERPRETATIONS
} from '../models/patient-observation.model';

@Component({
  selector: 'app-patient-observation-page',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, ModuleShellComponent, TranslateModule],
  templateUrl: './patient-observation-page.component.html',
  styleUrl: './patient-observation-page.component.scss'
})
export class PatientObservationPageComponent implements OnInit, OnDestroy {
  @Input() embedded = false;
  @Input() patientIdInput?: string;
  @Input() observationIdInput?: string | null;
  @Input() returnViewInput?: 'close' | 'procedure';

  readonly categories = OBSERVATION_CATEGORIES;
  readonly valueTypes = OBSERVATION_VALUE_TYPES;
  readonly interpretations = OBSERVATION_INTERPRETATIONS;

  breadcrumbs: ModuleBreadcrumb[] = [
    { label: 'menu.myPatients', route: '/my-patients' },
    { label: 'patients.detailPage.patient', route: '' },
    { label: 'myPatients.observations.title' }
  ];

  patientId = '';
  observationId: string | null = null;

  loading = true;
  saving = false;
  error = '';
  savedSuccess = false;

  // LOINC autocomplete
  loincSuggestions: LoincSuggestion[] = [];
  loincSearching = false;
  private readonly loincSearch$ = new Subject<string>();

  form: FormGroup;

  private readonly destroy$ = new Subject<void>();

  constructor(
    private readonly fb: FormBuilder,
    private readonly route: ActivatedRoute,
    private readonly router: Router,
    private readonly store: Store,
    private readonly observationService: FhirPatientObservationService,
    private readonly authService: AuthService,
    private readonly loincSearchService: LoincSearchService,
    private readonly dockState: ChatAssistantStateService
  ) {
    this.form = this.fb.group({
      categoryCode: ['', Validators.required],
      codeSystem: ['http://loinc.org'],
      codeCode: ['', Validators.required],
      codeDisplay: ['', Validators.required],
      valueType: ['string', Validators.required],
      valueString: [''],
      valueBoolean: [false],
      valueInteger: [null],
      valueDate: [''],
      effectiveDateTime: [new Date().toISOString().slice(0, 16)],
      interpretationCode: [''],
      note: ['']
    });
  }

  ngOnInit(): void {
    // LOINC autocomplete stream
    this.loincSearch$
      .pipe(
        debounceTime(300),
        distinctUntilChanged(),
        switchMap((query) => {
          if (query.trim().length < 2) {
            return of([]);
          }
          this.loincSearching = true;
          return this.loincSearchService.searchCodes(query).pipe(
            switchMap((results) => {
              this.loincSearching = false;
              return of(results);
            })
          );
        }),
        takeUntil(this.destroy$)
      )
      .subscribe((results) => {
        this.loincSuggestions = results;
        this.loincSearching = false;
      });

    if (this.embedded) {
      this.applyEmbeddedContext();
      return;
    }

    this.route.paramMap.pipe(takeUntil(this.destroy$)).subscribe((params) => {
      const id = params.get('id') ?? '';
      const obsId = params.get('obsId');
      this.applyContext(id, obsId === 'new' ? null : (obsId ?? null));
    });
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (!this.embedded) {
      return;
    }

    if (changes['patientIdInput'] || changes['observationIdInput']) {
      this.applyEmbeddedContext();
    }
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  get isEditMode(): boolean {
    return !!this.observationId;
  }

  get currentValueType(): ObservationValueType {
    return this.form.get('valueType')?.value ?? 'string';
  }

  onCodeSearchInput(event: Event): void {
    const value = (event.target as HTMLInputElement).value;
    this.loincSearch$.next(value);
  }

  selectLoincCode(suggestion: LoincSuggestion): void {
    this.form.patchValue({
      codeCode: suggestion.code,
      codeDisplay: suggestion.display,
      codeSystem: suggestion.system
    });
    this.loincSuggestions = [];
  }

  clearLoincSuggestions(): void {
    // Small delay to let click events fire before clearing
    setTimeout(() => {
      this.loincSuggestions = [];
    }, 150);
  }

  save(): void {
    if (this.saving || this.form.invalid) return;

    this.saving = true;
    this.error = '';
    this.savedSuccess = false;

    const v = this.form.value;
    const practitionerId = this.authService.getConnectedPractitionerId();

    const input: ObservationSaveInput = {
      patientReference: `Patient/${this.patientId}`,
      categoryCode: v.categoryCode,
      codeSystem: v.codeSystem?.trim() || 'http://loinc.org',
      codeCode: v.codeCode?.trim(),
      codeDisplay: v.codeDisplay?.trim(),
      valueType: v.valueType as ObservationValueType,
      effectiveDateTime: v.effectiveDateTime?.trim() || undefined,
      interpretationCode: v.interpretationCode?.trim() || undefined,
      note: v.note?.trim() || undefined,
      performerReference: practitionerId ? `Practitioner/${practitionerId}` : undefined,
      performerDisplay: practitionerId ? this.authService.getUsername() || undefined : undefined
    };

    switch (v.valueType as ObservationValueType) {
      case 'string':
        input.valueString = v.valueString ?? '';
        break;
      case 'boolean':
        input.valueBoolean = Boolean(v.valueBoolean);
        break;
      case 'integer':
        input.valueInteger = Number(v.valueInteger);
        break;
      case 'date':
        input.valueDate = v.valueDate ?? '';
        break;
    }

    const op$ = this.observationId
      ? this.observationService.updateObservation(this.observationId, input)
      : this.observationService.createObservation(input);

    op$.subscribe({
      next: (saved) => {
        this.saving = false;
        this.savedSuccess = true;
        if (this.embedded) {
          this.dockState.finishObservationDraft(this.patientId, saved);
          return;
        }

        if (!this.observationId) {
          this.observationId = saved.id;
        }
      },
      error: (err: unknown) => {
        this.saving = false;
        this.error = err instanceof Error ? err.message : 'Erreur lors de la sauvegarde.';
      }
    });
  }

  goBack(): void {
    if (this.embedded) {
      if (this.returnViewInput === 'procedure') {
        this.dockState.clearObservationDraft();
        this.dockState.open('procedure');
        return;
      }

      this.dockState.clearObservationDraft();
      return;
    }

    this.router.navigate(['/my-patients', this.patientId], { queryParams: { tab: 'observations' } });
  }

  private applyEmbeddedContext(): void {
    const patientId = (this.patientIdInput ?? '').trim();
    const observationId = (this.observationIdInput ?? '').trim() || null;
    this.applyContext(patientId, observationId);
  }

  private applyContext(patientId: string, observationId: string | null): void {
    this.patientId = patientId;
    this.observationId = observationId;

    if (!patientId) {
      this.loading = false;
      this.resetForm();
      return;
    }

    if (!this.embedded) {
      this.store.dispatch(PatientActions.loadPatient({ id: patientId }));
      this.store.select(PatientSelectors.selectSelectedPatient)
        .pipe(takeUntil(this.destroy$))
        .subscribe((patient) => {
          if (patient) {
            const name = `${patient.firstName} ${patient.lastName}`.trim();
            this.breadcrumbs = [
              { label: 'menu.myPatients', route: '/my-patients' },
              { label: name, route: `/my-patients/${patient.id}` },
              { label: 'myPatients.observations.title' }
            ];
          }
        });
    }

    if (observationId) {
      this.loadObservation(observationId);
      return;
    }

    this.loading = false;
    this.resetForm();
  }

  private resetForm(): void {
    this.form.reset({
      categoryCode: '',
      codeSystem: 'http://loinc.org',
      codeCode: '',
      codeDisplay: '',
      valueType: 'string',
      valueString: '',
      valueBoolean: false,
      valueInteger: null,
      valueDate: '',
      effectiveDateTime: new Date().toISOString().slice(0, 16),
      interpretationCode: '',
      note: ''
    });
  }

  private loadObservation(id: string): void {
    this.loading = true;
    this.error = '';
    this.observationService.getObservation(id).subscribe({
      next: (obs) => {
        this.loading = false;
        this.patchForm(obs);
      },
      error: () => {
        this.loading = false;
        this.error = 'Impossible de charger cette observation.';
      }
    });
  }

  private patchForm(obs: ObservationDetail): void {
    const valueType: ObservationValueType = obs.valueType ?? 'string';
    this.form.patchValue({
      categoryCode: obs.categoryCode,
      codeSystem: obs.codeSystem || 'http://loinc.org',
      codeCode: obs.codeCode,
      codeDisplay: obs.codeDisplay,
      valueType,
      valueString: obs.valueString ?? '',
      valueBoolean: obs.valueBoolean ?? false,
      valueInteger: obs.valueInteger ?? null,
      valueDate: obs.valueDate ?? '',
      effectiveDateTime: obs.effectiveDateTime ?? '',
      interpretationCode: obs.interpretationCode ?? '',
      note: obs.note ?? ''
    });
  }
}

