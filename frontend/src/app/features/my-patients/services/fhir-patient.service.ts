import { Injectable } from '@angular/core';
import { HttpHeaders, HttpParams } from '@angular/common/http';
import { Observable, map } from 'rxjs';
import { ApiService } from '../../../core/services/api.service';
import { Patient } from '../../../core/models/patient.model';
import { PatientSearchCriteria } from '../state/patient.actions';

@Injectable({
  providedIn: 'root'
})
export class FhirPatientService {
  private readonly endpoint = '/Patient';
  private readonly fhirHeaders = new HttpHeaders({
    'Content-Type': 'application/fhir+json',
    'Accept': 'application/fhir+json'
  });

  constructor(private apiService: ApiService) {}

  getPatients(criteria?: PatientSearchCriteria): Observable<Patient[]> {
    let params = new HttpParams().set('_count', String(criteria?.limit ?? 20));

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
      map(bundle => this.convertBundleToPatients(bundle))
    );
  }

  getPatient(id: string): Observable<Patient> {
    return this.apiService.get<any>(`${this.endpoint}/${id}`).pipe(
      map(fhirPatient => this.convertFhirToPatient(fhirPatient))
    );
  }

  createPatient(patient: Patient): Observable<Patient> {
    const fhirPatient = this.convertPatientToFhir(patient);
    return this.apiService.post<any>(this.endpoint, fhirPatient, { headers: this.fhirHeaders }).pipe(
      map(response => this.convertFhirToPatient(response))
    );
  }

  updatePatient(id: string, patient: Patient): Observable<Patient> {
    const fhirPatient = this.convertPatientToFhir(patient);
    fhirPatient.id = id;
    return this.apiService.put<any>(`${this.endpoint}/${id}`, fhirPatient, { headers: this.fhirHeaders }).pipe(
      map(response => this.convertFhirToPatient(response))
    );
  }

  deletePatient(id: string): Observable<void> {
    return this.apiService.delete<void>(`${this.endpoint}/${id}`);
  }

  // Conversion FHIR Bundle vers Patient[]
  private convertBundleToPatients(bundle: any): Patient[] {
    if (!bundle || !bundle.entry) {
      return [];
    }
    return bundle.entry.map((entry: any) => this.convertFhirToPatient(entry.resource));
  }

  // Conversion FHIR Patient vers Patient
  private convertFhirToPatient(fhirPatient: any): Patient {
    const name = fhirPatient.name?.[0] || {};
    const address = fhirPatient.address?.[0] || {};
    const telecom = fhirPatient.telecom || [];

    return {
      id: fhirPatient.id,
      firstName: name.given?.[0] || '',
      lastName: name.family || '',
      dateOfBirth: fhirPatient.birthDate || '',
      gender: fhirPatient.gender || 'other',
      email: telecom.find((t: any) => t.system === 'email')?.value,
      phone: telecom.find((t: any) => t.system === 'phone')?.value,
      address: address.line ? {
        street: address.line[0] || '',
        city: address.city || '',
        state: address.state || '',
        zipCode: address.postalCode || '',
        country: address.country || ''
      } : undefined
    };
  }

  // Conversion Patient vers FHIR Patient
  private convertPatientToFhir(patient: Patient): any {
    const fhirPatient: any = {
      resourceType: 'Patient',
      name: [{
        family: patient.lastName,
        given: [patient.firstName]
      }],
      gender: patient.gender,
      birthDate: patient.dateOfBirth,
      telecom: []
    };

    if (patient.email) {
      fhirPatient.telecom.push({
        system: 'email',
        value: patient.email
      });
    }

    if (patient.phone) {
      fhirPatient.telecom.push({
        system: 'phone',
        value: patient.phone
      });
    }

    if (patient.address) {
      fhirPatient.address = [{
        line: [patient.address.street],
        city: patient.address.city,
        state: patient.address.state,
        postalCode: patient.address.zipCode,
        country: patient.address.country
      }];
    }

    return fhirPatient;
  }
}
