import { Injectable } from '@angular/core';
import { HttpHeaders, HttpParams } from '@angular/common/http';
import { Observable, catchError, forkJoin, map, of } from 'rxjs';
import { ApiService } from '../../../../../core/services/api.service';
import { QuestionnaireItem } from '../../../../questionnaires/models/questionnaire.model';
import {
  QuestionnaireAnswerMap,
  QuestionnaireResponseDetail,
  QuestionnaireResponsePayload,
  QuestionnaireResponseSummary
} from '../models/patient-questionnaire.model';

@Injectable({ providedIn: 'root' })
export class FhirPatientQuestionnaireService {
  private readonly endpoint = '/QuestionnaireResponse';
  private readonly fhirHeaders = new HttpHeaders({
    'Content-Type': 'application/fhir+json',
    Accept: 'application/fhir+json'
  });

  constructor(private readonly apiService: ApiService) {}

  searchResponsesByPatient(patientId: string): Observable<QuestionnaireResponseSummary[]> {
    const baseParams = new HttpParams()
      .set('_sort', '-_lastUpdated')
      .set('_count', '100');

    const byPatient$ = this.apiService.get<any>(this.endpoint, {
      params: baseParams.set('patient', patientId)
    }).pipe(
      map((bundle) => this.convertBundleToSummaries(bundle)),
      catchError(() => of([] as QuestionnaireResponseSummary[]))
    );

    const bySubject$ = this.apiService.get<any>(this.endpoint, {
      params: baseParams.set('subject', `Patient/${patientId}`)
    }).pipe(
      map((bundle) => this.convertBundleToSummaries(bundle)),
      catchError(() => of([] as QuestionnaireResponseSummary[]))
    );

    const byScan$ = this.apiService.get<any>(this.endpoint, {
      params: baseParams.set('_count', '200')
    }).pipe(
      map((bundle) => this.convertBundleToSummaries(bundle)),
      map((items) => items.filter((item) => this.belongsToPatient(item, patientId))),
      catchError(() => of([] as QuestionnaireResponseSummary[]))
    );

    return forkJoin([byPatient$, bySubject$, byScan$]).pipe(
      map(([byPatient, bySubject, byScan]) => this.mergeSummaries(byPatient, bySubject, byScan))
    );
  }

  getResponse(responseId: string): Observable<QuestionnaireResponseDetail> {
    return this.apiService.get<any>(`${this.endpoint}/${responseId}`).pipe(
      map((resource) => this.convertToDetail(resource))
    );
  }

  createResponse(payload: QuestionnaireResponsePayload): Observable<QuestionnaireResponseDetail> {
    const resource = this.buildResponseResource(payload);
    return this.apiService.post<any>(this.endpoint, resource, { headers: this.fhirHeaders }).pipe(
      map((created) => this.convertToDetail(created))
    );
  }

  updateResponse(responseId: string, payload: QuestionnaireResponsePayload): Observable<QuestionnaireResponseDetail> {
    const resource = this.buildResponseResource(payload);
    resource.id = responseId;
    return this.apiService.put<any>(`${this.endpoint}/${responseId}`, resource, { headers: this.fhirHeaders }).pipe(
      map((updated) => this.convertToDetail(updated))
    );
  }

  extractAnswerMap(response: QuestionnaireResponseDetail): QuestionnaireAnswerMap {
    const answers: QuestionnaireAnswerMap = {};

    const walk = (items: any[]): void => {
      for (const item of items || []) {
        const linkId = String(item?.linkId || '');
        if (linkId && Array.isArray(item?.answer) && item.answer.length > 0) {
          const parsedValues = item.answer
            .map((answer: any) => this.parseFhirAnswerValue(answer))
            .filter((value: unknown) => value !== undefined);

          if (parsedValues.length === 1) {
            answers[linkId] = parsedValues[0] as string | number | boolean;
          } else if (parsedValues.length > 1) {
            answers[linkId] = parsedValues.map((value: string | number | boolean) => String(value));
          }
        }

        if (Array.isArray(item?.item) && item.item.length > 0) {
          walk(item.item);
        }
      }
    };

    walk(response.item || []);
    return answers;
  }

  private buildResponseResource(payload: QuestionnaireResponsePayload): any {
    return {
      resourceType: 'QuestionnaireResponse',
      status: payload.status,
      questionnaire: `Questionnaire/${payload.questionnaireId}`,
      subject: { reference: `Patient/${payload.patientId}` },
      authored: new Date().toISOString(),
      item: this.buildResponseItems(payload.questionnaireItems, payload.answers)
    };
  }

  private buildResponseItems(items: QuestionnaireItem[], answers: QuestionnaireAnswerMap): any[] {
    return items
      .map((item) => this.buildResponseItem(item, answers))
      .filter((built): built is any => !!built);
  }

  private buildResponseItem(item: QuestionnaireItem, answers: QuestionnaireAnswerMap): any | null {
    const childItems = this.buildResponseItems(item.items, answers);
    const hasAnswer = Object.prototype.hasOwnProperty.call(answers, item.linkId);
    const rawAnswer = hasAnswer ? answers[item.linkId] : undefined;
    const answer = hasAnswer ? this.buildAnswerArray(item, rawAnswer) : [];

    if (!answer.length && !childItems.length) {
      return null;
    }

    const responseItem: any = { linkId: item.linkId };
    if (answer.length > 0) {
      responseItem.answer = answer;
    }
    if (childItems.length > 0) {
      responseItem.item = childItems;
    }

    return responseItem;
  }

  private buildAnswerArray(item: QuestionnaireItem, value: unknown): any[] {
    if (value === undefined || value === null || value === '') {
      return [];
    }

    if (item.type === 'choice' && item.repeats && Array.isArray(value)) {
      return value
        .map((entry) => String(entry).trim())
        .filter((entry) => entry.length > 0)
        .map((entry) => ({ valueString: entry }));
    }

    const fhirValue = this.toFhirValue(item, value);
    return fhirValue ? [fhirValue] : [];
  }

  private toFhirValue(item: QuestionnaireItem, value: unknown): any | null {
    switch (item.type) {
      case 'boolean':
        return { valueBoolean: Boolean(value) };
      case 'integer': {
        const parsed = Number(value);
        return Number.isFinite(parsed) ? { valueInteger: Math.trunc(parsed) } : null;
      }
      case 'quantity': {
        const parsed = Number(value);
        return Number.isFinite(parsed) ? { valueQuantity: { value: parsed } } : null;
      }
      case 'date': {
        const date = String(value).trim();
        return date ? { valueDate: date } : null;
      }
      case 'choice': {
        const selected = String(value).trim();
        return selected ? { valueString: selected } : null;
      }
      default: {
        const text = String(value).trim();
        return text ? { valueString: text } : null;
      }
    }
  }

  private convertBundleToSummaries(bundle: any): QuestionnaireResponseSummary[] {
    if (!bundle?.entry) {
      return [];
    }

    return bundle.entry
      .map((entry: any) => this.convertToSummary(entry?.resource))
      .filter((item: QuestionnaireResponseSummary | null): item is QuestionnaireResponseSummary => !!item);
  }

  private convertToSummary(resource: any): QuestionnaireResponseSummary | null {
    if (!resource?.id) {
      return null;
    }

    const questionnaireReference = String(resource?.questionnaire || '');
    return {
      id: String(resource.id),
      status: String(resource?.status || 'in-progress'),
      questionnaireReference,
      questionnaireId: this.extractIdFromReference(questionnaireReference),
      subjectReference: String(resource?.subject?.reference || ''),
      authored: resource?.authored
    };
  }

  private convertToDetail(resource: any): QuestionnaireResponseDetail {
    const questionnaireReference = String(resource?.questionnaire || '');
    return {
      id: String(resource?.id || ''),
      status: String(resource?.status || 'in-progress'),
      questionnaireReference,
      questionnaireId: this.extractIdFromReference(questionnaireReference),
      subjectReference: String(resource?.subject?.reference || ''),
      authored: resource?.authored,
      item: resource?.item || []
    };
  }

  private mergeSummaries(...groups: QuestionnaireResponseSummary[][]): QuestionnaireResponseSummary[] {
    const byId = new Map<string, QuestionnaireResponseSummary>();

    groups.flat().forEach((item) => {
      if (!item.id) {
        return;
      }
      byId.set(item.id, item);
    });

    return Array.from(byId.values()).sort((a, b) => {
      const aTime = a.authored ? new Date(a.authored).getTime() : 0;
      const bTime = b.authored ? new Date(b.authored).getTime() : 0;
      return bTime - aTime;
    });
  }

  private belongsToPatient(item: QuestionnaireResponseSummary, patientId: string): boolean {
    const ref = String(item.subjectReference || '').trim();
    if (!ref) {
      return false;
    }
    return ref === `Patient/${patientId}` || ref.endsWith(`/Patient/${patientId}`);
  }

  private extractIdFromReference(reference: string): string {
    const trimmed = reference.trim();
    if (!trimmed) {
      return '';
    }
    if (trimmed.includes('/')) {
      return trimmed.split('/').pop() || '';
    }
    return trimmed;
  }

  private parseFhirAnswerValue(answer: any): string | number | boolean | undefined {
    if (answer?.valueBoolean !== undefined) {
      return Boolean(answer.valueBoolean);
    }
    if (answer?.valueInteger !== undefined) {
      return Number(answer.valueInteger);
    }
    if (answer?.valueDecimal !== undefined) {
      return Number(answer.valueDecimal);
    }
    if (answer?.valueQuantity?.value !== undefined) {
      return Number(answer.valueQuantity.value);
    }
    if (answer?.valueDate !== undefined) {
      return String(answer.valueDate);
    }
    if (answer?.valueDateTime !== undefined) {
      return String(answer.valueDateTime);
    }
    if (answer?.valueTime !== undefined) {
      return String(answer.valueTime);
    }
    if (answer?.valueCoding?.display !== undefined) {
      return String(answer.valueCoding.display);
    }
    if (answer?.valueCoding?.code !== undefined) {
      return String(answer.valueCoding.code);
    }
    if (answer?.valueString !== undefined) {
      return String(answer.valueString);
    }
    return undefined;
  }
}
