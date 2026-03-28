import { Injectable } from '@angular/core';
import { HttpHeaders, HttpParams } from '@angular/common/http';
import { Observable, map } from 'rxjs';
import { ApiService } from '../../../core/services/api.service';
import {
  QuestionnaireEnableWhen,
  QuestionnaireItem,
  QuestionnaireProfile,
  QuestionnaireSearchCriteria,
  QuestionnaireSummary
} from '../models/questionnaire.model';

@Injectable({
  providedIn: 'root'
})
export class FhirQuestionnaireService {
  private readonly endpoint = '/Questionnaire';
  private readonly fhirHeaders = new HttpHeaders({
    'Content-Type': 'application/fhir+json',
    Accept: 'application/fhir+json'
  });

  constructor(private readonly apiService: ApiService) {}

  searchQuestionnaires(criteria: QuestionnaireSearchCriteria): Observable<QuestionnaireSummary[]> {
    let params = new HttpParams().set('_count', String(criteria.limit ?? 50));

    if (criteria.title?.trim()) {
      params = params.set('title:contains', criteria.title.trim());
    }

    if (criteria.status?.trim()) {
      params = params.set('status', criteria.status.trim());
    }

    return this.apiService.get<any>(this.endpoint, { params }).pipe(
      map((bundle) => this.convertBundleToSummaries(bundle))
    );
  }

  getQuestionnaire(id: string): Observable<QuestionnaireProfile> {
    return this.apiService.get<any>(`${this.endpoint}/${id}`).pipe(
      map((resource) => this.convertFhirToProfile(resource))
    );
  }

  createQuestionnaire(questionnaire: QuestionnaireProfile): Observable<QuestionnaireProfile> {
    const payload = this.convertProfileToFhir(questionnaire);
    return this.apiService.post<any>(this.endpoint, payload, { headers: this.fhirHeaders }).pipe(
      map((resource) => this.convertFhirToProfile(resource))
    );
  }

  updateQuestionnaire(id: string, questionnaire: QuestionnaireProfile): Observable<QuestionnaireProfile> {
    const payload = this.convertProfileToFhir(questionnaire);
    payload.id = id;
    return this.apiService.put<any>(`${this.endpoint}/${id}`, payload, { headers: this.fhirHeaders }).pipe(
      map((resource) => this.convertFhirToProfile(resource))
    );
  }

  private convertBundleToSummaries(bundle: any): QuestionnaireSummary[] {
    if (!bundle?.entry) {
      return [];
    }

    return bundle.entry
      .map((entry: any) => this.convertFhirToSummary(entry?.resource))
      .filter((item: QuestionnaireSummary | null): item is QuestionnaireSummary => !!item);
  }

  private convertFhirToSummary(resource: any): QuestionnaireSummary | null {
    if (!resource?.id) {
      return null;
    }

    return {
      id: String(resource.id),
      title: String(resource.title || resource.name || resource.id),
      description: String(resource.description || ''),
      status: (resource.status || 'draft') as QuestionnaireSummary['status'],
      itemCount: this.countItems(resource.item || []),
      date: resource.date
    };
  }

  private convertFhirToProfile(resource: any): QuestionnaireProfile {
    return {
      id: resource?.id,
      title: String(resource?.title || ''),
      description: String(resource?.description || ''),
      status: (resource?.status || 'draft') as QuestionnaireProfile['status'],
      items: this.convertFhirItems(resource?.item || []),
      date: resource?.date
    };
  }

  private convertFhirItems(items: any[]): QuestionnaireItem[] {
    return (items || []).map((item) => {
      const enableWhen: QuestionnaireEnableWhen[] = (item?.enableWhen || []).map((condition: any) => ({
        uid: this.createUid('ew'),
        questionLinkId: String(condition.question || ''),
        operator: condition.operator || '=',
        answer: this.extractEnableWhenAnswer(condition)
      }));

      const answerOptions = (item?.answerOption || [])
        .map((option: any) => this.extractAnswerOption(option))
        .filter((value: string) => value.trim().length > 0);

      return {
        uid: this.createUid('item'),
        linkId: String(item?.linkId || this.createUid('link')),
        text: String(item?.text || ''),
        type: item?.type || 'string',
        required: Boolean(item?.required),
        repeats: Boolean(item?.repeats),
        answerOptions,
        enableWhen,
        items: this.convertFhirItems(item?.item || [])
      } as QuestionnaireItem;
    });
  }

  private convertProfileToFhir(profile: QuestionnaireProfile): any {
    return {
      resourceType: 'Questionnaire',
      status: profile.status,
      title: profile.title.trim(),
      description: profile.description.trim(),
      date: new Date().toISOString(),
      item: this.convertItemsToFhir(profile.items)
    };
  }

  private convertItemsToFhir(items: QuestionnaireItem[]): any[] {
    return items.map((item) => {
      const fhirItem: any = {
        linkId: item.linkId,
        text: item.text,
        type: item.type,
        required: item.required,
        repeats: item.repeats
      };

      if (item.enableWhen.length > 0) {
        fhirItem.enableWhen = item.enableWhen
          .filter((condition) => condition.questionLinkId.trim().length > 0)
          .map((condition) => this.convertEnableWhenToFhir(condition));
      }

      if (item.type === 'choice' && item.answerOptions.length > 0) {
        fhirItem.answerOption = item.answerOptions
          .map((value) => value.trim())
          .filter(Boolean)
          .map((value) => ({ valueString: value }));
      }

      if (item.type === 'group' && item.items.length > 0) {
        fhirItem.item = this.convertItemsToFhir(item.items);
      }

      return fhirItem;
    });
  }

  private convertEnableWhenToFhir(condition: QuestionnaireEnableWhen): any {
    const base = {
      question: condition.questionLinkId.trim(),
      operator: condition.operator
    } as any;

    const answerValue = condition.answer?.trim();
    if (!answerValue) {
      return base;
    }

    if (condition.operator === 'exists') {
      base.answerBoolean = answerValue === 'true';
      return base;
    }

    if (/^-?\d+$/.test(answerValue)) {
      base.answerInteger = Number(answerValue);
      return base;
    }

    if (/^-?\d+(\.\d+)?$/.test(answerValue)) {
      base.answerDecimal = Number(answerValue);
      return base;
    }

    if (/^\d{4}-\d{2}-\d{2}$/.test(answerValue)) {
      base.answerDate = answerValue;
      return base;
    }

    base.answerString = answerValue;
    return base;
  }

  private extractEnableWhenAnswer(condition: any): string {
    const answerKeys = [
      'answerString',
      'answerBoolean',
      'answerInteger',
      'answerDecimal',
      'answerDate',
      'answerDateTime',
      'answerTime',
      'answerCoding'
    ];

    for (const key of answerKeys) {
      if (condition?.[key] !== undefined && condition?.[key] !== null) {
        if (key === 'answerCoding') {
          const coding = condition[key];
          return String(coding?.display || coding?.code || '');
        }
        return String(condition[key]);
      }
    }

    return '';
  }

  private extractAnswerOption(option: any): string {
    const keys = [
      'valueString',
      'valueCoding',
      'valueInteger',
      'valueDate',
      'valueTime'
    ];

    for (const key of keys) {
      if (option?.[key] !== undefined && option?.[key] !== null) {
        if (key === 'valueCoding') {
          return String(option[key]?.display || option[key]?.code || '');
        }
        return String(option[key]);
      }
    }

    return '';
  }

  private countItems(items: any[]): number {
    return (items || []).reduce((count, item) => {
      const childCount = this.countItems(item?.item || []);
      return count + 1 + childCount;
    }, 0);
  }

  private createUid(prefix: string): string {
    return `${prefix}-${Math.random().toString(36).slice(2, 10)}`;
  }
}
