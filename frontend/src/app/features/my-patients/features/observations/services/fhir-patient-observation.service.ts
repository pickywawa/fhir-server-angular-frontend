import { Injectable } from '@angular/core';
import { HttpHeaders, HttpParams } from '@angular/common/http';
import { Observable, map } from 'rxjs';
import { ApiService } from '../../../../../core/services/api.service';
import {
  ObservationSummary,
  ObservationDetail,
  ObservationSaveInput,
  ObservationValueType,
  OBSERVATION_CATEGORIES
} from '../models/patient-observation.model';

@Injectable({ providedIn: 'root' })
export class FhirPatientObservationService {
  private readonly endpoint = '/Observation';

  private readonly fhirHeaders = new HttpHeaders({
    'Content-Type': 'application/fhir+json',
    Accept: 'application/fhir+json'
  });

  constructor(private readonly apiService: ApiService) {}

  searchObservationsByPatient(patientId: string): Observable<ObservationSummary[]> {
    const params = new HttpParams()
      .set('subject', `Patient/${patientId}`)
      .set('_count', '100')
      .set('_sort', '-date');

    return this.apiService.get<any>(this.endpoint, { params }).pipe(
      map((bundle) => {
        const entries = Array.isArray(bundle?.entry) ? bundle.entry : [];
        return entries
          .map((e: any) => this.convertToSummary(e?.resource))
          .filter((o: ObservationSummary | null): o is ObservationSummary => !!o);
      })
    );
  }

  getObservation(id: string): Observable<ObservationDetail> {
    return this.apiService.get<any>(`${this.endpoint}/${id}`).pipe(
      map((resource) => this.convertToDetail(resource))
    );
  }

  createObservation(input: ObservationSaveInput): Observable<ObservationDetail> {
    const payload = this.buildPayload(input);
    return this.apiService.post<any>(this.endpoint, payload, { headers: this.fhirHeaders }).pipe(
      map((resource) => this.convertToDetail(resource))
    );
  }

  updateObservation(id: string, input: ObservationSaveInput): Observable<ObservationDetail> {
    const payload = { ...this.buildPayload(input), id };
    return this.apiService.put<any>(`${this.endpoint}/${id}`, payload, { headers: this.fhirHeaders }).pipe(
      map((resource) => this.convertToDetail(resource))
    );
  }

  private buildPayload(input: ObservationSaveInput): any {
    const categoryEntry = OBSERVATION_CATEGORIES.find((c) => c.code === input.categoryCode);

    const payload: any = {
      resourceType: 'Observation',
      status: 'final',
      category: [
        {
          coding: [
            {
              system: categoryEntry?.system ?? 'http://terminology.hl7.org/CodeSystem/observation-category',
              code: input.categoryCode,
              display: categoryEntry?.display ?? input.categoryCode
            }
          ]
        }
      ],
      code: {
        coding: [
          {
            system: input.codeSystem || 'http://loinc.org',
            code: input.codeCode,
            display: input.codeDisplay
          }
        ],
        text: input.codeDisplay
      },
      subject: { reference: input.patientReference }
    };

    if (input.effectiveDateTime) {
      // datetime-local gives "YYYY-MM-DDTHH:MM" — FHIR requires at least seconds
      const dt = input.effectiveDateTime;
      payload['effectiveDateTime'] = dt.length === 16 ? `${dt}:00` : dt;
    }

    switch (input.valueType) {
      case 'string':
        if (input.valueString !== undefined) {
          payload['valueString'] = input.valueString;
        }
        break;
      case 'boolean':
        if (input.valueBoolean !== undefined) {
          payload['valueBoolean'] = input.valueBoolean;
        }
        break;
      case 'integer':
        if (input.valueInteger !== undefined) {
          payload['valueInteger'] = input.valueInteger;
        }
        break;
      case 'date':
        if (input.valueDate) {
          payload['valueDateTime'] = input.valueDate;
        }
        break;
    }

    if (input.interpretationCode) {
      payload['interpretation'] = [
        {
          coding: [
            {
              system: 'http://terminology.hl7.org/CodeSystem/v3-ObservationInterpretation',
              code: input.interpretationCode
            }
          ]
        }
      ];
    }

    if (input.note?.trim()) {
      payload['note'] = [{ text: input.note.trim() }];
    }

    if (input.performerReference) {
      payload['performer'] = [
        {
          reference: input.performerReference,
          display: input.performerDisplay
        }
      ];
    }

    return payload;
  }

  private convertToSummary(resource: any): ObservationSummary | null {
    if (!resource?.resourceType || resource.resourceType !== 'Observation') {
      return null;
    }
    const base = this.extractBase(resource);
    return base;
  }

  private convertToDetail(resource: any): ObservationDetail {
    const base = this.extractBase(resource);
    return {
      ...base,
      note: resource?.note?.[0]?.text,
      subjectReference: resource?.subject?.reference
    };
  }

  private extractBase(resource: any): ObservationSummary {
    const categoryCoding = resource?.category?.[0]?.coding?.[0];
    const codeCoding = resource?.code?.coding?.[0];

    const valueType = this.detectValueType(resource);
    const valueString = typeof resource?.valueString === 'string' ? resource.valueString : undefined;
    const valueBoolean = typeof resource?.valueBoolean === 'boolean' ? resource.valueBoolean : undefined;
    const valueInteger = typeof resource?.valueInteger === 'number' ? resource.valueInteger : undefined;
    const valueDate = typeof resource?.valueDateTime === 'string' ? resource.valueDateTime : undefined;

    const performerRef = resource?.performer?.[0];
    const performerDisplay = performerRef?.display
      || performerRef?.reference
      || undefined;

    const interpretationCoding = resource?.interpretation?.[0]?.coding?.[0];

    return {
      id: resource?.id ?? '',
      status: resource?.status ?? 'final',
      categoryCode: categoryCoding?.code ?? '',
      categoryDisplay: categoryCoding?.display ?? categoryCoding?.code ?? '',
      codeSystem: codeCoding?.system ?? '',
      codeCode: codeCoding?.code ?? '',
      codeDisplay: codeCoding?.display ?? resource?.code?.text ?? '',
      valueType,
      valueString,
      valueBoolean,
      valueInteger,
      valueDate,
      effectiveDateTime: resource?.effectiveDateTime,
      performerDisplay,
      interpretationCode: interpretationCoding?.code
    };
  }

  private detectValueType(resource: any): ObservationValueType | null {
    if (typeof resource?.valueString === 'string') return 'string';
    if (typeof resource?.valueBoolean === 'boolean') return 'boolean';
    if (typeof resource?.valueInteger === 'number') return 'integer';
    if (typeof resource?.valueDateTime === 'string') return 'date';
    return null;
  }
}
