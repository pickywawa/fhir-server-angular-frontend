import { Injectable } from '@angular/core';
import { HttpHeaders } from '@angular/common/http';
import { Observable, map } from 'rxjs';
import { ApiService } from '../../../../../core/services/api.service';

export interface ConsentAction {
  code: string;
  display: string;
}

export const CONSENT_ACTIONS: ConsentAction[] = [
  { code: 'collect', display: 'Collecter' },
  { code: 'access', display: 'Accéder' },
  { code: 'use', display: 'Utiliser' },
  { code: 'disclose', display: 'Divulguer' },
  { code: 'correct', display: 'Corriger' },
];

export interface ConsentCreateInput {
  patientReference: string;
  carePlanId: string;
  granted: boolean;
  actions: string[];
  confidentiality: 'N' | 'R';
  periodStart?: string;
  periodEnd?: string;
  note?: string;
  dateTime: string;
  verifiedWithReference: string;
  grantorReference?: string;
}

@Injectable({ providedIn: 'root' })
export class FhirConsentService {
  private readonly consentEndpoint = '/Consent';

  private readonly fhirHeaders = new HttpHeaders({
    'Content-Type': 'application/fhir+json',
    Accept: 'application/fhir+json'
  });

  constructor(private readonly apiService: ApiService) {}

  createConsent(input: ConsentCreateInput): Observable<{ id: string }> {
    const payload = this.buildConsentPayload(input);
    return this.apiService.post<any>(this.consentEndpoint, payload, { headers: this.fhirHeaders }).pipe(
      map((resource) => ({ id: String(resource?.id || '').trim() }))
    );
  }

  private buildConsentPayload(input: ConsentCreateInput): object {
    const actionCodings = input.actions.map((code) => ({
      coding: [
        {
          system: 'http://terminology.hl7.org/CodeSystem/consentaction',
          code
        }
      ]
    }));

    const securityLabel =
      input.confidentiality === 'R'
        ? { system: 'http://terminology.hl7.org/CodeSystem/v3-Confidentiality', code: 'R', display: 'restricted' }
        : { system: 'http://terminology.hl7.org/CodeSystem/v3-Confidentiality', code: 'N', display: 'normal' };

    const payload: any = {
      resourceType: 'Consent',
      status: 'active',
      scope: {
        coding: [
          {
            system: 'http://terminology.hl7.org/CodeSystem/consentscope',
            code: 'patient-privacy',
            display: 'Privacy Consent'
          }
        ]
      },
      category: [
        {
          coding: [
            {
              system: 'http://loinc.org',
              code: '59284-0',
              display: 'Consent Document'
            }
          ]
        }
      ],
      patient: { reference: input.patientReference },
      dateTime: input.dateTime,
      sourceReference: { reference: `CarePlan/${input.carePlanId}` },
      provision: {
        type: input.granted ? 'permit' : 'deny',
        action: actionCodings,
        securityLabel: [securityLabel],
        data: [
          {
            meaning: 'related',
            reference: { reference: `CarePlan/${input.carePlanId}` }
          }
        ]
      },
      policyRule: {
        coding: [{
          system: 'http://terminology.hl7.org/CodeSystem/v3-ActCode',
          code: input.granted ? 'OPTIN' : 'OPTOUT'
        }]
      },
      verification: [
        {
          verified: input.granted,
          verifiedWith: { reference: input.verifiedWithReference },
          verificationDate: input.dateTime
        }
      ]
    };

    if (input.periodStart || input.periodEnd) {
      payload.provision.period = {};
      if (input.periodStart) {
        payload.provision.period.start = input.periodStart;
      }
      if (input.periodEnd) {
        payload.provision.period.end = input.periodEnd;
      }
    }

    if (input.note?.trim()) {
      payload.extension = [
        {
          url: 'http://healthapp.local/fhir/extensions/consent#note',
          valueString: input.note.trim()
        }
      ];
    }

    return payload;
  }
}
