import { Injectable } from '@angular/core';
import { HttpHeaders, HttpParams } from '@angular/common/http';
import { map, Observable, of } from 'rxjs';
import { catchError } from 'rxjs/operators';
import { ApiService } from '../../../core/services/api.service';
import {
  CarePlanStep,
  CarePlanStepType,
  CareActionDetail,
  CareActionSummary,
  CareActionUpsertPayload,
  CareGoalDetail,
  CareGoalSummary,
  CareGoalUpsertPayload,
  CarePlanDetail,
  CarePlanSummary,
  CarePlanUpsertPayload,
  LinkedReferenceOption
} from '../models/care-plan-admin.model';

@Injectable({ providedIn: 'root' })
export class FhirCarePlansAdminService {
  private readonly planDefinitionEndpoint = '/PlanDefinition';
  private readonly goalEndpoint = '/Goal';
  private readonly taskEndpoint = '/Task';
  private readonly questionnaireEndpoint = '/Questionnaire';
  private readonly activityDefinitionEndpoint = '/ActivityDefinition';

  private readonly fhirHeaders = new HttpHeaders({
    'Content-Type': 'application/fhir+json',
    Accept: 'application/fhir+json'
  });

  private readonly planGoalRefExtensionUrl = 'https://health-fhir.fr/StructureDefinition/plandefinition-goal-reference';
  private readonly planActionTypeExtensionUrl = 'https://health-fhir.fr/StructureDefinition/plandefinition-action-type';
  private readonly planActionCommunicationMessageExtensionUrl = 'https://health-fhir.fr/StructureDefinition/plandefinition-action-communication-message';

  private readonly actionTitleExtensionUrl = 'https://health-fhir.fr/StructureDefinition/careplan-action-title';
  private readonly actionRelatedExtensionUrl = 'https://health-fhir.fr/StructureDefinition/careplan-action-related';
  private readonly actionTimingExtensionUrl = 'https://health-fhir.fr/StructureDefinition/careplan-action-timing';
  private readonly actionParticipantTypeExtensionUrl = 'https://health-fhir.fr/StructureDefinition/careplan-action-participant-type';
  private readonly actionParticipantRoleExtensionUrl = 'https://health-fhir.fr/StructureDefinition/careplan-action-participant-role';
  private readonly actionConditionExtensionUrl = 'https://health-fhir.fr/StructureDefinition/careplan-action-condition';
  private readonly actionDefinitionExtensionUrl = 'https://health-fhir.fr/StructureDefinition/careplan-action-definition';
  private readonly actionGoalRefExtensionUrl = 'https://health-fhir.fr/StructureDefinition/careplan-action-goal-reference';
  private readonly actionRequiredExtensionUrl = 'https://health-fhir.fr/StructureDefinition/careplan-action-required';

  constructor(private readonly apiService: ApiService) {}

  listPlans(limit = 200): Observable<CarePlanSummary[]> {
    const params = new HttpParams().set('_count', String(limit));
    return this.apiService.get<any>(this.planDefinitionEndpoint, { params }).pipe(
      map((bundle) => {
        const entries = Array.isArray(bundle?.entry) ? bundle.entry : [];
        return entries
          .map((entry: any) => this.convertPlanDefinition(entry?.resource))
          .filter((item: CarePlanSummary | null): item is CarePlanSummary => !!item)
          .sort((a: CarePlanSummary, b: CarePlanSummary) => this.sortByDateDesc(a.lastUpdated, b.lastUpdated));
      })
    );
  }

  getPlan(id: string): Observable<CarePlanDetail> {
    return this.apiService.get<any>(`${this.planDefinitionEndpoint}/${id}`).pipe(
      map((resource) => {
        const converted = this.convertPlanDefinition(resource);
        if (!converted) {
          throw new Error('Invalid PlanDefinition resource');
        }
        return converted;
      })
    );
  }

  createPlan(payload: CarePlanUpsertPayload): Observable<CarePlanDetail> {
    const resource = this.convertPlanPayloadToResource(payload);
    return this.apiService.post<any>(this.planDefinitionEndpoint, resource, { headers: this.fhirHeaders }).pipe(
      map((saved) => {
        const converted = this.convertPlanDefinition(saved);
        if (!converted) {
          throw new Error('Invalid PlanDefinition response');
        }
        return converted;
      })
    );
  }

  updatePlan(id: string, payload: CarePlanUpsertPayload): Observable<CarePlanDetail> {
    const resource = {
      ...this.convertPlanPayloadToResource(payload),
      id
    };

    return this.apiService.put<any>(`${this.planDefinitionEndpoint}/${id}`, resource, { headers: this.fhirHeaders }).pipe(
      map((saved) => {
        const converted = this.convertPlanDefinition(saved);
        if (!converted) {
          throw new Error('Invalid PlanDefinition response');
        }
        return converted;
      })
    );
  }

  listGoals(limit = 200): Observable<CareGoalSummary[]> {
    const params = new HttpParams().set('_count', String(limit));
    return this.apiService.get<any>(this.goalEndpoint, { params }).pipe(
      map((bundle) => {
        const entries = Array.isArray(bundle?.entry) ? bundle.entry : [];
        return entries
          .map((entry: any) => this.convertGoal(entry?.resource))
          .filter((item: CareGoalSummary | null): item is CareGoalSummary => !!item)
          .sort((a: CareGoalSummary, b: CareGoalSummary) => this.sortByDateDesc(a.lastUpdated, b.lastUpdated));
      })
    );
  }

  getGoal(id: string): Observable<CareGoalDetail> {
    return this.apiService.get<any>(`${this.goalEndpoint}/${id}`).pipe(
      map((resource) => {
        const converted = this.convertGoal(resource);
        if (!converted) {
          throw new Error('Invalid Goal resource');
        }
        return converted;
      })
    );
  }

  createGoal(payload: CareGoalUpsertPayload): Observable<CareGoalDetail> {
    const resource = this.convertGoalPayloadToResource(payload);
    return this.apiService.post<any>(this.goalEndpoint, resource, { headers: this.fhirHeaders }).pipe(
      map((saved) => {
        const converted = this.convertGoal(saved);
        if (!converted) {
          throw new Error('Invalid Goal response');
        }
        return converted;
      })
    );
  }

  updateGoal(id: string, payload: CareGoalUpsertPayload): Observable<CareGoalDetail> {
    const resource = {
      ...this.convertGoalPayloadToResource(payload),
      id
    };

    return this.apiService.put<any>(`${this.goalEndpoint}/${id}`, resource, { headers: this.fhirHeaders }).pipe(
      map((saved) => {
        const converted = this.convertGoal(saved);
        if (!converted) {
          throw new Error('Invalid Goal response');
        }
        return converted;
      })
    );
  }

  listActions(limit = 200): Observable<CareActionSummary[]> {
    const params = new HttpParams().set('_count', String(limit));
    return this.apiService.get<any>(this.taskEndpoint, { params }).pipe(
      map((bundle) => {
        const entries = Array.isArray(bundle?.entry) ? bundle.entry : [];
        return entries
          .map((entry: any) => this.convertTask(entry?.resource))
          .filter((item: CareActionSummary | null): item is CareActionSummary => !!item)
          .sort((a: CareActionSummary, b: CareActionSummary) => this.sortByDateDesc(a.lastUpdated, b.lastUpdated));
      })
    );
  }

  getAction(id: string): Observable<CareActionDetail> {
    return this.apiService.get<any>(`${this.taskEndpoint}/${id}`).pipe(
      map((resource) => {
        const converted = this.convertTask(resource);
        if (!converted) {
          throw new Error('Invalid Task resource');
        }
        return converted;
      })
    );
  }

  createAction(payload: CareActionUpsertPayload): Observable<CareActionDetail> {
    const resource = this.convertActionPayloadToResource(payload);
    return this.apiService.post<any>(this.taskEndpoint, resource, { headers: this.fhirHeaders }).pipe(
      map((saved) => {
        const converted = this.convertTask(saved);
        if (!converted) {
          throw new Error('Invalid Task response');
        }
        return converted;
      })
    );
  }

  updateAction(id: string, payload: CareActionUpsertPayload): Observable<CareActionDetail> {
    const resource = {
      ...this.convertActionPayloadToResource(payload),
      id
    };

    return this.apiService.put<any>(`${this.taskEndpoint}/${id}`, resource, { headers: this.fhirHeaders }).pipe(
      map((saved) => {
        const converted = this.convertTask(saved);
        if (!converted) {
          throw new Error('Invalid Task response');
        }
        return converted;
      })
    );
  }

  getGoalOptions(limit = 400): Observable<LinkedReferenceOption[]> {
    return this.listGoals(limit).pipe(
      map((goals) => goals.map((goal) => ({
        id: goal.id,
        reference: `Goal/${goal.id}`,
        label: goal.title || `Goal ${goal.id}`
      }))),
      catchError(() => of([]))
    );
  }

  getActionOptions(limit = 400): Observable<LinkedReferenceOption[]> {
    return this.listActions(limit).pipe(
      map((actions) => actions.map((action) => ({
        id: action.id,
        reference: `Task/${action.id}`,
        label: action.title || `Task ${action.id}`
      }))),
      catchError(() => of([]))
    );
  }

  getQuestionnaireOptions(limit = 200): Observable<LinkedReferenceOption[]> {
    const params = new HttpParams().set('_count', String(limit));
    return this.apiService.get<any>(this.questionnaireEndpoint, { params }).pipe(
      map((bundle) => {
        const entries = Array.isArray(bundle?.entry) ? bundle.entry : [];
        return entries
          .map((entry: any) => entry?.resource)
          .filter((resource: any) => !!resource?.id)
          .map((resource: any) => ({
            id: String(resource.id).trim(),
            reference: `Questionnaire/${String(resource.id).trim()}`,
            label: String(resource?.title || resource?.name || `Questionnaire ${resource.id}`).trim()
          }));
      }),
      catchError(() => of([]))
    );
  }

  getActivityDefinitionOptions(limit = 200): Observable<LinkedReferenceOption[]> {
    const params = new HttpParams().set('_count', String(limit));
    return this.apiService.get<any>(this.activityDefinitionEndpoint, { params }).pipe(
      map((bundle) => {
        const entries = Array.isArray(bundle?.entry) ? bundle.entry : [];
        return entries
          .map((entry: any) => entry?.resource)
          .filter((resource: any) => !!resource?.id)
          .map((resource: any) => ({
            id: String(resource.id).trim(),
            reference: `ActivityDefinition/${String(resource.id).trim()}`,
            label: String(resource?.title || resource?.name || `ActivityDefinition ${resource.id}`).trim()
          }));
      }),
      catchError(() => of([]))
    );
  }

  private convertPlanDefinition(resource: any): CarePlanDetail | null {
    const id = String(resource?.id || '').trim();
    if (!id) {
      return null;
    }

    const goalRefsFromExtension = this.collectReferenceExtensions(resource, this.planGoalRefExtensionUrl);
    const goalRefsFromLegacyField = this.collectReferences(resource?.goal);
    const steps = this.convertPlanDefinitionActions(resource);
    const actionRefs = steps
      .filter((step) => step.type === 'task' && step.taskRef)
      .map((step) => this.normalizeReference(step.taskRef, 'Task'))
      .filter((value) => value.length > 0);

    return {
      id,
      title: String(resource?.title || resource?.name || '').trim(),
      description: String(resource?.description || '').trim(),
      status: String(resource?.status || 'draft').trim(),
      version: String(resource?.version || '').trim(),
      goalRefs: goalRefsFromExtension.length > 0 ? goalRefsFromExtension : goalRefsFromLegacyField,
      actionRefs: Array.from(new Set(actionRefs)),
      steps,
      lastUpdated: String(resource?.meta?.lastUpdated || '').trim()
    };
  }

  private convertPlanDefinitionActions(resource: any): CarePlanStep[] {
    const actions = Array.isArray(resource?.action) ? resource.action : [];

    return actions.map((action: any, index: number) => {
      const definitionCanonical = String(action?.definitionCanonical || '').trim();
      const explicitType = this.findStringExtension(action, this.planActionTypeExtensionUrl) as CarePlanStepType;
      const inferredType = this.inferStepType(explicitType, definitionCanonical);

      return {
        uid: `step-${index}-${Math.random().toString(36).slice(2, 8)}`,
        title: String(action?.title || '').trim(),
        description: String(action?.description || '').trim(),
        priority: String(action?.priority || 'routine').trim(),
        type: inferredType,
        questionnaireRef: inferredType === 'questionnaire' ? definitionCanonical : '',
        activityDefinitionRef: inferredType === 'appointment' ? definitionCanonical : '',
        communicationMessage: this.findStringExtension(action, this.planActionCommunicationMessageExtensionUrl),
        taskRef: inferredType === 'task' ? definitionCanonical : ''
      };
    });
  }

  private convertGoal(resource: any): CareGoalDetail | null {
    const id = String(resource?.id || '').trim();
    if (!id) {
      return null;
    }

    return {
      id,
      title: String(resource?.description?.text || '').trim(),
      description: String(resource?.note?.[0]?.text || '').trim(),
      lifecycleStatus: String(resource?.lifecycleStatus || 'proposed').trim(),
      achievementStatus: String(resource?.achievementStatus?.coding?.[0]?.code || '').trim(),
      priority: String(resource?.priority?.coding?.[0]?.code || '').trim(),
      dueDate: String(resource?.target?.[0]?.dueDate || '').trim(),
      lastUpdated: String(resource?.meta?.lastUpdated || '').trim()
    };
  }

  private convertTask(resource: any): CareActionDetail | null {
    const id = String(resource?.id || '').trim();
    if (!id) {
      return null;
    }

    const title = this.findStringExtension(resource, this.actionTitleExtensionUrl)
      || String(resource?.code?.text || '').trim()
      || String(resource?.description || '').trim();

    return {
      id,
      title,
      description: String(resource?.description || '').trim(),
      code: String(resource?.code?.coding?.[0]?.code || '').trim(),
      status: String(resource?.status || 'draft').trim(),
      priority: String(resource?.priority || 'routine').trim(),
      required: this.findBooleanExtension(resource, this.actionRequiredExtensionUrl, false),
      goalRefs: this.collectReferenceExtensions(resource, this.actionGoalRefExtensionUrl),
      relatedActionRefs: this.collectReferenceExtensions(resource, this.actionRelatedExtensionUrl),
      definition: this.findStringExtension(resource, this.actionDefinitionExtensionUrl),
      timing: this.findStringExtension(resource, this.actionTimingExtensionUrl),
      participantType: this.findStringExtension(resource, this.actionParticipantTypeExtensionUrl),
      participantRole: this.findStringExtension(resource, this.actionParticipantRoleExtensionUrl),
      requestedPeriodStart: String(resource?.restriction?.period?.start || '').trim(),
      requestedPeriodEnd: String(resource?.restriction?.period?.end || '').trim(),
      conditions: this.collectStringExtensions(resource, this.actionConditionExtensionUrl),
      lastUpdated: String(resource?.meta?.lastUpdated || '').trim()
    };
  }

  private convertPlanPayloadToResource(payload: CarePlanUpsertPayload): any {
    const extension: any[] = [];

    for (const goalRef of payload.goalRefs) {
      const normalized = this.normalizeReference(goalRef, 'Goal');
      if (!normalized) {
        continue;
      }
      extension.push({
        url: this.planGoalRefExtensionUrl,
        valueReference: { reference: normalized }
      });
    }

    const trimmedTitle = payload.title.trim();
    const normalizedName = trimmedTitle
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '') || 'plan-definition';

    return {
      resourceType: 'PlanDefinition',
      status: payload.status || 'draft',
      title: trimmedTitle,
      name: normalizedName,
      version: payload.version.trim() || undefined,
      description: payload.description.trim() || undefined,
      action: this.convertPlanStepsToFhirActions(payload.steps),
      extension: extension.length ? extension : undefined
    };
  }

  private convertPlanStepsToFhirActions(steps: CarePlanStep[]): any[] | undefined {
    if (!Array.isArray(steps) || steps.length === 0) {
      return undefined;
    }

    return steps.map((step) => {
      const title = String(step.title || '').trim();
      const description = String(step.description || '').trim();
      const priority = String(step.priority || 'routine').trim();
      const type = step.type;

      let definitionCanonical = '';
      if (type === 'questionnaire') {
        definitionCanonical = this.normalizeReference(step.questionnaireRef, 'Questionnaire');
      } else if (type === 'appointment') {
        definitionCanonical = this.normalizeReference(step.activityDefinitionRef, 'ActivityDefinition');
      } else if (type === 'task') {
        definitionCanonical = this.normalizeReference(step.taskRef, 'Task');
      }

      const extension: any[] = [
        {
          url: this.planActionTypeExtensionUrl,
          valueString: type
        }
      ];

      if (type === 'communication' && String(step.communicationMessage || '').trim()) {
        extension.push({
          url: this.planActionCommunicationMessageExtensionUrl,
          valueString: String(step.communicationMessage || '').trim()
        });
      }

      const action: any = {
        title: title || undefined,
        description: description || undefined,
        priority: priority || undefined,
        extension
      };

      if (definitionCanonical) {
        action.definitionCanonical = definitionCanonical;
      }

      return action;
    });
  }

  private inferStepType(explicitType: CarePlanStepType | '', definitionCanonical: string): CarePlanStepType {
    if (explicitType === 'questionnaire' || explicitType === 'appointment' || explicitType === 'communication' || explicitType === 'task') {
      return explicitType;
    }

    if (definitionCanonical.startsWith('Questionnaire/')) {
      return 'questionnaire';
    }
    if (definitionCanonical.startsWith('ActivityDefinition/')) {
      return 'appointment';
    }
    if (definitionCanonical.startsWith('Task/')) {
      return 'task';
    }

    return 'communication';
  }

  private convertGoalPayloadToResource(payload: CareGoalUpsertPayload): any {
    return {
      resourceType: 'Goal',
      lifecycleStatus: payload.lifecycleStatus || 'proposed',
      achievementStatus: payload.achievementStatus
        ? {
            coding: [{ code: payload.achievementStatus.trim() }],
            text: payload.achievementStatus.trim()
          }
        : undefined,
      priority: payload.priority
        ? {
            coding: [{ code: payload.priority.trim() }],
            text: payload.priority.trim()
          }
        : undefined,
      description: {
        text: payload.title.trim()
      },
      note: payload.description.trim() ? [{ text: payload.description.trim() }] : undefined,
      target: payload.dueDate.trim() ? [{ dueDate: payload.dueDate.trim() }] : undefined
    };
  }

  private convertActionPayloadToResource(payload: CareActionUpsertPayload): any {
    const extension: any[] = [
      {
        url: this.actionTitleExtensionUrl,
        valueString: payload.title.trim()
      },
      {
        url: this.actionRequiredExtensionUrl,
        valueBoolean: Boolean(payload.required)
      }
    ];

    if (payload.timing.trim()) {
      extension.push({ url: this.actionTimingExtensionUrl, valueString: payload.timing.trim() });
    }
    if (payload.participantType.trim()) {
      extension.push({ url: this.actionParticipantTypeExtensionUrl, valueString: payload.participantType.trim() });
    }
    if (payload.participantRole.trim()) {
      extension.push({ url: this.actionParticipantRoleExtensionUrl, valueString: payload.participantRole.trim() });
    }
    if (payload.definition.trim()) {
      extension.push({ url: this.actionDefinitionExtensionUrl, valueString: payload.definition.trim() });
    }

    for (const value of payload.conditions) {
      const trimmed = String(value || '').trim();
      if (trimmed) {
        extension.push({ url: this.actionConditionExtensionUrl, valueString: trimmed });
      }
    }

    for (const goalRef of payload.goalRefs) {
      const normalized = this.normalizeReference(goalRef, 'Goal');
      if (normalized) {
        extension.push({
          url: this.actionGoalRefExtensionUrl,
          valueReference: { reference: normalized }
        });
      }
    }

    for (const relatedRef of payload.relatedActionRefs) {
      const normalized = this.normalizeReference(relatedRef, 'Task');
      if (normalized) {
        extension.push({
          url: this.actionRelatedExtensionUrl,
          valueReference: { reference: normalized }
        });
      }
    }

    return {
      resourceType: 'Task',
      status: payload.status || 'draft',
      priority: payload.priority || undefined,
      description: payload.description.trim() || undefined,
      code: payload.code.trim()
        ? {
            coding: [{ code: payload.code.trim() }],
            text: payload.title.trim() || payload.code.trim()
          }
        : (payload.title.trim() ? { text: payload.title.trim() } : undefined),
      extension
    };
  }

  private collectReferences(items: any): string[] {
    if (!Array.isArray(items)) {
      return [];
    }

    return items
      .map((item) => String(item?.reference || '').trim())
      .filter((value) => value.length > 0);
  }

  private collectReferenceExtensions(resource: any, url: string): string[] {
    const extensions = Array.isArray(resource?.extension) ? resource.extension : [];
    return extensions
      .filter((item: any) => String(item?.url || '').trim() === url)
      .map((item: any) => String(item?.valueReference?.reference || '').trim())
      .filter((value: string) => value.length > 0);
  }

  private collectStringExtensions(resource: any, url: string): string[] {
    const extensions = Array.isArray(resource?.extension) ? resource.extension : [];
    return extensions
      .filter((item: any) => String(item?.url || '').trim() === url)
      .map((item: any) => String(item?.valueString || '').trim())
      .filter((value: string) => value.length > 0);
  }

  private findStringExtension(resource: any, url: string): string {
    const extensions = Array.isArray(resource?.extension) ? resource.extension : [];
    const found = extensions.find((item: any) => String(item?.url || '').trim() === url);
    return String(found?.valueString || '').trim();
  }

  private findBooleanExtension(resource: any, url: string, fallback: boolean): boolean {
    const extensions = Array.isArray(resource?.extension) ? resource.extension : [];
    const found = extensions.find((item: any) => String(item?.url || '').trim() === url);
    if (!found) {
      return fallback;
    }
    return Boolean(found?.valueBoolean);
  }

  private normalizeReference(reference: string, resourceType: 'Task' | 'Goal' | 'Questionnaire' | 'ActivityDefinition'): string {
    const value = String(reference || '').trim();
    if (!value) {
      return '';
    }

    if (value.startsWith(`${resourceType}/`)) {
      return value;
    }

    if (value.includes('/')) {
      return '';
    }

    return `${resourceType}/${value}`;
  }

  private sortByDateDesc(left: string, right: string): number {
    const leftDate = left ? Date.parse(left) : 0;
    const rightDate = right ? Date.parse(right) : 0;
    return rightDate - leftDate;
  }
}
