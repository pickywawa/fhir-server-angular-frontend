import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, Validators, ReactiveFormsModule } from '@angular/forms';
import { Store } from '@ngrx/store';
import { Observable } from 'rxjs';
import { Patient } from '../../../core/models/patient.model';
import * as PatientActions from '../state/patient.actions';
import * as PatientSelectors from '../state/patient.selectors';

@Component({
  selector: 'app-patient-form',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule],
  templateUrl: './patient-form.component.html',
  styleUrls: ['./patient-form.component.scss']
})
export class PatientFormComponent implements OnInit {
  patientForm!: FormGroup;
  selectedPatient$: Observable<Patient | null>;
  loading$: Observable<boolean>;

  constructor(
    private fb: FormBuilder,
    private store: Store
  ) {
    this.selectedPatient$ = this.store.select(PatientSelectors.selectSelectedPatient);
    this.loading$ = this.store.select(PatientSelectors.selectPatientLoading);
  }

  ngOnInit(): void {
    this.initForm();

    this.selectedPatient$.subscribe(patient => {
      if (patient) {
        this.patchFormValues(patient);
      }
    });
  }

  initForm(): void {
    this.patientForm = this.fb.group({
      firstName: ['', Validators.required],
      lastName: ['', Validators.required],
      dateOfBirth: ['', Validators.required],
      gender: ['', Validators.required],
      email: ['', [Validators.email]],
      phone: [''],
      address: this.fb.group({
        street: [''],
        city: [''],
        state: [''],
        zipCode: [''],
        country: ['']
      })
    });
  }

  patchFormValues(patient: Patient): void {
    this.patientForm.patchValue({
      firstName: patient.firstName,
      lastName: patient.lastName,
      dateOfBirth: patient.dateOfBirth,
      gender: patient.gender,
      email: patient.email || '',
      phone: patient.phone || '',
      address: {
        street: patient.address?.street || '',
        city: patient.address?.city || '',
        state: patient.address?.state || '',
        zipCode: patient.address?.zipCode || '',
        country: patient.address?.country || ''
      }
    });
  }

  onSubmit(): void {
    if (this.patientForm.valid) {
      this.selectedPatient$.subscribe(patient => {
        if (patient && patient.id) {
          const updatedPatient: Patient = {
            ...this.patientForm.value,
            id: patient.id
          };
          this.store.dispatch(PatientActions.updatePatient({
            id: patient.id,
            patient: updatedPatient
          }));
        }
      }).unsubscribe();
    }
  }

  onCancel(): void {
    this.store.dispatch(PatientActions.selectPatient({ patient: null }));
  }
}
