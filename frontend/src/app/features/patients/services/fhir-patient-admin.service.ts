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
  private readonly identityStatusExtensionUrl = 'http://healthapp.local/fhir/extensions/patient-identity-status';
  private readonly attendingPhysicianExtensionUrl = 'http://healthapp.local/fhir/extensions/attending-physician';

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
