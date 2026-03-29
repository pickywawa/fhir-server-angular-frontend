import { Component, OnDestroy, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router } from '@angular/router';
import { Store } from '@ngrx/store';
import { Observable, Subject } from 'rxjs';
import { takeUntil, map } from 'rxjs/operators';
import { VisioFloatingService } from '../../../core/services/visio-floating.service';
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
import { PatientVisioComponent } from '../features/visio/components/patient-visio.component';
import { TabBarComponent, TabItem } from '../../../core/components/tab-bar/tab-bar.component';
import { TranslateModule, TranslateService } from '@ngx-translate/core';

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

  private readonly destroy$ = new Subject<void>();

  constructor(
    private readonly route: ActivatedRoute,
    private readonly router: Router,
    private readonly store: Store,
    private readonly translateService: TranslateService
  ) {
    this.patient$ = this.store.select(PatientSelectors.selectSelectedPatient);
    this.loading$ = this.store.select(PatientSelectors.selectPatientLoading);
    this.error$ = this.store.select(PatientSelectors.selectPatientError);
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
}
