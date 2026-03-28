import { Injectable } from '@angular/core';
import { HttpHeaders, HttpParams } from '@angular/common/http';
import { forkJoin, map, Observable } from 'rxjs';
import { ApiService } from '../../../../../core/services/api.service';
import {
  CarePlanCategoryOption,
  PatientCarePlanFormValue,
  PatientCarePlanLoadResult
} from '../models/patient-care-plan.model';

export interface CarePlanCreateInput {
  patientReference: string;
  categoryCode: string;
  status: string;
  intent: string;
  title: string;
  description: string;
  note: string;
}

@Injectable({ providedIn: 'root' })
export class FhirCarePlanService {
  private readonly carePlanEndpoint = '/CarePlan';
  private readonly codeSystemEndpoint = '/CodeSystem';
  private readonly categoryCodeSystemUrl = 'https://healthapp.local/fhir/CodeSystem/care-plan-category/fr_FR';

  private readonly fhirHeaders = new HttpHeaders({
    'Content-Type': 'application/fhir+json',
    Accept: 'application/fhir+json'
  });

  constructor(private readonly apiService: ApiService) {}

  getCarePlansForPatient(patientId: string): Observable<PatientCarePlanLoadResult> {
    const carePlanParams = new HttpParams()
      .set('_count', '100')
      .set('subject', `Patient/${patientId}`);

    const codeSystemParams = new HttpParams()
      .set('_count', '1')
      .set('url', this.categoryCodeSystemUrl);

    return forkJoin({
      carePlanBundle: this.apiService.get<any>(this.carePlanEndpoint, { params: carePlanParams }),
      codeSystemBundle: this.apiService.get<any>(this.codeSystemEndpoint, { params: codeSystemParams })
    }).pipe(
      map(({ carePlanBundle, codeSystemBundle }) => ({
        carePlans: this.convertCarePlans(carePlanBundle),
        categories: this.convertCategories(codeSystemBundle)
      }))
    );
  }

  getCarePlanCategories(): Observable<CarePlanCategoryOption[]> {
    const codeSystemParams = new HttpParams()
      .set('_count', '1')
      .set('url', this.categoryCodeSystemUrl);

    return this.apiService.get<any>(this.codeSystemEndpoint, { params: codeSystemParams }).pipe(
      map((bundle) => this.convertCategories(bundle))
    );
  }

  createCarePlan(input: CarePlanCreateInput): Observable<{ id: string; patientId: string }> {
    const payload = {
      resourceType: 'CarePlan',
      identifier: [
        {
          system: 'urn:ietf:rfc:3986',
          value: this.generateUuidUrn()
        }
      ],
      status: input.status,
      intent: input.intent,
      title: input.title,
      description: input.description,
      subject: {
        reference: input.patientReference
      },
      category: [
        {
          coding: [
            {
              system: this.categoryCodeSystemUrl,
              code: input.categoryCode
            }
          ]
        }
      ],
      note: input.note?.trim() ? [{ text: input.note.trim() }] : []
    };

    return this.apiService.post<any>(this.carePlanEndpoint, payload, { headers: this.fhirHeaders }).pipe(
      map((resource) => {
        const id = String(resource?.id || '').trim();
        const ref = String(resource?.subject?.reference || input.patientReference || '').trim();
        const patientId = this.extractPatientId(ref);
        return { id, patientId };
      })
    );
  }

  updateCarePlan(value: PatientCarePlanFormValue, patientId: string): Observable<PatientCarePlanFormValue> {
    const payload = {
      resourceType: 'CarePlan',
      id: value.id,
      status: value.status,
      intent: value.intent,
      title: value.title,
      description: value.description,
      subject: {
        reference: `Patient/${patientId}`
      },
      category: [
        {
          coding: [
            {
              system: this.categoryCodeSystemUrl,
              code: value.categoryCode
            }
          ]
        }
      ],
      note: value.note?.trim() ? [{ text: value.note.trim() }] : []
    };

    return this.apiService.put<any>(`${this.carePlanEndpoint}/${value.id}`, payload, { headers: this.fhirHeaders }).pipe(
      map((resource) => this.convertCarePlan(resource) || value)
    );
  }

  private convertCarePlans(bundle: any): PatientCarePlanFormValue[] {
    const entries = Array.isArray(bundle?.entry) ? bundle.entry : [];

    return entries
      .map((entry: any) => this.convertCarePlan(entry?.resource))
      .filter((value: PatientCarePlanFormValue | null): value is PatientCarePlanFormValue => !!value)
      .sort((a: PatientCarePlanFormValue, b: PatientCarePlanFormValue) =>
        (b.id || '').localeCompare(a.id || '')
      );
  }

  private convertCarePlan(resource: any): PatientCarePlanFormValue | null {
    const id = String(resource?.id || '').trim();
    if (!id) {
      return null;
    }

    return {
      id,
      status: String(resource?.status || 'draft').trim(),
      intent: String(resource?.intent || 'plan').trim(),
      categoryCode: String(resource?.category?.[0]?.coding?.[0]?.code || '').trim(),
      title: String(resource?.title || '').trim(),
      description: String(resource?.description || '').trim(),
      note: String(resource?.note?.[0]?.text || '').trim()
    };
  }

  private convertCategories(bundle: any): CarePlanCategoryOption[] {
    const entries = Array.isArray(bundle?.entry) ? bundle.entry : [];
    const codeSystem = entries[0]?.resource;
    const concepts = Array.isArray(codeSystem?.concept) ? codeSystem.concept : [];

    return concepts
      .map((concept: any) => ({
        code: String(concept?.code || '').trim(),
        label: String(concept?.display || concept?.code || '').trim()
      }))
      .filter((item: CarePlanCategoryOption) => item.code.length > 0)
      .sort((a: CarePlanCategoryOption, b: CarePlanCategoryOption) => a.label.localeCompare(b.label));
  }

  private extractPatientId(reference: string): string {
    const marker = 'Patient/';
    const markerIndex = reference.lastIndexOf(marker);
    if (markerIndex >= 0) {
      return reference.substring(markerIndex + marker.length);
    }
    return reference;
  }

  private generateUuidUrn(): string {
    const maybeCrypto = typeof globalThis !== 'undefined' ? (globalThis as any).crypto : null;
    if (maybeCrypto?.randomUUID) {
      return `urn:uuid:${maybeCrypto.randomUUID()}`;
    }
    const random = Math.random().toString(16).slice(2);
    const now = Date.now().toString(16);
    return `urn:uuid:${now}-${random}`;
  }
}
