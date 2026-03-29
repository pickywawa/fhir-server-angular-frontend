import { Routes } from '@angular/router';
import { PatientListComponent } from './features/my-patients/components/patient-list.component';
import { PatientDetailComponent } from './features/my-patients/components/patient-detail.component';
import { PatientAdminListComponent } from './features/patients/components/patient-admin-list.component';
import { PatientDetailPageComponent } from './features/patients/components/patient-detail-page.component';
import { PractitionerListComponent } from './features/practitioners/components/practitioner-list.component';
import { PractitionerDetailPageComponent } from './features/practitioners/components/practitioner-detail-page.component';
import { QuestionnaireListComponent } from './features/questionnaires/components/questionnaire-list.component';
import { QuestionnaireDetailPageComponent } from './features/questionnaires/components/questionnaire-detail-page.component';
import { CodeSystemListComponent } from './features/code-systems/components/code-system-list.component';
import { CodeSystemDetailPageComponent } from './features/code-systems/components/code-system-detail-page.component';
import { OrganizationListComponent } from './features/organizations/components/organization-list.component';
import { OrganizationDetailPageComponent } from './features/organizations/components/organization-detail-page.component';
import { AgendaPageComponent } from './features/agenda/components/agenda-page.component';
import { SearchPageComponent } from './features/search/components/search-page.component';
import { SupportPageComponent } from './features/support/components/support-page.component';
import { SettingsPageComponent } from './features/settings/components/settings-page.component';
import { PatientQuestionnairePageComponent } from './features/my-patients/features/questionnaires/components/patient-questionnaire-page.component';
import { ProfilePageComponent } from './features/profile/components/profile-page.component';
import { authGuard } from './core/guards/auth.guard';
import { ModulePlaceholderComponent } from './shared/components/module-placeholder/module-placeholder.component';
import { VisioExternalWindowComponent } from './features/my-patients/features/visio/components/visio-external-window.component';

export const routes: Routes = [
  { path: '', redirectTo: '/my-patients', pathMatch: 'full' },
  { path: 'visio/window/:roomName', component: VisioExternalWindowComponent },
  { path: 'my-patients', component: PatientListComponent, canActivate: [authGuard] },
  { path: 'my-patients/:id/questionnaires/new', component: PatientQuestionnairePageComponent, canActivate: [authGuard] },
  { path: 'my-patients/:id/questionnaires/response/:responseId', component: PatientQuestionnairePageComponent, canActivate: [authGuard] },
  { path: 'my-patients/:id', component: PatientDetailComponent, canActivate: [authGuard] },
  { path: 'patients', component: PatientAdminListComponent, canActivate: [authGuard] },
  { path: 'patients/:id', component: PatientDetailPageComponent, canActivate: [authGuard] },
  { path: 'practitioners', component: PractitionerListComponent, canActivate: [authGuard] },
  { path: 'practitioners/:id', component: PractitionerDetailPageComponent, canActivate: [authGuard] },
  { path: 'questionnaires', component: QuestionnaireListComponent, canActivate: [authGuard] },
  { path: 'questionnaires/:id', component: QuestionnaireDetailPageComponent, canActivate: [authGuard] },
  { path: 'code-systems', component: CodeSystemListComponent, canActivate: [authGuard] },
  { path: 'code-systems/:id', component: CodeSystemDetailPageComponent, canActivate: [authGuard] },
  { path: 'organizations', component: OrganizationListComponent, canActivate: [authGuard] },
  { path: 'organizations/:id', component: OrganizationDetailPageComponent, canActivate: [authGuard] },
  { path: 'patient', redirectTo: '/my-patients', pathMatch: 'full' },
  { path: 'patient/:id', redirectTo: '/my-patients/:id', pathMatch: 'full' },
  { path: 'agenda', component: AgendaPageComponent, canActivate: [authGuard] },
  { path: 'discussions', component: ModulePlaceholderComponent, canActivate: [authGuard], data: { title: 'Discussions' } },
  { path: 'rechercher', component: SearchPageComponent, canActivate: [authGuard] },
  { path: 'support', component: SupportPageComponent, canActivate: [authGuard] },
  { path: 'parametres', component: SettingsPageComponent, canActivate: [authGuard] },
  { path: 'profile', component: ProfilePageComponent, canActivate: [authGuard] },
  { path: '**', redirectTo: '/my-patients' }
];
