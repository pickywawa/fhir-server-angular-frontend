import { Injectable } from '@angular/core';
import { HttpParams } from '@angular/common/http';
import { forkJoin, Observable, of, switchMap } from 'rxjs';
import { catchError, map } from 'rxjs/operators';
import { ApiService } from '../../../../../core/services/api.service';
import { PatientTimelineAction, PatientTimelineCategory, PatientTimelineEvent } from '../models/patient-timeline.model';

@Injectable({
  providedIn: 'root'
})
export class FhirPatientTimelineService {
  constructor(private readonly apiService: ApiService) {}

  listPatientTimeline(patientId: string): Observable<PatientTimelineEvent[]> {
    if (!patientId) {
      return of([]);
    }

    return forkJoin([
      this.fetchPatientHistory(patientId).pipe(catchError(() => of([]))),
      this.fetchCarePlanHistory(patientId).pipe(catchError(() => of([]))),
      this.fetchDocumentEvents(patientId).pipe(catchError(() => of([]))),
      this.fetchQuestionnaireEvents(patientId).pipe(catchError(() => of([]))),
      this.fetchAppointmentEvents(patientId).pipe(catchError(() => of([]))),
      this.fetchCareTeamEvents(patientId).pipe(catchError(() => of([]))),
      this.fetchRelatedPersonEvents(patientId).pipe(catchError(() => of([]))),
      this.fetchDiscussionEvents(patientId).pipe(catchError(() => of([])))
    ]).pipe(
      map((eventGroups) => eventGroups.flat()),
      map((events) =>
        events.sort(
          (a, b) => new Date(b.occurredAt || 0).getTime() - new Date(a.occurredAt || 0).getTime()
        )
      )
    );
  }

  private fetchPatientHistory(patientId: string): Observable<PatientTimelineEvent[]> {
    const params = new HttpParams().set('_count', '20');

    return this.apiService.get<any>(`/Patient/${patientId}/_history`, { params }).pipe(
      map((bundle) => {
        const entries = bundle?.entry ?? [];
        return entries
          .map((entry: any) => entry?.resource)
          .filter((resource: any) => resource?.resourceType === 'Patient')
          .map((resource: any) => {
            const versionId = String(resource?.meta?.versionId || '');
            const action: PatientTimelineAction = versionId === '1' ? 'created' : 'updated';
            const details = this.buildPatientDetails(resource);
            return this.toEvent({
              id: `patient-${resource?.id || patientId}-v${versionId || 'x'}`,
              occurredAt: resource?.meta?.lastUpdated || '',
              category: 'patient',
              action,
              actor: this.extractActorLabel(resource?.generalPractitioner?.[0]),
              details,
              routeCommands: ['/my-patients', patientId],
              queryParams: { tab: 'patient-identity' }
            });
          });
      })
    );
  }

  private fetchCarePlanHistory(patientId: string): Observable<PatientTimelineEvent[]> {
    const params = new HttpParams().set('subject', `Patient/${patientId}`).set('_count', '50');

    return this.apiService.get<any>('/CarePlan', { params }).pipe(
      map((bundle) => {
        const entries = bundle?.entry ?? [];
        return entries
          .map((entry: any) => entry?.resource)
          .filter((resource: any) => resource?.resourceType === 'CarePlan')
          .map((resource: any) => String(resource?.id || '').trim())
          .filter(Boolean);
      }),
      switchMap((carePlanIds) => {
        if (!carePlanIds.length) {
          return of([]);
        }

        const requests: Observable<PatientTimelineEvent[]>[] = carePlanIds.map(
          (carePlanId: string): Observable<PatientTimelineEvent[]> => {
            const historyParams = new HttpParams().set('_count', '20');
            return this.apiService.get<any>(`/CarePlan/${carePlanId}/_history`, { params: historyParams }).pipe(
              map((bundle) => {
                const entries = bundle?.entry ?? [];
                return entries
                  .map((entry: any) => entry?.resource)
                  .filter((resource: any) => resource?.resourceType === 'CarePlan')
                  .map((resource: any) => {
                    const versionId = String(resource?.meta?.versionId || '');
                    const action: PatientTimelineAction = versionId === '1' ? 'created' : 'updated';
                    const details = String(resource?.title || resource?.description || `CarePlan ${carePlanId}`);
                    return this.toEvent({
                      id: `careplan-${carePlanId}-v${versionId || 'x'}`,
                      occurredAt: resource?.meta?.lastUpdated || resource?.created || '',
                      category: 'careplan',
                      action,
                      actor: this.extractActorLabel(resource?.author),
                      details,
                      routeCommands: ['/my-patients', patientId],
                      queryParams: { tab: 'careplan' }
                    });
                  });
              }),
              catchError(() => of([]))
            );
          }
        );

        return forkJoin(requests).pipe(map((sets) => sets.flat()));
      })
    );
  }

  private fetchDocumentEvents(patientId: string): Observable<PatientTimelineEvent[]> {
    const params = new HttpParams()
      .set('subject', `Patient/${patientId}`)
      .set('_sort', '-date')
      .set('_count', '100');

    return this.apiService.get<any>('/DocumentReference', { params }).pipe(
      map((bundle) => {
        const entries = bundle?.entry ?? [];
        return entries
          .map((entry: any) => entry?.resource)
          .filter((resource: any) => resource?.resourceType === 'DocumentReference')
          .map((resource: any) =>
            this.toEvent({
              id: `document-${resource?.id || this.randomSuffix()}`,
              occurredAt: resource?.date || resource?.meta?.lastUpdated || '',
              category: 'document',
              action: this.resolveActionFromVersion(resource?.meta?.versionId),
              actor: this.extractActorLabel(resource?.author?.[0]),
              details: String(resource?.description || resource?.type?.text || resource?.id || ''),
              routeCommands: ['/my-patients', patientId],
              queryParams: { tab: 'documents' }
            })
          );
      })
    );
  }

  private fetchQuestionnaireEvents(patientId: string): Observable<PatientTimelineEvent[]> {
    const params = new HttpParams()
      .set('subject', `Patient/${patientId}`)
      .set('_sort', '-_lastUpdated')
      .set('_count', '100');

    return this.apiService.get<any>('/QuestionnaireResponse', { params }).pipe(
      map((bundle) => {
        const entries = bundle?.entry ?? [];
        return entries
          .map((entry: any) => entry?.resource)
          .filter((resource: any) => resource?.resourceType === 'QuestionnaireResponse')
          .map((resource: any) => {
            const responseId = String(resource?.id || '').trim();
            const questionnaireReference = String(resource?.questionnaire || '').trim();
            const questionnaireId = questionnaireReference.includes('/')
              ? questionnaireReference.split('/').pop() || ''
              : questionnaireReference;

            return this.toEvent({
              id: `questionnaire-${responseId || this.randomSuffix()}`,
              occurredAt: resource?.authored || resource?.meta?.lastUpdated || '',
              category: 'questionnaire',
              action: this.resolveActionFromVersion(resource?.meta?.versionId),
              actor: this.extractActorLabel(resource?.author || resource?.source),
              details: questionnaireReference || responseId,
              routeCommands: responseId && questionnaireId
                ? ['/my-patients', patientId, 'questionnaires', 'response', responseId]
                : ['/my-patients', patientId],
              queryParams: responseId && questionnaireId ? undefined : { tab: 'questionnaires' }
            });
          });
      })
    );
  }

  private fetchAppointmentEvents(patientId: string): Observable<PatientTimelineEvent[]> {
    const params = new HttpParams()
      .set('participant', `Patient/${patientId}`)
      .set('_sort', '-date')
      .set('_count', '100');

    return this.apiService.get<any>('/Appointment', { params }).pipe(
      map((bundle) => {
        const entries = bundle?.entry ?? [];
        return entries
          .map((entry: any) => entry?.resource)
          .filter((resource: any) => resource?.resourceType === 'Appointment')
          .map((resource: any) =>
            this.toEvent({
              id: `appointment-${resource?.id || this.randomSuffix()}`,
              occurredAt: resource?.start || resource?.created || resource?.meta?.lastUpdated || '',
              category: 'appointment',
              action: this.resolveActionFromVersion(resource?.meta?.versionId),
              actor: this.extractAppointmentActor(resource),
              details: String(resource?.description || resource?.appointmentType?.text || resource?.id || ''),
              routeCommands: ['/agenda']
            })
          );
      })
    );
  }

  private fetchCareTeamEvents(patientId: string): Observable<PatientTimelineEvent[]> {
    const params = new HttpParams().set('patient', `Patient/${patientId}`).set('_count', '100');

    return this.apiService.get<any>('/CareTeam', { params }).pipe(
      map((bundle) => {
        const entries = bundle?.entry ?? [];
        const careTeams = entries
          .map((entry: any) => entry?.resource)
          .filter((resource: any) => resource?.resourceType === 'CareTeam');

        return careTeams.flatMap((resource: any) => {
          const participants = resource?.participant ?? [];
          if (!participants.length) {
            return [
              this.toEvent({
                id: `careteam-${resource?.id || this.randomSuffix()}`,
                occurredAt: resource?.meta?.lastUpdated || '',
                category: 'care-team',
                action: this.resolveActionFromVersion(resource?.meta?.versionId),
                actor: '',
                details: String(resource?.name || resource?.id || 'CareTeam'),
                routeCommands: ['/my-patients', patientId],
                queryParams: { tab: 'care-team' }
              })
            ];
          }

          return participants.map((participant: any, index: number) => {
            const memberLabel = this.extractActorLabel(participant?.member);
            const roleLabel = String(participant?.role?.[0]?.text || participant?.role?.[0]?.coding?.[0]?.display || '').trim();
            const details = [memberLabel, roleLabel].filter(Boolean).join(' · ') || String(resource?.name || 'Intervenant');

            return this.toEvent({
              id: `careteam-${resource?.id || this.randomSuffix()}-${index}`,
              occurredAt: resource?.meta?.lastUpdated || '',
              category: 'care-team',
              action: this.resolveActionFromVersion(resource?.meta?.versionId),
              actor: memberLabel,
              details,
              routeCommands: ['/my-patients', patientId],
              queryParams: { tab: 'care-team' }
            });
          });
        });
      })
    );
  }

  private fetchRelatedPersonEvents(patientId: string): Observable<PatientTimelineEvent[]> {
    const params = new HttpParams().set('patient', `Patient/${patientId}`).set('_count', '100');

    return this.apiService.get<any>('/RelatedPerson', { params }).pipe(
      map((bundle) => {
        const entries = bundle?.entry ?? [];
        return entries
          .map((entry: any) => entry?.resource)
          .filter((resource: any) => resource?.resourceType === 'RelatedPerson')
          .map((resource: any) =>
            this.toEvent({
              id: `related-person-${resource?.id || this.randomSuffix()}`,
              occurredAt: resource?.meta?.lastUpdated || '',
              category: 'related-person',
              action: this.resolveActionFromVersion(resource?.meta?.versionId),
              actor: this.extractRelatedPersonName(resource),
              details: this.extractRelatedPersonName(resource),
              routeCommands: ['/my-patients', patientId],
              queryParams: { tab: 'related-person' }
            })
          );
      })
    );
  }

  private fetchDiscussionEvents(patientId: string): Observable<PatientTimelineEvent[]> {
    const params = new HttpParams()
      .set('subject', `Patient/${patientId}`)
      .set('_sort', '-sent')
      .set('_count', '100');

    return this.apiService.get<any>('/Communication', { params }).pipe(
      map((bundle) => {
        const entries = bundle?.entry ?? [];
        return entries
          .map((entry: any) => entry?.resource)
          .filter((resource: any) => resource?.resourceType === 'Communication')
          .map((resource: any) =>
            this.toEvent({
              id: `discussion-${resource?.id || this.randomSuffix()}`,
              occurredAt: resource?.sent || resource?.meta?.lastUpdated || '',
              category: 'discussion',
              action: this.resolveActionFromVersion(resource?.meta?.versionId),
              actor: this.extractActorLabel(resource?.sender),
              details: String(resource?.payload?.[0]?.contentString || '').slice(0, 120),
              routeCommands: ['/my-patients', patientId],
              queryParams: { tab: 'discussions' }
            })
          );
      })
    );
  }

  private extractActorLabel(referenceNode: any): string {
    const display = String(referenceNode?.display || '').trim();
    if (display) {
      return display;
    }

    const reference = String(referenceNode?.reference || '').trim();
    if (!reference) {
      return '';
    }

    if (reference.includes('/')) {
      return reference.split('/').pop() || reference;
    }

    return reference;
  }

  private extractAppointmentActor(resource: any): string {
    const participants = resource?.participant ?? [];
    const actor = participants.find((entry: any) => {
      const reference = String(entry?.actor?.reference || '');
      return reference.startsWith('Practitioner/');
    });

    if (actor?.actor) {
      return this.extractActorLabel(actor.actor);
    }

    return '';
  }

  private extractRelatedPersonName(resource: any): string {
    const first = String(resource?.name?.[0]?.given?.[0] || '').trim();
    const last = String(resource?.name?.[0]?.family || '').trim();
    return `${first} ${last}`.trim() || String(resource?.id || '');
  }

  private buildPatientDetails(resource: any): string {
    const first = String(resource?.name?.[0]?.given?.[0] || '').trim();
    const last = String(resource?.name?.[0]?.family || '').trim();
    return `${first} ${last}`.trim() || String(resource?.id || 'Patient');
  }

  private resolveActionFromVersion(versionId: string): PatientTimelineAction {
    return String(versionId || '').trim() === '1' ? 'created' : 'updated';
  }

  private toEvent(input: PatientTimelineEvent): PatientTimelineEvent {
    return {
      ...input,
      occurredAt: input.occurredAt || new Date(0).toISOString(),
      actor: input.actor || 'N/A',
      details: input.details || '-'
    };
  }

  private randomSuffix(): string {
    return Math.random().toString(16).slice(2, 10);
  }
}
