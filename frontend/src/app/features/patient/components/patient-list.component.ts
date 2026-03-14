import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Store } from '@ngrx/store';
import { Observable } from 'rxjs';
import { Patient } from '../../../core/models/patient.model';
import { ToastService } from '../../../core/services/toast.service';
import { PatientFormComponent } from './patient-form.component';
import * as PatientActions from '../state/patient.actions';
import * as PatientSelectors from '../state/patient.selectors';

@Component({
  selector: 'app-patient-list',
  standalone: true,
  imports: [CommonModule, PatientFormComponent],
  templateUrl: './patient-list.component.html',
  styleUrls: ['./patient-list.component.scss']
})
export class PatientListComponent implements OnInit {
  patients$: Observable<Patient[]>;
  loading$: Observable<boolean>;
  error$: Observable<any>;
  selectedPatient$: Observable<Patient | null>;

  constructor(
    private store: Store,
    private toastService: ToastService
  ) {
    this.patients$ = this.store.select(PatientSelectors.selectAllPatients);
    this.loading$ = this.store.select(PatientSelectors.selectPatientLoading);
    this.error$ = this.store.select(PatientSelectors.selectPatientError);
    this.selectedPatient$ = this.store.select(PatientSelectors.selectSelectedPatient);
  }

  ngOnInit(): void {
    this.store.dispatch(PatientActions.loadPatients());

    // Écouter les succès de mise à jour
    this.store.select(PatientSelectors.selectPatientState).subscribe(state => {
      // On pourrait améliorer ça avec un effet dédié
    });
  }

  onEditPatient(patient: Patient): void {
    this.store.dispatch(PatientActions.selectPatient({ patient }));
  }

  onDeletePatient(id: string): void {
    if (confirm('Êtes-vous sûr de vouloir supprimer ce patient ?')) {
      this.store.dispatch(PatientActions.deletePatient({ id }));
      this.toastService.success('Patient supprimé avec succès');
    }
  }
}
