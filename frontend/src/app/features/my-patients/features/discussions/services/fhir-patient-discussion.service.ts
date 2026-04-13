import { Injectable } from '@angular/core';
import { HttpHeaders, HttpParams } from '@angular/common/http';
import { Observable, forkJoin, map, of, switchMap } from 'rxjs';
import { catchError } from 'rxjs/operators';
import { ApiService } from '../../../../../core/services/api.service';
import { PatientDiscussionMessage } from '../models/patient-discussion.model';

@Injectable({
  providedIn: 'root'
})
export class FhirPatientDiscussionService {
  private readonly endpoint = '/Communication';
  private readonly fhirHeaders = new HttpHeaders({
    'Content-Type': 'application/fhir+json',
    Accept: 'application/fhir+json'
  });

  constructor(private readonly apiService: ApiService) {}

  listMessagesByPatient(patientId: string): Observable<PatientDiscussionMessage[]> {
    const params = new HttpParams()
      .set('subject', `Patient/${patientId}`)
      .set('_sort', '-sent')
      .set('_count', '200');

    return this.apiService.get<any>(this.endpoint, { params }).pipe(
      map((bundle) => {
        const entries = bundle?.entry ?? [];
        return entries
          .map((entry: any) => entry?.resource)
          .filter((resource: any) => resource?.resourceType === 'Communication')
          .map((resource: any) => this.mapCommunication(resource));
      })
    );
  }

  listMessagesByRecipients(recipientReferences: string[]): Observable<PatientDiscussionMessage[]> {
    const normalized = Array.from(
      new Set(
        recipientReferences
          .map((item) => String(item || '').trim())
          .filter(Boolean)
      )
    );

    if (!normalized.length) {
      console.debug('[discussions-global] communication lookup skipped: no recipient references');
      return of([]);
    }

    console.debug('[discussions-global] communication lookup start', {
      recipientReferences: normalized
    });

    const requests = normalized.map((reference) => {
      const params = new HttpParams()
        .set('recipient', reference)
        .set('_sort', '-sent')
        .set('_count', '200');

      return this.apiService.get<any>(this.endpoint, { params }).pipe(
        map((bundle) => {
          const entries = bundle?.entry ?? [];
          console.debug('[discussions-global] communication lookup by recipient', {
            recipient: reference,
            entriesCount: entries.length
          });
          return entries
            .map((entry: any) => entry?.resource)
            .filter((resource: any) => resource?.resourceType === 'Communication')
            .map((resource: any) => this.mapCommunication(resource));
        }),
        catchError(() => of([] as PatientDiscussionMessage[]))
      );
    });

    return forkJoin(requests).pipe(
      map((resultSets) => resultSets.flat()),
      map((messages) => {
        const byId = new Map<string, PatientDiscussionMessage>();
        messages.forEach((message) => {
          if (!message.id) {
            return;
          }
          byId.set(message.id, message);
        });

        const deduped = Array.from(byId.values()).sort(
          (a, b) => new Date(b.sent).getTime() - new Date(a.sent).getTime()
        );

        console.debug('[discussions-global] communication lookup aggregated', {
          rawMessagesCount: messages.length,
          dedupedCount: deduped.length,
          discussionIds: Array.from(new Set(deduped.map((item) => item.discussionId)))
        });

        return deduped;
      })
    );
  }

  sendMessage(
    patientId: string,
    discussionId: string,
    senderReference: string,
    recipientReference: string,
    content: string,
    discussionTitle?: string
  ): Observable<PatientDiscussionMessage> {
    const now = new Date().toISOString();
    const messageId = this.newUid();

    const payload = {
      resourceType: 'Communication',
      identifier: [
        {
          system: 'urn:healthapp:discussion-id',
          value: discussionId
        },
        {
          system: 'urn:healthapp:message-id',
          value: messageId
        }
      ],
      status: 'completed',
      subject: { reference: `Patient/${patientId}` },
      sender: { reference: senderReference },
      recipient: [{ reference: recipientReference }],
      sent: now,
      topic: discussionTitle ? { text: discussionTitle } : undefined,
      payload: [{ contentString: content }]
    };

    return this.ensurePractitionerExists(senderReference).pipe(
      switchMap(() => this.apiService.post<any>(this.endpoint, payload, { headers: this.fhirHeaders })),
      map((resource) => this.mapCommunication(resource))
    );
  }

  private ensurePractitionerExists(senderReference: string): Observable<void> {
    const id = this.extractResourceId(senderReference, 'Practitioner');
    if (!id) {
      return of(void 0);
    }

    return this.apiService.get<any>(`/Practitioner/${id}`).pipe(
      map(() => void 0),
      catchError(() => {
        const payload = {
          resourceType: 'Practitioner',
          id,
          name: [
            {
              text: `Practitioner ${id}`
            }
          ]
        };

        return this.apiService.put<any>(`/Practitioner/${id}`, payload, { headers: this.fhirHeaders }).pipe(
          map(() => void 0)
        );
      })
    );
  }

  private extractResourceId(reference: string, resourceType: string): string {
    const normalized = String(reference || '').trim();
    const prefix = `${resourceType}/`;
    if (!normalized.startsWith(prefix)) {
      return '';
    }
    return normalized.slice(prefix.length);
  }

  private mapCommunication(resource: any): PatientDiscussionMessage {
    const identifiers = resource?.identifier ?? [];
    const discussionId = this.getIdentifierValue(identifiers, 'discussion-id') || 'discussion-inconnue';
    const messageId = this.getIdentifierValue(identifiers, 'message-id') || resource?.id || this.newUid();

    return {
      id: messageId,
      resourceId: String(resource?.id || '').trim(),
      discussionId,
      discussionTitle: String(resource?.topic?.text || '').trim(),
      senderReference: resource?.sender?.reference || '',
      recipientReferences: (resource?.recipient ?? []).map((item: any) => item?.reference).filter(Boolean),
      subjectReference: resource?.subject?.reference || '',
      sent: resource?.sent || '',
      content: resource?.payload?.[0]?.contentString || ''
    };
  }

  updateDiscussionTitle(messages: PatientDiscussionMessage[], title: string): Observable<void> {
    const normalizedTitle = String(title || '').trim();
    if (!normalizedTitle) {
      return of(void 0);
    }

    const resourceIds = Array.from(
      new Set(
        messages
          .map((message) => String(message.resourceId || '').trim())
          .filter(Boolean)
      )
    );

    if (!resourceIds.length) {
      return of(void 0);
    }

    const updates = resourceIds.map((resourceId) =>
      this.apiService.get<any>(`${this.endpoint}/${resourceId}`).pipe(
        map((resource) => ({
          ...resource,
          topic: {
            ...(resource?.topic || {}),
            text: normalizedTitle
          }
        })),
        switchMap((updated) => this.apiService.put<any>(`${this.endpoint}/${resourceId}`, updated, { headers: this.fhirHeaders })),
        map(() => void 0)
      )
    );

    return forkJoin(updates).pipe(map(() => void 0));
  }

  private getIdentifierValue(identifiers: any[], system: string): string {
    const item = identifiers.find((entry: any) => {
      const raw = String(entry?.system || '').toLowerCase();
      return raw === system || raw.endsWith(system);
    });
    return item?.value || '';
  }

  private newUid(): string {
    if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
      return crypto.randomUUID();
    }
    return `${Date.now()}-${Math.random().toString(16).slice(2)}`;
  }

  resolveReferenceDisplay(reference: string): Observable<string> {
    const normalized = this.normalizeReference(reference);
    if (!normalized) {
      return of('Inconnu');
    }

    return this.apiService.get<any>(`/${normalized}`).pipe(
      map((resource) => {
        const resourceType = resource?.resourceType;

        if (resourceType === 'Practitioner') {
          const first = resource?.name?.[0]?.given?.[0] || '';
          const last = resource?.name?.[0]?.family || '';
          const text = `${first} ${last}`.trim();
          return text || resource?.name?.[0]?.text || normalized;
        }

        if (resourceType === 'CareTeam') {
          return resource?.name || resource?.id ? `CareTeam/${resource?.id}` : normalized;
        }

        return resource?.name?.[0]?.text || resource?.id || normalized;
      }),
      catchError(() => of(normalized))
    );
  }

  private normalizeReference(reference: string): string {
    const value = String(reference || '').trim();
    if (!value) {
      return '';
    }

    if (value.startsWith('http://') || value.startsWith('https://')) {
      const practitionerIndex = value.lastIndexOf('Practitioner/');
      if (practitionerIndex >= 0) {
        return value.slice(practitionerIndex);
      }

      const careTeamIndex = value.lastIndexOf('CareTeam/');
      if (careTeamIndex >= 0) {
        return value.slice(careTeamIndex);
      }

      const patientIndex = value.lastIndexOf('Patient/');
      if (patientIndex >= 0) {
        return value.slice(patientIndex);
      }
    }

    return value;
  }
}
