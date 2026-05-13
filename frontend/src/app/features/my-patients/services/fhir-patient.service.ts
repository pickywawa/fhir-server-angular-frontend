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
  private readonly identityStatusExtensionUrl = 'http://healthapp.local/fhir/extensions/patient-identity-status';
  private readonly attendingPhysicianExtensionUrl = 'http://healthapp.local/fhir/extensions/attending-physician';

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
    const ins = this.extractPatientIns(fhirPatient);
    const identityStatus = this.extractExtensionValue(fhirPatient, this.identityStatusExtensionUrl) || (ins ? 'Validee' : 'Provisoire');
    const attendingPhysician = this.extractAttendingPhysician(fhirPatient);

    return {
      id: fhirPatient.id,
      firstName: name.given?.[0] || '',
      lastName: name.family || '',
      ins,
      identityStatus,
      attendingPhysician,
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

    const ins = String(patient.ins || '').trim();
    if (ins) {
      fhirPatient.identifier = [
        {
          system: 'urn:oid:1.2.250.1.213.1.4.8',
          type: {
            coding: [{ system: 'http://terminology.hl7.org/CodeSystem/v2-0203', code: 'INS' }]
          },
          value: ins
        }
      ];
    }

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

    const identityStatus = String(patient.identityStatus || '').trim();
    if (identityStatus) {
      this.upsertExtension(fhirPatient, this.identityStatusExtensionUrl, 'valueString', identityStatus);
    }

    const attendingPhysician = String(patient.attendingPhysician || '').trim();
    if (attendingPhysician) {
      this.upsertExtension(fhirPatient, this.attendingPhysicianExtensionUrl, 'valueString', attendingPhysician);
    }

    return fhirPatient;
  }

  private extractPatientIns(fhirPatient: any): string {
    const identifiers = Array.isArray(fhirPatient?.identifier) ? fhirPatient.identifier : [];
    const match = identifiers.find((identifier: any) => {
      const system = String(identifier?.system || '').toLowerCase();
      const typeCode = String(identifier?.type?.coding?.[0]?.code || '').toUpperCase();
      return typeCode === 'INS' || typeCode === 'NI' || typeCode === 'NIR' || typeCode === 'SS' || system.includes('ins') || system.includes('nir') || system.includes('insee');
    });
    return String(match?.value || '').trim();
  }

  private extractAttendingPhysician(fhirPatient: any): string {
    const practitionerDisplay = String(fhirPatient?.generalPractitioner?.[0]?.display || '').trim();
    if (practitionerDisplay) {
      return practitionerDisplay;
    }
    return this.extractExtensionValue(fhirPatient, this.attendingPhysicianExtensionUrl);
  }

  private extractExtensionValue(fhirPatient: any, url: string): string {
    const extensions = Array.isArray(fhirPatient?.extension) ? fhirPatient.extension : [];
    const entry = extensions.find((ext: any) => String(ext?.url || '') === url);
    return String(entry?.valueString || entry?.valueCode || '').trim();
  }

  private upsertExtension(resource: any, url: string, valueKey: 'valueString' | 'valueCode', value: string): void {
    const extensions = Array.isArray(resource?.extension) ? [...resource.extension] : [];
    const index = extensions.findIndex((ext: any) => String(ext?.url || '') === url);
    const payload = { url, [valueKey]: value };
    if (index >= 0) {
      extensions[index] = payload;
    } else {
      extensions.push(payload);
    }
    resource.extension = extensions;
  }
}
