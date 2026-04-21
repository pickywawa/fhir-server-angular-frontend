import { Component, OnDestroy, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router } from '@angular/router';
import { Store } from '@ngrx/store';
import { Observable, Subject, forkJoin, of } from 'rxjs';
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
import { RelatedPersonComponent } from '../features/related-person/components/related-person.component';
import { PatientCarePlanComponent } from '../features/careplan/components/patient-careplan.component';
import { FhirCarePlanService } from '../features/careplan/services/fhir-care-plan.service';
import { PatientVisioComponent } from '../features/visio/components/patient-visio.component';
import { TabBarComponent, TabItem } from '../../../core/components/tab-bar/tab-bar.component';
import { TranslateModule, TranslateService } from '@ngx-translate/core';

interface CarePlanSummaryStep {
  title: string;
  details: string;
  type: 'questionnaire' | 'task' | 'appointment' | 'communication' | 'other';
  reference: string;
  done: boolean;
  actionLabel: string;
  actionTab?: string;
  actionRoute?: string;
}

interface CarePlanSummaryStepper {
  carePlanTitle: string;
  steps: CarePlanSummaryStep[];
  currentIndex: number;
}

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
    PatientVisioComponent,
    PatientDocumentsComponent,
    PatientDiscussionsComponent,
    PatientQuestionnairesComponent,
    TabBarComponent,
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
    { key: 'discussions', label: 'myPatients.detail.tabs.discussions' },
    { key: 'patient-identity', label: 'myPatients.detail.tabs.identity' },
    { key: 'documents', label: 'myPatients.detail.tabs.documents' },
    { key: 'visio', label: 'myPatients.detail.tabs.visio' }
  ];

  activeTab = 'overview';
  mobileMoreOpen = false;

  breadcrumbs: ModuleBreadcrumb[] = [
    { label: 'menu.myPatients', route: '/my-patients' },
    { label: 'patients.detailPage.patient' }
  ];

  readonly patient$: Observable<Patient | null>;
  readonly loading$: Observable<boolean>;
  readonly error$: Observable<unknown>;
  readonly floatingVisio = inject(VisioFloatingService);
  readonly carePlanStepper$: Observable<CarePlanSummaryStepper | null>;

  private readonly destroy$ = new Subject<void>();

  constructor(
    private readonly route: ActivatedRoute,
    private readonly router: Router,
    private readonly store: Store,
    private readonly apiService: ApiService,
    private readonly carePlanService: FhirCarePlanService,
    private readonly translateService: TranslateService
  ) {
    this.patient$ = this.store.select(PatientSelectors.selectSelectedPatient);
    this.loading$ = this.store.select(PatientSelectors.selectPatientLoading);
    this.error$ = this.store.select(PatientSelectors.selectPatientError);
    this.carePlanStepper$ = this.patient$.pipe(
      switchMap((patient) => {
        const patientId = String(patient?.id || '').trim();
        if (!patientId) {
          return of(null);
        }
        return this.buildCarePlanStepper(patientId);
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
        if (tab && this.tabs.some((entry) => entry.key === tab)) {
          this.activeTab = tab;
        } else {
          this.activeTab = 'overview';
        }
      });
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
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

  navigateToStepAction(step: CarePlanSummaryStep): void {
    if (step.actionRoute) {
      this.router.navigate([step.actionRoute]);
      return;
    }

    if (step.actionTab) {
      this.onTabChange(step.actionTab);
    }
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
              carePlanTitle: selectedPlan.title || `CarePlan ${selectedPlan.id}`,
              steps: cleanedSteps,
              currentIndex: currentIndex >= 0 ? currentIndex : Math.max(0, cleanedSteps.length - 1)
            };
          })
        );
      })
    );
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
            actionTab: questionnaireBased ? 'questionnaires' : 'careplan'
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
            actionRoute: '/agenda'
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
            actionTab: 'discussions'
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
