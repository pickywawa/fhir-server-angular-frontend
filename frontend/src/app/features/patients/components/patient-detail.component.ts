import { Component, OnDestroy, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router } from '@angular/router';
import { Store } from '@ngrx/store';
import { Observable, Subject } from 'rxjs';
import { filter, takeUntil } from 'rxjs/operators';
import { Patient } from '../../../core/models/patient.model';
import * as PatientActions from '../../my-patients/state/patient.actions';
import * as PatientSelectors from '../../my-patients/state/patient.selectors';
import { ModuleShellComponent, ModuleBreadcrumb } from '../../../shared/components/module-shell/module-shell.component';
import { BubbleCardComponent } from '../../../shared/components/bubble-card/bubble-card.component';
import { PatientIdentityCardComponent } from '../../my-patients/features/patient-identity/components/patient-identity-card.component';
import { CareTeamComponent } from '../../my-patients/features/care-team/components/care-team.component';
import { PatientDocumentsComponent } from '../../my-patients/features/documents/components/patient-documents.component';
import { PatientDiscussionsComponent } from '../../my-patients/features/discussions/components/patient-discussions.component';
import { PatientOverviewComponent } from '../../my-patients/features/overview/components/patient-overview.component';
import { PatientQuestionnairesComponent } from '../../my-patients/features/questionnaires/components/patient-questionnaires.component';
import { RelatedPersonComponent } from '../../my-patients/features/related-person/components/related-person.component';
import { PatientCarePlanComponent } from '../../my-patients/features/careplan/components/patient-careplan.component';
import { TabBarComponent, TabItem } from '../../../core/components/tab-bar/tab-bar.component';
import { TranslateModule, TranslateService } from '@ngx-translate/core';

@Component({
  selector: 'app-patient-detail',
  standalone: true,
  imports: [
    CommonModule,
    ModuleShellComponent,
    BubbleCardComponent,
    PatientOverviewComponent,
    PatientIdentityCardComponent,
    CareTeamComponent,
    PatientCarePlanComponent,
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
    { key: 'documents', label: 'myPatients.detail.tabs.documents' }
  ];

  activeTab = 'overview';

  breadcrumbs: ModuleBreadcrumb[] = [
    { label: 'menu.myPatients', route: '/my-patients' },
    { label: 'patients.detailPage.patient' }
  ];

  readonly patient$: Observable<Patient | null>;
  readonly loading$: Observable<boolean>;
  readonly error$: Observable<unknown>;

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

    this.patient$
      .pipe(
        filter((patient): patient is Patient => !!patient),
        takeUntil(this.destroy$)
      )
      .subscribe((patient) => {
        this.breadcrumbs = [
          { label: 'menu.myPatients', route: '/my-patients' },
          { label: `${patient.firstName} ${patient.lastName}`.trim() || 'patients.detailPage.patient' }
        ];
      });
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  saveIdentity(updatedPatient: Patient): void {
    if (!updatedPatient.id) {
      return;
    }

    this.store.dispatch(PatientActions.updatePatient({
      id: updatedPatient.id,
      patient: updatedPatient
    }));
  }

  onTabChange(tabKey: string): void {
    this.activeTab = tabKey;
    this.router.navigate([], {
      relativeTo: this.route,
      queryParams: { tab: tabKey === 'overview' ? null : tabKey },
      queryParamsHandling: 'merge'
    });
  }

  formatError(error: unknown): string {
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
