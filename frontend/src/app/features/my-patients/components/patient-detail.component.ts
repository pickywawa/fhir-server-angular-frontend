import { Component, ElementRef, OnDestroy, OnInit, ViewChild, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router } from '@angular/router';
import { Store } from '@ngrx/store';
import { Observable, Subject, BehaviorSubject, combineLatest, forkJoin, of } from 'rxjs';
import { takeUntil, map, switchMap, catchError } from 'rxjs/operators';
import { VisioFloatingService } from '../../../core/services/visio-floating.service';
import { ApiService } from '../../../core/services/api.service';
import { Patient } from '../../../core/models/patient.model';
import * as PatientActions from '../state/patient.actions';
import * as PatientSelectors from '../state/patient.selectors';
import { ModuleShellComponent, ModuleBreadcrumb } from '../../../shared/components/module-shell/module-shell.component';
import { PatientIdentityCardComponent } from '../features/patient-identity/components/patient-identity-card.component';
import { CareTeamComponent } from '../features/care-team/components/care-team.component';
import { PatientDocumentsComponent } from '../features/documents/components/patient-documents.component';
import { PatientDiscussionsComponent } from '../features/discussions/components/patient-discussions.component';
import { PatientOverviewComponent } from '../features/overview/components/patient-overview.component';
import { PatientQuestionnairesComponent } from '../features/questionnaires/components/patient-questionnaires.component';
import { PatientObservationsComponent } from '../features/observations/components/patient-observations.component';
import { PatientProceduresComponent } from '../features/procedures/components/patient-procedures.component';
import { RelatedPersonComponent } from '../features/related-person/components/related-person.component';
import { PatientCarePlanComponent } from '../features/careplan/components/patient-careplan.component';
import { FhirCarePlanService } from '../features/careplan/services/fhir-care-plan.service';
import { TabBarComponent, TabItem } from '../../../core/components/tab-bar/tab-bar.component';
import { ModalComponent } from '../../../core/components/modal/modal.component';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { FhirPatientConsentService } from '../features/consents/services/fhir-patient-consent.service';
import { PatientConsentSummary } from '../features/consents/models/patient-consent.model';
import { ChatAssistantStateService } from '../../../core/services/chat-assistant-state.service';

interface CarePlanSummaryStep {
  title: string;
  details: string;
  type: 'questionnaire' | 'task' | 'appointment' | 'communication' | 'other';
  reference: string;
  done: boolean;
  actionLabel: string;
  actionTab?: string;
  actionRoute?: string;
  rawResource?: any;
  questionnaireRef?: string;
}

interface CarePlanSummaryStepper {
  carePlanId: string;
  carePlanTitle: string;
  steps: CarePlanSummaryStep[];
  currentIndex: number;
}

interface CarePlanRiskSummary {
  carePlanId: string;
  riskLevel: 'low' | 'moderate' | 'high' | 'critical';
  riskScore: number;
  confidence: number;
}

type WorkflowConfirmAction = 'advance' | 'regress';

@Component({
  selector: 'app-patient-detail',
  standalone: true,
  imports: [
    CommonModule,
    ModuleShellComponent,
    PatientOverviewComponent,
    PatientIdentityCardComponent,
    CareTeamComponent,
    PatientCarePlanComponent,
    PatientDocumentsComponent,
    PatientDiscussionsComponent,
    PatientQuestionnairesComponent,
    PatientObservationsComponent,
    PatientProceduresComponent,
    TabBarComponent,
    ModalComponent,
    TranslateModule
  ],
  templateUrl: './patient-detail.component.html',
  styleUrl: './patient-detail.component.scss'
})
export class PatientDetailComponent implements OnInit, OnDestroy {
  readonly relatedPersonComponent = RelatedPersonComponent;

  readonly tabs: TabItem[] = [
    { key: 'overview', label: 'myPatients.detail.tabs.overview' },
    { key: 'care-team', label: 'myPatients.detail.tabs.careTeam' },
    { key: 'careplan', label: 'myPatients.detail.tabs.careplan' },
    { key: 'related-person', label: 'myPatients.detail.tabs.relatedPerson' },
    { key: 'questionnaires', label: 'myPatients.detail.tabs.questionnaires' },
    { key: 'observations', label: 'myPatients.detail.tabs.observations' },
    { key: 'procedures', label: 'myPatients.detail.tabs.procedures' },
    { key: 'discussions', label: 'myPatients.detail.tabs.discussions' },
    { key: 'documents', label: 'myPatients.detail.tabs.documents' }
  ];

  activeTab = 'overview';
  mobileMoreOpen = false;
  summaryActionsExpanded = true;
  advancingWorkflow = false;
  regressingWorkflow = false;
  workflowConfirmOpen = false;
  workflowConfirmTitle = '';
  workflowConfirmMessage = '';
  actionsCompact = false;

  private pendingWorkflowAction: WorkflowConfirmAction | null = null;
  private pendingWorkflowStepper: CarePlanSummaryStepper | null = null;

  toggleSummaryActions(): void {
    this.summaryActionsExpanded = !this.summaryActionsExpanded;
  }

  breadcrumbs: ModuleBreadcrumb[] = [
    { label: 'menu.myPatients', route: '/my-patients' },
    { label: 'patients.detailPage.patient' }
  ];

  readonly patient$: Observable<Patient | null>;
  readonly loading$: Observable<boolean>;
  readonly error$: Observable<unknown>;
  readonly floatingVisio = inject(VisioFloatingService);
  readonly carePlanStepper$: Observable<CarePlanSummaryStepper | null>;
  readonly carePlanRiskSummary$: Observable<CarePlanRiskSummary | null>;
  patientConsent$: Observable<PatientConsentSummary | null> = of(null);
  @ViewChild('actionsContainer')
  set actionsContainerRef(value: ElementRef<HTMLDivElement> | undefined) {
    this.actionsContainer = value;
    this.setupActionsObserver();
  }

  private readonly destroy$ = new Subject<void>();
  private readonly carePlanVersion$ = new BehaviorSubject<number>(0);
  private actionsContainer?: ElementRef<HTMLDivElement>;
  private actionsResizeObserver?: ResizeObserver;
  private observedActionsEl?: HTMLDivElement;
  private observedSummaryBarEl?: HTMLElement;
  private updateCompactRafId: number | null = null;

  constructor(
    private readonly route: ActivatedRoute,
    private readonly router: Router,
    private readonly store: Store,
    private readonly apiService: ApiService,
    private readonly carePlanService: FhirCarePlanService,
    private readonly translateService: TranslateService,
    private readonly consentService: FhirPatientConsentService,
    private readonly utilityDockState: ChatAssistantStateService
  ) {
    this.patient$ = this.store.select(PatientSelectors.selectSelectedPatient);
    this.loading$ = this.store.select(PatientSelectors.selectPatientLoading);
    this.error$ = this.store.select(PatientSelectors.selectPatientError);
    this.carePlanStepper$ = combineLatest([this.patient$, this.carePlanVersion$]).pipe(
      switchMap(([patient]) => {
        const patientId = String(patient?.id || '').trim();
        if (!patientId) {
          return of(null);
        }
        return this.buildCarePlanStepper(patientId);
      }),
      catchError(() => of(null))
    );

    this.carePlanRiskSummary$ = combineLatest([this.patient$, this.carePlanVersion$]).pipe(
      switchMap(([patient]) => {
        const patientId = String(patient?.id || '').trim();
        if (!patientId) {
          return of(null);
        }
        return this.loadRiskSummaryForSelectedCarePlan(patientId);
      }),
      catchError(() => of(null))
    );

    this.patientConsent$ = this.patient$.pipe(
      switchMap((patient) => {
        const patientId = String(patient?.id || '').trim();
        if (!patientId) return of(null);
        return this.consentService.getFirstConsentForPatient(patientId);
      }),
      catchError(() => of(null))
    );
  }

  ngOnInit(): void {
    this.route.paramMap
      .pipe(takeUntil(this.destroy$))
      .subscribe((params) => {
        const id = params.get('id');
        if (id) {
          this.store.dispatch(PatientActions.loadPatient({ id }));
        }
      });

    this.route.queryParamMap
      .pipe(takeUntil(this.destroy$))
      .subscribe((queryParams) => {
        const tab = queryParams.get('tab');
        if (tab && (this.tabs.some((entry) => entry.key === tab) || tab === 'patient-identity')) {
          this.activeTab = tab;
        } else {
          this.activeTab = 'overview';
        }
      });
  }

  ngOnDestroy(): void {
    this.actionsResizeObserver?.disconnect();
    if (this.updateCompactRafId !== null) {
      cancelAnimationFrame(this.updateCompactRafId);
      this.updateCompactRafId = null;
    }
    this.destroy$.next();
    this.destroy$.complete();
  }

  private setupActionsObserver(): void {
    const actionsEl = this.actionsContainer?.nativeElement;
    if (!actionsEl) {
      this.actionsResizeObserver?.disconnect();
      this.observedActionsEl = undefined;
      this.observedSummaryBarEl = undefined;
      this.actionsCompact = false;
      return;
    }

    const summaryBarEl = actionsEl.closest('.summary-bar') as HTMLElement | null;

    const sameTargets = this.observedActionsEl === actionsEl && this.observedSummaryBarEl === summaryBarEl;
    if (sameTargets) {
      this.scheduleUpdateActionsCompact();
      return;
    }

    if (!this.actionsResizeObserver) {
      this.actionsResizeObserver = new ResizeObserver(() => {
        this.scheduleUpdateActionsCompact();
      });
    }

    this.actionsResizeObserver.disconnect();
    if (summaryBarEl) {
      this.actionsResizeObserver.observe(summaryBarEl);
    } else {
      this.actionsResizeObserver.observe(actionsEl);
    }

    this.observedActionsEl = actionsEl;
    this.observedSummaryBarEl = summaryBarEl ?? undefined;
    this.scheduleUpdateActionsCompact();
  }

  private scheduleUpdateActionsCompact(): void {
    if (this.updateCompactRafId !== null) {
      cancelAnimationFrame(this.updateCompactRafId);
    }

    this.updateCompactRafId = requestAnimationFrame(() => {
      this.updateCompactRafId = null;
      this.updateActionsCompact();
    });
  }

  private updateActionsCompact(): void {
    const el = this.actionsContainer?.nativeElement;
    if (!el) {
      this.actionsCompact = false;
      return;
    }

    const summaryBarWidth = this.observedSummaryBarEl?.clientWidth ?? el.closest('.summary-bar')?.clientWidth ?? el.clientWidth;
    const requiresCompact = summaryBarWidth < 1000;
    if (this.actionsCompact !== requiresCompact) {
      this.actionsCompact = requiresCompact;
    }
  }

  onTabChange(key: string): void {
    this.activeTab = key;
    this.mobileMoreOpen = false;
    this.router.navigate([], {
      relativeTo: this.route,
      queryParams: { tab: key },
      queryParamsHandling: 'merge'
    });
  }

  get mobilePrimaryTabs(): TabItem[] {
    const preferredOrder = ['overview', 'care-team', 'careplan', 'discussions'];
    return preferredOrder
      .map((key) => this.tabs.find((tab) => tab.key === key))
      .filter((tab): tab is TabItem => !!tab);
  }

  get mobileOverflowTabs(): TabItem[] {
    const primaryKeys = new Set(this.mobilePrimaryTabs.map((tab) => tab.key));
    return this.tabs.filter((tab) => !primaryKeys.has(tab.key));
  }

  toggleMobileMoreMenu(): void {
    this.mobileMoreOpen = !this.mobileMoreOpen;
  }

  isOverflowTabActive(): boolean {
    return this.mobileOverflowTabs.some((tab) => tab.key === this.activeTab);
  }

  saveIdentity(updates: Partial<Patient>): void {
    this.patient$.pipe(takeUntil(this.destroy$)).subscribe((patient) => {
      if (!patient || !patient.id) {
        return;
      }
      const updated: Patient = { ...patient, ...updates } as Patient;
      this.store.dispatch(PatientActions.updatePatient({ id: patient.id, patient: updated }));
    });
  }

  formatError(error: unknown): string {
    if (typeof error === 'string') {
      return error;
    }
    if (error && typeof error === 'object' && 'message' in error) {
      return (error as { message: string }).message;
    }
    return this.translateService.instant('common.unknownError');
  }

  getVisioRoomName(patientId?: string): string {
    const sanitized = String(patientId || 'unknown').replace(/[^a-zA-Z0-9]/g, '');
    return `patient-${sanitized}`;
  }

  joinVisioCall(patientId?: string): void {
    if (!patientId) {
      return;
    }
    const roomName = this.getVisioRoomName(patientId);
    this.floatingVisio.open(roomName);
  }

  get hasFloatingSession(): Observable<boolean> {
    return this.patient$.pipe(
      map((patient) => {
        if (!patient) return false;
        const roomName = this.getVisioRoomName(patient.id);
        return this.floatingVisio.isOpen() && this.floatingVisio.roomName() === roomName;
      }),
      takeUntil(this.destroy$)
    );
  }

  navigateToConsents(patientId: string | undefined): void {
    if (!patientId) return;
    this.router.navigate(['/my-patients', patientId, 'consents']);
  }

  navigateToIdentity(): void {
    this.activeTab = 'patient-identity';
    this.router.navigate([], {
      relativeTo: this.route,
      queryParams: { tab: 'patient-identity' },
      queryParamsHandling: 'merge'
    });
  }

  openProcedureInRightView(patientId: string | undefined): void {
    const id = String(patientId || '').trim();
    if (!id) {
      return;
    }

    this.utilityDockState.startProcedureDraft(id);
  }

  openPatientAnalysisInRightView(patientId: string | undefined): void {
    const id = String(patientId || '').trim();
    if (!id) {
      return;
    }

    this.utilityDockState.startPatientAnalysis(id);
  }

  openPatientRiskAssessmentInRightView(patientId: string | undefined, carePlanId: string | undefined): void {
    const id = String(patientId || '').trim();
    const cpId = String(carePlanId || '').trim();
    if (!id || !cpId) {
      return;
    }

    this.utilityDockState.startPatientRiskAssessment(id, cpId);
  }

  riskBadgeClass(level: string): string {
    const normalized = String(level || '').toLowerCase();
    if (normalized === 'low') {
      return 'risk-low';
    }
    if (normalized === 'high') {
      return 'risk-high';
    }
    if (normalized === 'critical') {
      return 'risk-critical';
    }
    return 'risk-moderate';
  }

  translatedGender(gender: string | undefined): string {
    const normalized = String(gender || '').trim().toLowerCase();
    if (normalized === 'male' || normalized === 'female' || normalized === 'other' || normalized === 'unknown') {
      return this.translateService.instant(`patients.form.gender.${normalized}`);
    }
    return this.translateService.instant('patients.detailPage.unknownGender');
  }

  patientAgeLabel(dateOfBirth: string | undefined): string {
    const birthDate = String(dateOfBirth || '').trim();
    if (!birthDate) {
      return '';
    }

    const parsedBirthDate = new Date(birthDate);
    if (Number.isNaN(parsedBirthDate.getTime())) {
      return '';
    }

    const today = new Date();
    let age = today.getFullYear() - parsedBirthDate.getFullYear();
    const monthDelta = today.getMonth() - parsedBirthDate.getMonth();
    const dayDelta = today.getDate() - parsedBirthDate.getDate();

    if (monthDelta < 0 || (monthDelta === 0 && dayDelta < 0)) {
      age -= 1;
    }

    return age >= 0 ? `${age} ans` : '';
  }

  openQuestionnaireStep(patientId: string | undefined, step: CarePlanSummaryStep): void {
    if (!patientId) return;
    const path = ['/my-patients', patientId, 'questionnaires', 'new'];
    const queryParams = step.questionnaireRef ? { questionnaire: step.questionnaireRef } : {};
    this.router.navigate(path, { queryParams });
  }

  openAppointmentStep(): void {
    this.router.navigate(['/agenda']);
  }

  openCommunicationStep(patientId: string | undefined): void {
    this.onTabChange('discussions');
  }

  requestRegressWorkflow(stepper: CarePlanSummaryStepper): void {
    const currentIndex = stepper.currentIndex;
    const prevStep = stepper.steps[currentIndex - 1];
    if (!prevStep || currentIndex === 0 || this.regressingWorkflow || this.advancingWorkflow) {
      return;
    }

    this.pendingWorkflowAction = 'regress';
    this.pendingWorkflowStepper = stepper;
    this.workflowConfirmTitle = 'Revenir a l etape precedente';
    this.workflowConfirmMessage = `Revenir a "${prevStep.title}" ?`;
    this.workflowConfirmOpen = true;
  }

  requestAdvanceWorkflow(stepper: CarePlanSummaryStepper): void {
    const currentIndex = stepper.currentIndex;
    const currentStep = stepper.steps[currentIndex];
    const nextStep = stepper.steps[currentIndex + 1];
    if (!currentStep || currentStep.done || !nextStep || this.regressingWorkflow || this.advancingWorkflow) {
      return;
    }

    this.pendingWorkflowAction = 'advance';
    this.pendingWorkflowStepper = stepper;
    this.workflowConfirmTitle = 'Passer a l etape suivante';
    this.workflowConfirmMessage = `Terminer "${currentStep.title}" et passer a "${nextStep.title}" ?`;
    this.workflowConfirmOpen = true;
  }

  closeWorkflowConfirm(): void {
    this.workflowConfirmOpen = false;
    this.pendingWorkflowAction = null;
    this.pendingWorkflowStepper = null;
    this.workflowConfirmTitle = '';
    this.workflowConfirmMessage = '';
  }

  confirmWorkflowChange(): void {
    const stepper = this.pendingWorkflowStepper;
    const action = this.pendingWorkflowAction;

    this.closeWorkflowConfirm();

    if (!stepper || !action) {
      return;
    }

    if (action === 'regress') {
      this.executeRegressWorkflow(stepper);
      return;
    }

    this.executeAdvanceWorkflow(stepper);
  }

  private executeRegressWorkflow(stepper: CarePlanSummaryStepper): void {
    const currentIndex = stepper.currentIndex;
    const currentStep = stepper.steps[currentIndex];
    const prevStep = stepper.steps[currentIndex - 1];
    if (!currentStep || currentIndex === 0 || !prevStep) return;

    this.regressingWorkflow = true;
    const [currentType, currentId] = currentStep.reference.split('/');
    const [prevType, prevId] = prevStep.reference.split('/');

    const readyStatus = (type: string) =>
      type === 'Task' ? 'ready' : type === 'Appointment' ? 'proposed' : 'active';
    const inProgressStatus = (type: string) =>
      type === 'Task' ? 'in-progress' : type === 'Appointment' ? 'booked' : 'active';

    const revertCurrent$ = currentStep.rawResource
      ? this.carePlanService.patchResourceStatus(currentType, currentId, currentStep.rawResource, readyStatus(currentType))
      : of(null);
    const revertPrev$ = prevStep.rawResource
      ? this.carePlanService.patchResourceStatus(prevType, prevId, prevStep.rawResource, inProgressStatus(prevType))
      : of(null);

    forkJoin([revertCurrent$, revertPrev$]).subscribe({
      next: () => {
        this.regressingWorkflow = false;
        this.carePlanVersion$.next(this.carePlanVersion$.value + 1);
      },
      error: () => { this.regressingWorkflow = false; }
    });
  }

  private executeAdvanceWorkflow(stepper: CarePlanSummaryStepper): void {
    const currentIndex = stepper.currentIndex;
    const currentStep = stepper.steps[currentIndex];
    const nextStep = stepper.steps[currentIndex + 1];
    if (!currentStep || currentStep.done || !nextStep) return;

    this.advancingWorkflow = true;
    const [currentType, currentId] = currentStep.reference.split('/');
    const doneStatus = currentType === 'Appointment' ? 'fulfilled' : 'completed';

    const complete$ = currentStep.rawResource
      ? this.carePlanService.patchResourceStatus(currentType, currentId, currentStep.rawResource, doneStatus)
      : of(null);

    const activate$ = nextStep.rawResource
      ? (() => {
          const [nextType, nextId] = nextStep.reference.split('/');
          const inProgressStatus = nextType === 'Task' ? 'in-progress' : (nextType === 'Appointment' ? 'booked' : 'active');
          return this.carePlanService.patchResourceStatus(nextType, nextId, nextStep.rawResource!, inProgressStatus);
        })()
      : of(null);

    forkJoin([complete$, activate$]).subscribe({
      next: () => {
        this.advancingWorkflow = false;
        this.carePlanVersion$.next(this.carePlanVersion$.value + 1);
      },
      error: () => {
        this.advancingWorkflow = false;
      }
    });
  }

  private buildCarePlanStepper(patientId: string): Observable<CarePlanSummaryStepper | null> {
    return this.carePlanService.getCarePlansForPatient(patientId).pipe(
      switchMap(({ carePlans }) => {
        if (!carePlans.length) {
          return of(null);
        }

        const prioritizedPlans = [...carePlans].sort((left, right) => {
          const leftActive = left.status === 'active' ? 1 : 0;
          const rightActive = right.status === 'active' ? 1 : 0;
          if (leftActive !== rightActive) {
            return rightActive - leftActive;
          }
          const leftDate = Date.parse(String(left.lastUpdated || '')) || 0;
          const rightDate = Date.parse(String(right.lastUpdated || '')) || 0;
          return rightDate - leftDate;
        });

        const selectedPlan = prioritizedPlans[0];
        const activityRefs = Array.isArray(selectedPlan.activityReferences) ? selectedPlan.activityReferences : [];
        if (!activityRefs.length) {
          return of({
            carePlanId: String(selectedPlan.id || '').trim(),
            carePlanTitle: selectedPlan.title || `CarePlan ${selectedPlan.id}`,
            steps: [],
            currentIndex: 0
          });
        }

        const detailRequests = activityRefs.map((reference) => this.resolveStepFromReference(reference));
        return forkJoin(detailRequests).pipe(
          map((steps) => {
            const cleanedSteps = steps.filter((step): step is CarePlanSummaryStep => !!step);
            const currentIndex = Math.max(0, cleanedSteps.findIndex((step) => !step.done));
            return {
              carePlanId: String(selectedPlan.id || '').trim(),
              carePlanTitle: selectedPlan.title || `CarePlan ${selectedPlan.id}`,
              steps: cleanedSteps,
              currentIndex: currentIndex >= 0 ? currentIndex : Math.max(0, cleanedSteps.length - 1)
            };
          })
        );
      })
    );
  }

  private loadRiskSummaryForSelectedCarePlan(patientId: string): Observable<CarePlanRiskSummary | null> {
    return this.carePlanService.getCarePlansForPatient(patientId).pipe(
      switchMap(({ carePlans }) => {
        if (!carePlans.length) {
          return of(null);
        }

        const selectedPlan = [...carePlans].sort((left, right) => {
          const leftActive = left.status === 'active' ? 1 : 0;
          const rightActive = right.status === 'active' ? 1 : 0;
          if (leftActive !== rightActive) {
            return rightActive - leftActive;
          }
          const leftDate = Date.parse(String(left.lastUpdated || '')) || 0;
          const rightDate = Date.parse(String(right.lastUpdated || '')) || 0;
          return rightDate - leftDate;
        })[0];

        const carePlanId = String(selectedPlan?.id || '').trim();
        if (!carePlanId) {
          return of(null);
        }

        return this.apiService.get<any>(`/CarePlan/${carePlanId}`).pipe(
          switchMap((carePlan) => {
            const supportingInfo = Array.isArray(carePlan?.supportingInfo) ? carePlan.supportingInfo : [];
            const riskReference = supportingInfo
              .map((item: any) => String(item?.reference || '').trim())
              .find((ref: string) => ref.startsWith('RiskAssessment/'));

            const riskId = this.extractIdFromReference(riskReference, 'RiskAssessment');
            if (!riskId) {
              return of(null);
            }

            return this.apiService.get<any>(`/RiskAssessment/${riskId}`).pipe(
              map((riskAssessment) => {
                const prediction = riskAssessment?.prediction?.[0] || {};
                const levelRaw = String(
                  prediction?.qualitativeRisk?.text
                  || prediction?.qualitativeRisk?.coding?.[0]?.code
                  || 'moderate'
                ).toLowerCase();
                const riskLevel = (levelRaw === 'low' || levelRaw === 'high' || levelRaw === 'critical')
                  ? levelRaw
                  : 'moderate';

                const riskScore = Math.round((Number(prediction?.probabilityDecimal || 0) || 0) * 100);
                const confidence = this.extractConfidenceFromRiskAssessment(riskAssessment?.extension);

                return {
                  carePlanId,
                  riskLevel: riskLevel as 'low' | 'moderate' | 'high' | 'critical',
                  riskScore,
                  confidence
                };
              }),
              catchError(() => of(null))
            );
          }),
          catchError(() => of(null))
        );
      }),
      catchError(() => of(null))
    );
  }

  private extractIdFromReference(reference: string | undefined, resourceType: string): string {
    const value = String(reference || '').trim();
    if (!value) {
      return '';
    }

    const marker = `${resourceType}/`;
    const index = value.lastIndexOf(marker);
    if (index < 0) {
      return '';
    }

    return value.slice(index + marker.length).trim();
  }

  private extractConfidenceFromRiskAssessment(extensions: any[]): number {
    const items = Array.isArray(extensions) ? extensions : [];
    const found = items.find(
      (item: any) => String(item?.url || '').trim() === 'https://healthapp.local/fhir/StructureDefinition/riskassessment-confidence'
    );
    const value = Number(found?.valueDecimal);
    return Number.isFinite(value) ? value : 0;
  }

  private resolveStepFromReference(reference: string): Observable<CarePlanSummaryStep | null> {
    const normalized = String(reference || '').trim();
    if (!normalized.includes('/')) {
      return of(null);
    }

    const [resourceType, id] = normalized.split('/', 2);
    if (!resourceType || !id) {
      return of(null);
    }

    if (resourceType === 'Task') {
      return this.apiService.get<any>(`/Task/${id}`).pipe(
        map((task) => {
          const status = String(task?.status || '').trim();
          const doneStatuses = new Set(['completed', 'cancelled', 'failed', 'rejected', 'entered-in-error']);
          const basedOnRef = String(task?.basedOn?.[0]?.reference || '').trim();
          const questionnaireBased = basedOnRef.startsWith('Questionnaire/');

          return {
            title: String(task?.description || task?.code?.text || `Task ${id}`).trim(),
            details: status ? `Statut: ${status}` : 'Task à exécuter',
            type: questionnaireBased ? 'questionnaire' : 'task',
            reference: normalized,
            done: doneStatuses.has(status),
            actionLabel: questionnaireBased ? 'Remplir questionnaire' : 'Voir tâche',
            actionTab: questionnaireBased ? 'questionnaires' : 'careplan',
            rawResource: task,
            questionnaireRef: questionnaireBased ? basedOnRef.replace('Questionnaire/', '') : undefined
          } as CarePlanSummaryStep;
        }),
        catchError(() => of({
          title: `Task ${id}`,
          details: 'Task à exécuter',
          type: 'task',
          reference: normalized,
          done: false,
          actionLabel: 'Voir tâche',
          actionTab: 'careplan'
        } as CarePlanSummaryStep))
      );
    }

    if (resourceType === 'Appointment') {
      return this.apiService.get<any>(`/Appointment/${id}`).pipe(
        map((appointment) => {
          const status = String(appointment?.status || '').trim();
          const doneStatuses = new Set(['fulfilled', 'cancelled', 'noshow', 'entered-in-error']);
          return {
            title: String(appointment?.description || `Rendez-vous ${id}`).trim(),
            details: status ? `Statut: ${status}` : 'Rendez-vous à planifier',
            type: 'appointment',
            reference: normalized,
            done: doneStatuses.has(status),
            actionLabel: 'Créer / voir RDV',
            actionRoute: '/agenda',
            rawResource: appointment
          } as CarePlanSummaryStep;
        }),
        catchError(() => of({
          title: `Rendez-vous ${id}`,
          details: 'Rendez-vous à planifier',
          type: 'appointment',
          reference: normalized,
          done: false,
          actionLabel: 'Créer / voir RDV',
          actionRoute: '/agenda'
        } as CarePlanSummaryStep))
      );
    }

    if (resourceType === 'CommunicationRequest') {
      return this.apiService.get<any>(`/CommunicationRequest/${id}`).pipe(
        map((request) => {
          const status = String(request?.status || '').trim();
          const doneStatuses = new Set(['completed', 'revoked', 'entered-in-error']);
          const message = String(request?.payload?.[0]?.contentString || '').trim();
          return {
            title: message ? 'Communication' : `Communication ${id}`,
            details: message || (status ? `Statut: ${status}` : 'Communication à envoyer'),
            type: 'communication',
            reference: normalized,
            done: doneStatuses.has(status),
            actionLabel: 'Ouvrir discussions',
            actionTab: 'discussions',
            rawResource: request
          } as CarePlanSummaryStep;
        }),
        catchError(() => of({
          title: `Communication ${id}`,
          details: 'Communication à envoyer',
          type: 'communication',
          reference: normalized,
          done: false,
          actionLabel: 'Ouvrir discussions',
          actionTab: 'discussions'
        } as CarePlanSummaryStep))
      );
    }

    if (resourceType === 'ActivityDefinition') {
      return this.apiService.get<any>(`/ActivityDefinition/${id}`).pipe(
        map((definition) => ({
          title: String(definition?.title || definition?.name || `Etape RDV ${id}`).trim(),
          details: 'Rendez-vous à créer depuis ce modèle',
          type: 'appointment',
          reference: normalized,
          done: false,
          actionLabel: 'Créer / voir RDV',
          actionRoute: '/agenda'
        } as CarePlanSummaryStep)),
        catchError(() => of({
          title: `Etape RDV ${id}`,
          details: 'Rendez-vous à créer',
          type: 'appointment',
          reference: normalized,
          done: false,
          actionLabel: 'Créer / voir RDV',
          actionRoute: '/agenda'
        } as CarePlanSummaryStep))
      );
    }

    return of({
      title: normalized,
      details: 'Etape planifiée',
      type: 'other',
      reference: normalized,
      done: false,
      actionLabel: 'Voir CarePlan',
      actionTab: 'careplan'
    });
  }
}
