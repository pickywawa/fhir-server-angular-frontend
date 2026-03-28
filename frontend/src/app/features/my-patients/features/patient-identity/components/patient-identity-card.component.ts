import { Component, EventEmitter, Input, OnChanges, Output, SimpleChanges } from '@angular/core';
import { Patient } from '../../../../../core/models/patient.model';
import { PatientProfile } from '../../../../../features/patients/models/patient-admin.model';
import { PatientDetailsFormComponent } from '../../../../../features/patients/features/patient-details/components/patient-details-form.component';

@Component({
  selector: 'app-patient-identity-card',
  standalone: true,
  imports: [PatientDetailsFormComponent],
  templateUrl: './patient-identity-card.component.html',
  styleUrl: './patient-identity-card.component.scss'
})
export class PatientIdentityCardComponent implements OnChanges {
  @Input() patient: Patient | null = null;
  @Input() loading = false;

  @Output() save = new EventEmitter<Patient>();

  patientProfile: PatientProfile | null = null;

  constructor() {}

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['patient'] && this.patient) {
      this.patientProfile = this.toPatientProfile(this.patient);
    }
  }

  onSave(profile: PatientProfile): void {
    if (!this.patient?.id) {
      return;
    }
    const updatedPatient: Patient = {
      ...this.patient,
      firstName: profile.firstName,
      lastName: profile.lastName,
      dateOfBirth: profile.birthDate || '',
      gender: (profile.gender === 'unknown' ? 'other' : (profile.gender || 'other')) as Patient['gender'],
      email: profile.email || '',
      phone: profile.phoneNumber || '',
      address: {
        street: profile.address || '',
        city: profile.city || '',
        state: this.patient.address?.state || '',
        zipCode: profile.postalCode || '',
        country: profile.country || ''
      }
    };

    this.save.emit(updatedPatient);
  }

  private toPatientProfile(patient: Patient): PatientProfile {
    return {
      id: patient.id || '',
      firstName: patient.firstName,
      lastName: patient.lastName,
      birthDate: patient.dateOfBirth,
      gender: patient.gender,
      email: patient.email || '',
      phoneNumber: patient.phone || '',
      address: patient.address?.street || '',
      city: patient.address?.city || '',
      postalCode: patient.address?.zipCode || '',
      country: patient.address?.country || ''
    };
  }
}
