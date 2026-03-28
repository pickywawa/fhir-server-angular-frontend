import { Injectable } from '@angular/core';
import { HttpHeaders, HttpParams } from '@angular/common/http';
import { Observable, map } from 'rxjs';
import { ApiService } from '../../../core/services/api.service';
import { PractitionerProfile, PractitionerSearchCriteria } from '../models/practitioner.model';

@Injectable({
  providedIn: 'root'
})
export class FhirPractitionerService {
  private readonly endpoint = '/Practitioner';
  private readonly fhirHeaders = new HttpHeaders({
    'Content-Type': 'application/fhir+json',
    Accept: 'application/fhir+json'
  });

  constructor(private readonly apiService: ApiService) {}

  searchPractitioners(criteria: PractitionerSearchCriteria): Observable<PractitionerProfile[]> {
    let params = new HttpParams().set('_count', String(criteria.limit ?? 20));

    if (criteria.family?.trim()) {
      params = params.set('family', criteria.family.trim());
    }

    if (criteria.given?.trim()) {
      params = params.set('given', criteria.given.trim());
    }

    if (criteria.identifier?.trim()) {
      params = params.set('identifier', criteria.identifier.trim());
    }

    return this.apiService.get<any>(this.endpoint, { params }).pipe(
      map((bundle) => this.convertBundle(bundle))
    );
  }

  getPractitioner(id: string): Observable<PractitionerProfile> {
    return this.apiService.get<any>(`${this.endpoint}/${id}`).pipe(
      map((fhirPractitioner) => this.convertFhirToProfile(fhirPractitioner))
    );
  }

  createPractitioner(profile: PractitionerProfile): Observable<PractitionerProfile> {
    const payload = this.convertProfileToFhir(profile);
    return this.apiService.post<any>(this.endpoint, payload, { headers: this.fhirHeaders }).pipe(
      map((response) => this.convertFhirToProfile(response))
    );
  }

  updatePractitioner(id: string, profile: PractitionerProfile): Observable<PractitionerProfile> {
    const payload = this.convertProfileToFhir(profile);
    payload.id = id;
    return this.apiService.put<any>(`${this.endpoint}/${id}`, payload, { headers: this.fhirHeaders }).pipe(
      map((response) => this.convertFhirToProfile(response))
    );
  }

  private convertBundle(bundle: any): PractitionerProfile[] {
    if (!bundle?.entry) {
      return [];
    }
    return bundle.entry
      .map((entry: any) => this.convertFhirToProfile(entry.resource))
      .filter((item: PractitionerProfile | null): item is PractitionerProfile => !!item);
  }

  private convertFhirToProfile(resource: any): PractitionerProfile {
    const name = resource?.name?.[0] || {};
    const telecom: any[] = resource?.telecom || [];
    const addresses: any[] = resource?.address || [];
    const qualifications: any[] = resource?.qualification || [];

    const profession = qualifications[0]?.code?.text || qualifications[0]?.code?.coding?.[0]?.display || '';
    const specialty = qualifications[1]?.code?.text || qualifications[1]?.code?.coding?.[0]?.display || '';
    const specialization = qualifications[2]?.code?.text || qualifications[2]?.code?.coding?.[0]?.display || '';

    return {
      id: resource?.id,
      mainIdentifier: resource?.identifier?.[0]?.value || '',
      firstName: name?.given?.[0] || '',
      lastName: name?.family || '',
      prefix: name?.prefix?.[0] || '',
      profession,
      specialty,
      specialization,
      emails: telecom.filter((item) => item.system === 'email').map((item) => item.value).filter(Boolean),
      phones: telecom.filter((item) => item.system === 'phone').map((item) => item.value).filter(Boolean),
      addresses: addresses.map((address) => this.formatAddress(address)).filter(Boolean),
      contacts: telecom
        .filter((item) => item.system !== 'email' && item.system !== 'phone')
        .map((item) => `${item.system || 'contact'}: ${item.value || ''}`.trim())
        .filter((value) => value !== 'contact:')
    };
  }

  private convertProfileToFhir(profile: PractitionerProfile): any {
    const qualifications = [profile.profession, profile.specialty, profile.specialization]
      .filter((item) => item.trim().length > 0)
      .map((item) => ({ code: { text: item.trim() } }));

    const telecom = [
      ...profile.emails.map((value) => ({ system: 'email', value })),
      ...profile.phones.map((value) => ({ system: 'phone', value })),
      ...profile.contacts
        .map((entry) => entry.trim())
        .filter(Boolean)
        .map((value) => {
          const separatorIndex = value.indexOf(':');
          if (separatorIndex > 0) {
            return {
              system: value.slice(0, separatorIndex).trim(),
              value: value.slice(separatorIndex + 1).trim()
            };
          }
          return { system: 'other', value };
        })
    ].filter((entry) => entry.value?.trim().length > 0);

    const addresses = profile.addresses
      .map((value) => value.trim())
      .filter(Boolean)
      .map((value) => ({ text: value, line: [value] }));

    return {
      resourceType: 'Practitioner',
      identifier: profile.mainIdentifier
        ? [{ system: 'urn:healthapp:practitioner-id', value: profile.mainIdentifier.trim() }]
        : [],
      name: [
        {
          family: profile.lastName.trim(),
          given: [profile.firstName.trim()],
          prefix: profile.prefix.trim() ? [profile.prefix.trim()] : []
        }
      ],
      telecom,
      address: addresses,
      qualification: qualifications
    };
  }

  private formatAddress(address: any): string {
    if (address?.text) {
      return address.text;
    }

    const line = (address?.line || []).join(' ').trim();
    const city = address?.city || '';
    const state = address?.state || '';
    const postalCode = address?.postalCode || '';
    const country = address?.country || '';

    return [line, city, state, postalCode, country].filter(Boolean).join(', ');
  }
}
