import { Injectable } from '@angular/core';
import { HttpHeaders, HttpParams } from '@angular/common/http';
import { Observable, map } from 'rxjs';
import { ApiService } from '../../../../../core/services/api.service';
import { CreateRelatedPersonInput, RelatedPersonProfile } from '../../../models/related-person.model';

@Injectable({
  providedIn: 'root'
})
export class FhirRelatedPersonService {
  private readonly endpoint = '/RelatedPerson';
  private readonly fhirHeaders = new HttpHeaders({
    'Content-Type': 'application/fhir+json',
    Accept: 'application/fhir+json'
  });

  constructor(private readonly apiService: ApiService) {}

  listByPatient(patientId: string): Observable<RelatedPersonProfile[]> {
    const params = new HttpParams()
      .set('patient', patientId)
      .set('_count', '100')
      .set('_sort', '-_lastUpdated');

    return this.apiService.get<any>(this.endpoint, { params }).pipe(
      map((bundle) => this.convertBundle(bundle))
    );
  }

  createRelatedPerson(patientId: string, input: CreateRelatedPersonInput): Observable<RelatedPersonProfile> {
    const payload = this.buildPayload(patientId, input);

    return this.apiService.post<any>(this.endpoint, payload, { headers: this.fhirHeaders }).pipe(
      map((resource) => {
        const converted = this.convertResource(resource);
        if (!converted) {
          throw new Error('Invalid RelatedPerson response');
        }
        return converted;
      })
    );
  }

  updateRelatedPerson(id: string, patientId: string, input: CreateRelatedPersonInput): Observable<RelatedPersonProfile> {
    const payload = {
      ...this.buildPayload(patientId, input),
      id
    };

    return this.apiService.put<any>(`${this.endpoint}/${id}`, payload, { headers: this.fhirHeaders }).pipe(
      map((resource) => {
        const converted = this.convertResource(resource);
        if (!converted) {
          throw new Error('Invalid RelatedPerson response');
        }
        return converted;
      })
    );
  }

  deleteRelatedPerson(id: string): Observable<void> {
    return this.apiService.delete<any>(`${this.endpoint}/${id}`, { headers: this.fhirHeaders }).pipe(
      map(() => undefined)
    );
  }

  private convertBundle(bundle: any): RelatedPersonProfile[] {
    if (!bundle?.entry?.length) {
      return [];
    }

    return bundle.entry
      .map((entry: any) => this.convertResource(entry?.resource))
      .filter((item: RelatedPersonProfile | null): item is RelatedPersonProfile => !!item);
  }

  private buildPayload(patientId: string, input: CreateRelatedPersonInput): any {
    return {
      resourceType: 'RelatedPerson',
      active: true,
      patient: {
        reference: `Patient/${patientId}`
      },
      relationship: [
        {
          coding: [
            {
              system: 'http://terminology.hl7.org/CodeSystem/v3-RoleCode',
              code: input.roleCode,
              display: input.roleDisplay
            }
          ],
          text: input.roleDisplay
        }
      ],
      name: [
        {
          text: input.name.trim()
        }
      ],
      telecom: [
        input.phone
          ? {
            system: 'phone',
            value: input.phone.trim(),
            use: 'mobile'
          }
          : null,
        input.email
          ? {
            system: 'email',
            value: input.email.trim(),
            use: 'home'
          }
          : null
      ].filter(Boolean),
      gender: input.gender,
      birthDate: input.birthDate,
      address: [
        {
          text: input.address.trim(),
          city: input.city || undefined,
          postalCode: input.postalCode || undefined
        }
      ],
      communication: input.language
        ? [
          {
            language: {
              text: input.language.trim()
            },
            preferred: true
          }
        ]
        : undefined
    };
  }

  private convertResource(resource: any): RelatedPersonProfile | null {
    if (!resource?.id) {
      return null;
    }

    const nameText = this.extractName(resource);
    const roleCoding = resource.relationship?.[0]?.coding?.[0];
    const roleDisplay = resource.relationship?.[0]?.text || roleCoding?.display || roleCoding?.code || 'Role non renseigne';

    const telecom = Array.isArray(resource.telecom) ? resource.telecom : [];
    const phone = telecom.find((item: any) => item?.system === 'phone')?.value || '';
    const email = telecom.find((item: any) => item?.system === 'email')?.value || '';

    const firstAddress = resource.address?.[0];
    const address = firstAddress?.text || [
      ...(Array.isArray(firstAddress?.line) ? firstAddress.line : []),
      firstAddress?.postalCode,
      firstAddress?.city
    ].filter(Boolean).join(' ');

    return {
      id: String(resource.id),
      name: nameText,
      roleCode: roleCoding?.code || '',
      roleDisplay: String(roleDisplay),
      phone: phone ? String(phone) : undefined,
      email: email ? String(email) : undefined,
      gender: String(resource.gender || 'unknown'),
      birthDate: String(resource.birthDate || ''),
      address: address ? String(address) : undefined,
      language: String(resource.communication?.[0]?.language?.text || resource.communication?.[0]?.language?.coding?.[0]?.code || '') || undefined
    };
  }

  private extractName(resource: any): string {
    const firstName = resource.name?.[0];
    if (!firstName) {
      return 'Entourage inconnu';
    }

    if (firstName.text) {
      return String(firstName.text);
    }

    const given = Array.isArray(firstName.given) ? firstName.given.join(' ') : '';
    const family = String(firstName.family || '');
    const merged = `${given} ${family}`.trim();
    return merged || 'Entourage inconnu';
  }
}
