import { Component, Input, OnChanges, OnDestroy, OnInit, SimpleChanges } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { Store } from '@ngrx/store';
import { Subject, takeUntil, debounceTime, distinctUntilChanged, switchMap, of } from 'rxjs';
import { ModuleShellComponent, ModuleBreadcrumb } from '../../../../../shared/components/module-shell/module-shell.component';
import { TranslateModule } from '@ngx-translate/core';
import * as PatientActions from '../../../state/patient.actions';
import * as PatientSelectors from '../../../state/patient.selectors';
import { FhirPatientProcedureService } from '../services/fhir-patient-procedure.service';
import { AuthService } from '../../../../../core/services/auth.service';
import {
  ProcedureDetail,
  ProcedureSaveInput,
  PROCEDURE_STATUSES,
  SnomedSuggestion,
  PerformerOption
} from '../models/patient-procedure.model';
import { PatientObservationsComponent } from '../../observations/components/patient-observations.component';
import { PatientTimelineComponent } from '../../timeline/components/patient-timeline.component';
import { ChatAssistantStateService } from '../../../../../core/services/chat-assistant-state.service';

type ProcedureEditorTab = 'details' | 'measures' | 'report' | 'interventions';

@Component({
  selector: 'app-patient-procedure-page',
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    ModuleShellComponent,
    TranslateModule,
    PatientObservationsComponent,
    PatientTimelineComponent
  ],
  templateUrl: './patient-procedure-page.component.html',
  styleUrl: './patient-procedure-page.component.scss'
})
export class PatientProcedurePageComponent implements OnInit, OnChanges, OnDestroy {
  @Input() embedded = false;
  @Input() patientIdInput?: string;
  @Input() procedureIdInput?: string;

  readonly statuses = PROCEDURE_STATUSES;

  breadcrumbs: ModuleBreadcrumb[] = [
    { label: 'menu.myPatients', route: '/my-patients' },
    { label: 'patients.detailPage.patient', route: '' },
    { label: 'myPatients.procedures.title' }
  ];

  patientId = '';
  procedureId: string | null = null;
  carePlanReference?: string;

  loading = true;
  saving = false;
  error = '';
  savedSuccess = false;
  activeTab: ProcedureEditorTab = 'details';
  measuresRefreshToken = 0;
  interventionsRefreshToken = 0;

  // SNOMED autocomplete
  snomedSuggestions: SnomedSuggestion[] = [];
  snomedSearching = false;
  private readonly snomedSearch$ = new Subject<string>();

  // Performer search
  performerSearchResults: PerformerOption[] = [];
  performerSearching = false;
  selectedPerformers: PerformerOption[] = [];
  private readonly performerSearch$ = new Subject<string>();

  form: FormGroup;

  private readonly destroy$ = new Subject<void>();

  constructor(
    private readonly fb: FormBuilder,
    private readonly route: ActivatedRoute,
    private readonly router: Router,
    private readonly store: Store,
    private readonly procedureService: FhirPatientProcedureService,
    private readonly authService: AuthService,
    private readonly utilityDockState: ChatAssistantStateService
  ) {
    const now = new Date().toISOString().slice(0, 16);
    this.form = this.fb.group({
      status: ['in-progress', Validators.required],
      codeSystem: ['http://snomed.info/sct'],
      codeCode: ['', Validators.required],
      codeDisplay: ['', Validators.required],
      occurrenceStart: [now, Validators.required],
      occurrenceEnd: [''],
      recorded: [now],
      location: [''],
      performerSearch: [''],
      note: [''],
      createDiagnosticReport: [false],
      diagnosticReportConclusion: ['']
    });
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (!this.embedded) {
      return;
    }

    const patientChanged = !!changes['patientIdInput'];
    const procedureChanged = !!changes['procedureIdInput'];
    if (!patientChanged && !procedureChanged) {
      return;
    }

    const patientId = String(this.patientIdInput || '').trim();
    if (!patientId) {
      return;
    }

    const procedureId = String(this.procedureIdInput || '').trim() || null;
    this.initializeForPatient(patientId, procedureId);
  }

  ngOnInit(): void {
    // SNOMED autocomplete stream
    this.snomedSearch$
      .pipe(
        debounceTime(300),
        distinctUntilChanged(),
        switchMap((query) => {
          if (query.trim().length < 2) {
            this.snomedSearching = false;
            return of([]);
          }
          this.snomedSearching = true;
          return this.procedureService.searchSnomedProcedures(query).pipe(
            switchMap((results) => {
              this.snomedSearching = false;
              return of(results);
            })
          );
        }),
        takeUntil(this.destroy$)
      )
      .subscribe((results) => {
        this.snomedSuggestions = results;
        this.snomedSearching = false;
      });

    // Performer search stream
    this.performerSearch$
      .pipe(
        debounceTime(300),
        distinctUntilChanged(),
        switchMap((query) => {
          if (query.trim().length < 2) {
            this.performerSearching = false;
            return of([]);
          }
          this.performerSearching = true;
          return this.procedureService.searchPractitioners(query).pipe(
            switchMap((results) => {
              this.performerSearching = false;
              return of(results);
            })
          );
        }),
        takeUntil(this.destroy$)
      )
      .subscribe((results) => {
        this.performerSearchResults = results.filter(
          (r) => !this.selectedPerformers.some((s) => s.reference === r.reference)
        );
        this.performerSearching = false;
      });

    if (this.embedded && this.patientIdInput) {
      this.initializeForPatient(this.patientIdInput, String(this.procedureIdInput || '').trim() || null);
    } else {
      this.route.paramMap.pipe(takeUntil(this.destroy$)).subscribe((params) => {
      const id = params.get('id') ?? '';
      const procId = params.get('procId');
        this.initializeForPatient(id, procId === 'new' ? null : (procId ?? null));
      });

      // carePlan queryParam
      this.route.queryParamMap.pipe(takeUntil(this.destroy$)).subscribe((qp) => {
        const cp = qp.get('carePlan');
        if (cp) this.carePlanReference = cp;
      });
    }
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  get isEditMode(): boolean {
    return !!this.procedureId;
  }

  get hasReportText(): boolean {
    return String(this.form.get('diagnosticReportConclusion')?.value || '').trim().length > 0;
  }

  get occurrenceStartFilter(): string | null {
    return String(this.form.get('occurrenceStart')?.value || '').trim() || null;
  }

  get occurrenceEndFilter(): string | null {
    return String(this.form.get('occurrenceEnd')?.value || '').trim() || null;
  }

  selectTab(tab: ProcedureEditorTab): void {
    this.activeTab = tab;
    if (tab === 'measures') {
      this.measuresRefreshToken += 1;
    }
    if (tab === 'interventions') {
      this.interventionsRefreshToken += 1;
    }
  }

  onCodeSearchInput(event: Event): void {
    const value = (event.target as HTMLInputElement).value;
    this.snomedSearch$.next(value);
  }

  selectSnomedCode(suggestion: SnomedSuggestion): void {
    this.form.patchValue({
      codeCode: suggestion.code,
      codeDisplay: suggestion.display,
      codeSystem: suggestion.system
    });
    this.snomedSuggestions = [];
  }

  clearSnomedSuggestions(): void {
    setTimeout(() => { this.snomedSuggestions = []; }, 150);
  }

  onPerformerSearchInput(event: Event): void {
    const value = (event.target as HTMLInputElement).value;
    this.performerSearch$.next(value);
  }

  selectPerformer(performer: PerformerOption): void {
    if (!this.selectedPerformers.some((p) => p.reference === performer.reference)) {
      this.selectedPerformers = [...this.selectedPerformers, performer];
    }
    this.form.patchValue({ performerSearch: '' });
    this.performerSearchResults = [];
  }

  removePerformer(performer: PerformerOption): void {
    this.selectedPerformers = this.selectedPerformers.filter((p) => p.reference !== performer.reference);
  }

  clearPerformerSuggestions(): void {
    setTimeout(() => { this.performerSearchResults = []; }, 150);
  }

  save(): void {
    if (this.saving || this.form.invalid) return;

    this.saving = true;
    this.error = '';
    this.savedSuccess = false;

    const v = this.form.value;
    const practitionerId = this.authService.getConnectedPractitionerId();

    const input: ProcedureSaveInput = {
      patientReference: `Patient/${this.patientId}`,
      basedOnReference: this.carePlanReference || undefined,
      recorderReference: practitionerId ? `Practitioner/${practitionerId}` : undefined,
      status: v.status,
      codeSystem: v.codeSystem?.trim() || 'http://snomed.info/sct',
      codeCode: v.codeCode?.trim(),
      codeDisplay: v.codeDisplay?.trim(),
      occurrenceStart: v.occurrenceStart,
      occurrenceEnd: v.occurrenceEnd?.trim() || undefined,
      recorded: v.recorded,
      performers: this.selectedPerformers,
      location: v.location?.trim() || undefined,
      note: v.note?.trim() || undefined,
      createDiagnosticReport: String(v.diagnosticReportConclusion || '').trim().length > 0,
      diagnosticReportConclusion: v.diagnosticReportConclusion?.trim() || undefined
    };

    const op$ = this.procedureId
      ? this.procedureService.updateProcedure(this.procedureId, input)
      : this.procedureService.createProcedure(input);

    op$.subscribe({
      next: (saved) => {
        this.saving = false;
        this.savedSuccess = true;
        if (!this.procedureId) {
          this.procedureId = saved.id;
        }

        if (this.embedded) {
          this.utilityDockState.clearProcedureDraft();
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
      this.utilityDockState.clearProcedureDraft();
      return;
    }

    this.router.navigate(['/my-patients', this.patientId], { queryParams: { tab: 'procedures' } });
  }

  get saveButtonLabel(): string {
    return this.embedded ? 'myPatients.procedures.save' : 'myPatients.procedures.save';
  }

  private loadProcedure(id: string): void {
    this.loading = true;
    this.error = '';
    this.procedureService.getProcedure(id).subscribe({
      next: (proc) => {
        this.loading = false;
        this.patchForm(proc);
        this.loadDiagnosticReport(proc);
      },
      error: () => {
        this.loading = false;
        this.error = 'Impossible de charger cet acte.';
      }
    });
  }

  private patchForm(proc: ProcedureDetail): void {
    this.selectedPerformers = proc.performerReferences ?? [];
    if (proc.basedOnReference) {
      this.carePlanReference = proc.basedOnReference;
    }
    this.form.patchValue({
      status: proc.status,
      codeSystem: proc.codeSystem || 'http://snomed.info/sct',
      codeCode: proc.codeCode,
      codeDisplay: proc.codeDisplay,
      occurrenceStart: proc.occurrenceStart
        ? proc.occurrenceStart.slice(0, 16)
        : '',
      occurrenceEnd: proc.occurrenceEnd
        ? proc.occurrenceEnd.slice(0, 16)
        : '',
      recorded: proc.recorded ? proc.recorded.slice(0, 16) : '',
      location: proc.location ?? '',
      note: proc.note ?? '',
      createDiagnosticReport: proc.hasReport,
      diagnosticReportConclusion: ''
    });
  }

  private initializeForPatient(id: string, procedureId: string | null): void {
    this.patientId = id;
    this.procedureId = procedureId;

    if (id) {
      this.store.dispatch(PatientActions.loadPatient({ id }));
    }

    this.store
      .select(PatientSelectors.selectSelectedPatient)
      .pipe(takeUntil(this.destroy$))
      .subscribe((patient) => {
        if (patient) {
          const name = `${patient.firstName} ${patient.lastName}`.trim();
          this.breadcrumbs = [
            { label: 'menu.myPatients', route: '/my-patients' },
            { label: name, route: `/my-patients/${patient.id}` },
            { label: 'myPatients.procedures.title' }
          ];
        }
      });

    if (!this.procedureId) {
      const practitionerId = this.authService.getConnectedPractitionerId();
      const username = this.authService.getUsername();
      if (practitionerId) {
        this.selectedPerformers = [{
          id: practitionerId,
          reference: `Practitioner/${practitionerId}`,
          label: username || practitionerId
        }];
      }
      this.loading = false;
      return;
    }

    this.loadProcedure(this.procedureId);
  }

  private loadDiagnosticReport(proc: ProcedureDetail): void {
    if (!proc.reportReference) {
      this.form.patchValue({ diagnosticReportConclusion: '' });
      return;
    }

    this.procedureService.getDiagnosticReportConclusion(proc.reportReference).subscribe({
      next: (conclusion) => {
        this.form.patchValue({ diagnosticReportConclusion: conclusion || '' });
      },
      error: () => {
        this.form.patchValue({ diagnosticReportConclusion: '' });
      }
    });
  }
}
