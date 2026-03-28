import { Injectable } from '@angular/core';
import { HttpHeaders, HttpParams } from '@angular/common/http';
import { Observable, map } from 'rxjs';
import { ApiService } from '../../../core/services/api.service';
import { PatientProfile, PatientSearchCriteria } from '../models/patient-admin.model';

@Injectable({
  providedIn: 'root'
})
export class FhirPatientAdminService {
  private readonly endpoint = '/Patient';
  private readonly fhirHeaders = new HttpHeaders({
    'Content-Type': 'application/fhir+json',
    'Accept': 'application/fhir+json'
  });

  constructor(private apiService: ApiService) {}

  searchPatients(criteria?: PatientSearchCriteria): Observable<PatientProfile[]> {
    let params = new HttpParams().set('_count', '20');

    if (criteria?.family?.trim()) {
      params = params.set('family', criteria.family.trim());
    }

    if (criteria?.given?.trim()) {
      params = params.set('given', criteria.given.trim());
    }

    if (criteria?.birthDate?.trim()) {
      params = params.set('birthdate', criteria.birthDate.trim());
    }

    return this.apiService.get<any>(this.endpoint, { params }).pipe(
      map(bundle => this.convertBundleToProfiles(bundle))
    );
  }

  getPatient(id: string): Observable<PatientProfile> {
    return this.apiService.get<any>(`${this.endpoint}/${id}`).pipe(
      map(fhirPatient => this.convertFhirToProfile(fhirPatient))
    );
  }

  createPatient(patient: PatientProfile): Observable<PatientProfile> {
    const fhirPatient = this.convertProfileToFhir(patient);
    return this.apiService.post<any>(this.endpoint, fhirPatient, { headers: this.fhirHeaders }).pipe(
      map(response => this.convertFhirToProfile(response))
    );
  }

  updatePatient(id: string, patient: PatientProfile): Observable<PatientProfile> {
    const fhirPatient = this.convertProfileToFhir(patient);
    fhirPatient.id = id;
    return this.apiService.put<any>(`${this.endpoint}/${id}`, fhirPatient, { headers: this.fhirHeaders }).pipe(
      map(response => this.convertFhirToProfile(response))
    );
  }

  // Conversion FHIR Bundle → PatientProfile[]
  private convertBundleToProfiles(bundle: any): PatientProfile[] {
    if (!bundle || !bundle.entry) {
      return [];
    }
    return bundle.entry.map((entry: any) => this.convertFhirToProfile(entry.resource));
  }

  // Conversion FHIR Patient → PatientProfile
  private convertFhirToProfile(fhirPatient: any): PatientProfile {
    const name = fhirPatient.name?.[0] || {};
    const address = fhirPatient.address?.[0] || {};
    const telecom = fhirPatient.telecom || [];

    return {
      id: fhirPatient.id,
      firstName: name.given?.[0] || '',
      lastName: name.family || '',
      birthDate: fhirPatient.birthDate || '',
      gender: fhirPatient.gender as 'male' | 'female' | 'other' | 'unknown' || 'unknown',
      phoneNumber: telecom.find((t: any) => t.system === 'phone')?.value,
      email: telecom.find((t: any) => t.system === 'email')?.value,
      address: address.line?.[0],
      city: address.city,
      postalCode: address.postalCode,
      country: address.country
    };
  }

  // Conversion PatientProfile → FHIR Patient
  private convertProfileToFhir(patient: PatientProfile): any {
    const fhirPatient: any = {
      resourceType: 'Patient',
      name: [{
        family: patient.lastName,
        given: [patient.firstName]
      }],
      gender: patient.gender,
      birthDate: patient.birthDate,
      telecom: []
    };

    if (patient.email) {
      fhirPatient.telecom.push({
        system: 'email',
        value: patient.email
      });
    }

    if (patient.phoneNumber) {
      fhirPatient.telecom.push({
        system: 'phone',
        value: patient.phoneNumber
      });
    }

    if (patient.address || patient.city || patient.postalCode || patient.country) {
      fhirPatient.address = [{
        line: patient.address ? [patient.address] : [],
        city: patient.city,
        postalCode: patient.postalCode,
        country: patient.country
      }];
    }

    return fhirPatient;
  }
}
