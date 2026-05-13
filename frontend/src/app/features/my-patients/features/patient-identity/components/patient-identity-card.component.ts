import { Component, EventEmitter, Input, OnChanges, OnDestroy, Output, SimpleChanges } from '@angular/core';
import { Subject, takeUntil } from 'rxjs';
import { Patient } from '../../../../../core/models/patient.model';
import { PatientProfile } from '../../../../../features/patients/models/patient-admin.model';
import { PatientDetailsFormComponent } from '../../../../../features/patients/features/patient-details/components/patient-details-form.component';
import { ApiService } from '../../../../../core/services/api.service';

@Component({
  selector: 'app-patient-identity-card',
  standalone: true,
  imports: [PatientDetailsFormComponent],
  templateUrl: './patient-identity-card.component.html',
  styleUrl: './patient-identity-card.component.scss'
})
export class PatientIdentityCardComponent implements OnChanges, OnDestroy {
  @Input() patient: Patient | null = null;
  @Input() loading = false;

  @Output() save = new EventEmitter<Patient>();

  patientProfile: PatientProfile | null = null;
  private readonly destroy$ = new Subject<void>();

  constructor(private readonly apiService: ApiService) {}

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['patient'] && this.patient) {
      this.patientProfile = this.toPatientProfile(this.patient);
      this.loadIdentityMetadata(this.patient.id);
    }
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  onSave(profile: PatientProfile): void {
    if (!this.patient?.id) {
      return;
    }
    const updatedPatient: Patient = {
      ...this.patient,
      firstName: profile.firstName,
      lastName: profile.lastName,
      ins: String(profile.ins || '').trim(),
      identityStatus: String(profile.identityStatus || '').trim() || 'Provisoire',
      attendingPhysician: String(profile.attendingPhysician || '').trim(),
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
      ins: patient.ins || '',
      identityStatus: patient.identityStatus || 'Provisoire',
      attendingPhysician: patient.attendingPhysician || '',
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

  private loadIdentityMetadata(patientId?: string): void {
    const id = String(patientId || '').trim();
    if (!id || !this.patientProfile) {
      return;
    }

    this.apiService.get<any>(`/Patient/${id}`)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (rawPatient) => {
          if (!this.patientProfile) {
            return;
          }

          const ins = this.extractPatientIns(rawPatient);
          this.patientProfile = {
            ...this.patientProfile,
            ins: ins || '',
            identityStatus: ins ? 'Validee' : 'Provisoire',
            attendingPhysician: ''
          };

          this.loadAttendingPhysician(rawPatient);
        },
        error: () => {
          if (!this.patientProfile) {
            return;
          }

          this.patientProfile = {
            ...this.patientProfile,
            ins: '',
            identityStatus: 'Provisoire',
            attendingPhysician: ''
          };
        }
      });
  }

  private loadAttendingPhysician(rawPatient: any): void {
    if (!this.patientProfile) {
      return;
    }

    const practitionerRef = Array.isArray(rawPatient?.generalPractitioner)
      ? rawPatient.generalPractitioner[0]
      : null;

    const display = String(practitionerRef?.display || '').trim();
    if (display) {
      this.patientProfile = {
        ...this.patientProfile,
        attendingPhysician: display.toLowerCase().startsWith('dr.') ? display : `Dr. ${display}`
      };
      return;
    }

    const practitionerId = this.extractResourceId(practitionerRef?.reference, 'Practitioner');
    if (!practitionerId) {
      this.patientProfile = {
        ...this.patientProfile,
        attendingPhysician: ''
      };
      return;
    }

    this.apiService.get<any>(`/Practitioner/${practitionerId}`)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (practitioner) => {
          if (!this.patientProfile) {
            return;
          }

          const given = String(practitioner?.name?.[0]?.given?.[0] || '').trim();
          const family = String(practitioner?.name?.[0]?.family || '').trim();
          const fullName = `${given} ${family}`.trim();

          this.patientProfile = {
            ...this.patientProfile,
            attendingPhysician: fullName ? `Dr. ${fullName}` : ''
          };
        },
        error: () => {
          if (!this.patientProfile) {
            return;
          }

          this.patientProfile = {
            ...this.patientProfile,
            attendingPhysician: ''
          };
        }
      });
  }

  private extractPatientIns(rawPatient: any): string {
    const identifiers = Array.isArray(rawPatient?.identifier) ? rawPatient.identifier : [];
    const match = identifiers.find((identifier: any) => {
      const system = String(identifier?.system || '').toLowerCase();
      const typeCode = String(identifier?.type?.coding?.[0]?.code || '').toUpperCase();
      return typeCode === 'INS' || typeCode === 'NI' || typeCode === 'NIR' || typeCode === 'SS' || system.includes('ins') || system.includes('nir') || system.includes('insee');
    });

    return String(match?.value || '').trim();
  }

  private extractResourceId(reference: string, resourceType: string): string {
    const raw = String(reference || '').trim();
    if (!raw) {
      return '';
    }

    const marker = `${resourceType}/`;
    const markerIndex = raw.lastIndexOf(marker);
    if (markerIndex < 0) {
      return '';
    }

    return raw.slice(markerIndex + marker.length).trim();
  }
}
