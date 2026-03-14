import { Routes } from '@angular/router';
import { PatientListComponent } from './features/patient/components/patient-list.component';

export const routes: Routes = [
  { path: '', redirectTo: '/patients', pathMatch: 'full' },
  { path: 'patients', component: PatientListComponent }
];
