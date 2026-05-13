import { Injectable } from '@angular/core';
import { HttpHeaders, HttpParams } from '@angular/common/http';
import { Observable, map, of } from 'rxjs';
import { ApiService } from '../../../../../core/services/api.service';
import { PatientConsentSummary } from '../models/patient-consent.model';

export interface ConsentSaveInput {
  patientReference: string;
  granted: boolean;
  actions: string[];
  confidentiality: 'N' | 'R';
  periodStart?: string;
  periodEnd?: string;
  note?: string;
  dateTime: string;
  verifiedWithReference: string;
  grantorReference?: string;
  carePlanReference?: string;
}

@Injectable({ providedIn: 'root' })
export class FhirPatientConsentService {
  private readonly endpoint = '/Consent';

  private readonly fhirHeaders = new HttpHeaders({
    'Content-Type': 'application/fhir+json',
    Accept: 'application/fhir+json'
  });

  constructor(private readonly apiService: ApiService) {}

  getConsentsForPatient(patientId: string): Observable<PatientConsentSummary[]> {
    const params = new HttpParams()
      .set('patient', patientId)
      .set('status', 'active')
      .set('_count', '20')
      .set('_sort', '-_lastUpdated');

    return this.apiService.get<any>(this.endpoint, { params }).pipe(
      map((bundle) => {
        const entries = Array.isArray(bundle?.entry) ? bundle.entry : [];
        return entries
          .map((e: any) => this.convertConsent(e?.resource))
          .filter((c: PatientConsentSummary | null): c is PatientConsentSummary => !!c);
      })
    );
  }

  getFirstConsentForPatient(patientId: string): Observable<PatientConsentSummary | null> {
    return this.getConsentsForPatient(patientId).pipe(
      map((list) => list[0] ?? null)
    );
  }

  createConsent(input: ConsentSaveInput): Observable<PatientConsentSummary> {
    const payload = this.buildPayload(input);
    return this.apiService.post<any>(this.endpoint, payload, { headers: this.fhirHeaders }).pipe(
      map((resource) => this.convertConsent(resource) ?? { id: '', granted: input.granted, dateTime: input.dateTime, actions: input.actions, confidentiality: input.confidentiality })
    );
  }

  updateConsent(id: string, input: ConsentSaveInput): Observable<PatientConsentSummary> {
    const payload = { ...this.buildPayload(input), id };
    return this.apiService.put<any>(`${this.endpoint}/${id}`, payload, { headers: this.fhirHeaders }).pipe(
      map((resource) => this.convertConsent(resource) ?? { id, granted: input.granted, dateTime: input.dateTime, actions: input.actions, confidentiality: input.confidentiality })
    );
  }

  private buildPayload(input: ConsentSaveInput): any {
    const actionCodings = input.actions.map((code) => ({
      coding: [{ system: 'http://terminology.hl7.org/CodeSystem/consentaction', code }]
    }));

    const securityLabel = input.confidentiality === 'R'
      ? { system: 'http://terminology.hl7.org/CodeSystem/v3-Confidentiality', code: 'R', display: 'restricted' }
      : { system: 'http://terminology.hl7.org/CodeSystem/v3-Confidentiality', code: 'N', display: 'normal' };

    const payload: any = {
      resourceType: 'Consent',
      status: 'active',
      scope: {
        coding: [{
          system: 'http://terminology.hl7.org/CodeSystem/consentscope',
          code: 'patient-privacy',
          display: 'Privacy Consent'
        }]
      },
      category: [{
        coding: [{
          system: 'http://loinc.org',
          code: '59284-0',
          display: 'Consent Document'
        }]
      }],
      patient: { reference: input.patientReference },
      dateTime: input.dateTime,
      provision: {
        type: input.granted ? 'permit' : 'deny',
        action: actionCodings,
        securityLabel: [securityLabel]
      },
      policyRule: {
        coding: [{
          system: 'http://terminology.hl7.org/CodeSystem/v3-ActCode',
          code: input.granted ? 'OPTIN' : 'OPTOUT'
        }]
      },
      verification: [{
        verified: input.granted,
        verifiedWith: { reference: input.verifiedWithReference },
        verificationDate: input.dateTime
      }]
    };

    if (input.carePlanReference) {
      payload.sourceReference = { reference: input.carePlanReference };
      payload.provision.data = [{
        meaning: 'related',
        reference: { reference: input.carePlanReference }
      }];
    }

    if (input.periodStart || input.periodEnd) {
      payload.provision.period = {
        ...(input.periodStart ? { start: input.periodStart } : {}),
        ...(input.periodEnd ? { end: input.periodEnd } : {})
      };
    }

    if (input.note?.trim()) {
      payload.extension = [{
        url: 'http://healthapp.local/fhir/extensions/consent#note',
        valueString: input.note.trim()
      }];
    }

    return payload;
  }

  private convertConsent(resource: any): PatientConsentSummary | null {
    const id = String(resource?.id || '').trim();
    if (!id) return null;

    const provisionType = String(resource?.provision?.type || 'deny').trim();
    const granted = provisionType === 'permit';

    const secCode = String(resource?.provision?.securityLabel?.[0]?.code || 'N').trim();
    const confidentiality: 'N' | 'R' = secCode === 'R' ? 'R' : 'N';

    const actions: string[] = (resource?.provision?.action || [])
      .flatMap((a: any) => (a?.coding || []).map((c: any) => String(c?.code || '').trim()))
      .filter((c: string) => c.length > 0);

    const note = String(
      resource?.extension?.find((e: any) => e?.url?.endsWith('consent#note'))?.valueString || ''
    ).trim() || undefined;

    const carePlanReference = String(resource?.sourceReference?.reference || '').trim() || undefined;

    const period = resource?.provision?.period;

    return {
      id,
      granted,
      dateTime: String(resource?.dateTime || resource?.meta?.lastUpdated || '').trim(),
      actions,
      confidentiality,
      periodStart: period?.start ? String(period.start).slice(0, 10) : undefined,
      periodEnd: period?.end ? String(period.end).slice(0, 10) : undefined,
      note,
      carePlanReference,
      verifiedWithReference: String(resource?.verification?.[0]?.verifiedWith?.reference || '').trim() || undefined,
      grantorReference: String(resource?.performer?.[0]?.reference || '').trim() || undefined
    };
  }
}
