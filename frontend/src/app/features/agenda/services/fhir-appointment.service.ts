import { Injectable } from '@angular/core';
import { HttpHeaders, HttpParams } from '@angular/common/http';
import { Observable, catchError, forkJoin, map, of, timeout } from 'rxjs';
import { ApiService } from '../../../core/services/api.service';
import { AgendaAppointment, AppointmentCreateInput, AppointmentUpdateInput, FhirAppointmentStatus, ResourceOption } from '../models/agenda-appointment.model';

@Injectable({
  providedIn: 'root'
})
export class FhirAppointmentService {
  private readonly endpoint = '/Appointment';
  private readonly fhirHeaders = new HttpHeaders({
    'Content-Type': 'application/fhir+json',
    Accept: 'application/fhir+json'
  });

  constructor(private readonly apiService: ApiService) {}

  searchAppointments(startInclusive: Date, endExclusive: Date): Observable<AgendaAppointment[]> {
    const params = new HttpParams()
      .set('_count', '120')
      .set('_sort', 'date')
      .set('date', `ge${startInclusive.toISOString()}`)
      .append('date', `lt${endExclusive.toISOString()}`);

    return this.apiService.get<any>(this.endpoint, { params }).pipe(
      timeout(8000),
      map((bundle) => this.convertBundle(bundle))
    );
  }

  createAppointment(input: AppointmentCreateInput): Observable<AgendaAppointment> {
    const payload = this.buildAppointmentPayload(input);
    return this.apiService.post<any>(this.endpoint, payload, { headers: this.fhirHeaders }).pipe(
      map((resource) => this.convertFhirAppointment(resource))
    );
  }

  updateAppointment(input: AppointmentUpdateInput): Observable<AgendaAppointment> {
    const payload = this.buildAppointmentPayload(input, input.id);
    return this.apiService.put<any>(`${this.endpoint}/${input.id}`, payload, { headers: this.fhirHeaders }).pipe(
      map((resource) => this.convertFhirAppointment(resource))
    );
  }

  private buildAppointmentPayload(input: AppointmentCreateInput, id?: string): any {
    const startDate = new Date(input.start);
    const endDate = new Date(startDate.getTime() + Math.max(5, input.durationMinutes) * 60000);

    const participants = [
      ...input.patientReferences.map((reference) => ({
        actor: { reference },
        status: 'accepted'
      })),
      ...input.practitionerReferences.map((reference) => ({
        actor: { reference },
        status: 'accepted'
      }))
    ];

    const payload: any = {
      resourceType: 'Appointment',
      status: input.status,
      description: input.comment?.trim() || undefined,
      comment: input.comment?.trim() || undefined,
      start: startDate.toISOString(),
      end: endDate.toISOString(),
      appointmentType: {
        coding: [
          {
            system: 'urn:healthapp:appointment-type',
            code: input.typeCode,
            display: input.typeLabel
          }
        ],
        text: input.title.trim()
      },
      serviceType: [
        {
          coding: [
            {
              system: 'urn:healthapp:appointment-model',
              code: input.modelCode,
              display: input.modelLabel
            }
          ],
          text: input.modelLabel
        }
      ],
      participant: participants
    };

    if (id) {
      payload.id = id;
    }

    if (input.recurrence && input.recurrence !== 'none') {
      payload.extension = [
        {
          url: 'urn:healthapp:appointment-recurrence',
          valueString: input.recurrence
        }
      ];
    }

    return payload;
  }

  searchPatients(query: string, limit = 10): Observable<ResourceOption[]> {
    const trimmed = query.trim();

    if (!trimmed) {
      return of([]);
    }

    const parts = trimmed.split(/\s+/).filter(Boolean);
    const first = parts[0] || '';
    const last = parts[parts.length - 1] || '';

    const requests = [
      this.fetchPatientOptions({ family: first, limit }),
      this.fetchPatientOptions({ given: first, limit })
    ];

    if (parts.length >= 2) {
      requests.push(this.fetchPatientOptions({ given: first, family: last, limit }));
      requests.push(this.fetchPatientOptions({ given: last, family: first, limit }));
    }

    return forkJoin(requests.map((request) => request.pipe(catchError(() => of([]))))).pipe(
      map((resultSets) => this.mergeOptionsByReference(resultSets.flat()))
    );
  }

  searchPractitioners(query: string, limit = 10): Observable<ResourceOption[]> {
    const trimmed = query.trim();

    if (!trimmed) {
      return of([]);
    }

    const parts = trimmed.split(/\s+/).filter(Boolean);
    const first = parts[0] || '';
    const last = parts[parts.length - 1] || '';

    const requests = [
      this.fetchPractitionerOptions({ family: first, limit }),
      this.fetchPractitionerOptions({ given: first, limit })
    ];

    if (parts.length >= 2) {
      requests.push(this.fetchPractitionerOptions({ given: first, family: last, limit }));
      requests.push(this.fetchPractitionerOptions({ given: last, family: first, limit }));
    }

    return forkJoin(requests.map((request) => request.pipe(catchError(() => of([]))))).pipe(
      map((resultSets) => this.mergeOptionsByReference(resultSets.flat()))
    );
  }

  private fetchPatientOptions(criteria: { family?: string; given?: string; limit: number }): Observable<ResourceOption[]> {
    let params = new HttpParams().set('_count', String(criteria.limit));

    if (criteria.family?.trim()) {
      params = params.set('family', criteria.family.trim());
    }

    if (criteria.given?.trim()) {
      params = params.set('given', criteria.given.trim());
    }

    return this.apiService.get<any>('/Patient', { params }).pipe(
      map((bundle) => {
        if (!bundle?.entry) {
          return [];
        }
        return bundle.entry
          .map((entry: any) => entry?.resource)
          .filter((resource: any) => resource?.resourceType === 'Patient')
          .map((patient: any): ResourceOption => {
            const family = patient?.name?.[0]?.family || '';
            const given = patient?.name?.[0]?.given?.[0] || '';
            const label = `${given} ${family}`.trim() || patient?.name?.[0]?.text || `Patient/${patient.id}`;
            return {
              id: patient.id,
              reference: `Patient/${patient.id}`,
              label
            };
          });
      })
    );
  }

  private fetchPractitionerOptions(criteria: { family?: string; given?: string; limit: number }): Observable<ResourceOption[]> {
    let params = new HttpParams().set('_count', String(criteria.limit));

    if (criteria.family?.trim()) {
      params = params.set('family', criteria.family.trim());
    }

    if (criteria.given?.trim()) {
      params = params.set('given', criteria.given.trim());
    }

    return this.apiService.get<any>('/Practitioner', { params }).pipe(
      map((bundle) => {
        if (!bundle?.entry) {
          return [];
        }
        return bundle.entry
          .map((entry: any) => entry?.resource)
          .filter((resource: any) => resource?.resourceType === 'Practitioner')
          .map((practitioner: any): ResourceOption => {
            const family = practitioner?.name?.[0]?.family || '';
            const given = practitioner?.name?.[0]?.given?.[0] || '';
            const label = `${given} ${family}`.trim() || practitioner?.name?.[0]?.text || `Practitioner/${practitioner.id}`;
            return {
              id: practitioner.id,
              reference: `Practitioner/${practitioner.id}`,
              label
            };
          });
      })
    );
  }

  private mergeOptionsByReference(items: ResourceOption[]): ResourceOption[] {
    const unique = new Map<string, ResourceOption>();

    items.forEach((item) => {
      if (!item.reference || unique.has(item.reference)) {
        return;
      }
      unique.set(item.reference, item);
    });

    return Array.from(unique.values());
  }

  resolveReferenceDisplay(reference: string): Observable<string> {
    const normalized = this.normalizeReference(reference);
    if (!normalized) {
      return of('Inconnu');
    }

    return this.apiService.get<any>(`/${normalized}`).pipe(
      timeout(4000),
      map((resource) => {
        if (resource?.resourceType === 'Patient' || resource?.resourceType === 'Practitioner') {
          const family = resource?.name?.[0]?.family || '';
          const given = resource?.name?.[0]?.given?.[0] || '';
          return `${given} ${family}`.trim() || resource?.name?.[0]?.text || normalized;
        }
        return resource?.name || resource?.id || normalized;
      })
    );
  }

  private convertBundle(bundle: any): AgendaAppointment[] {
    if (!bundle?.entry) {
      return [];
    }

    return bundle.entry
      .map((entry: any) => this.convertFhirAppointment(entry?.resource))
      .filter((item: AgendaAppointment | null): item is AgendaAppointment => !!item)
      .sort((a: AgendaAppointment, b: AgendaAppointment) => new Date(a.start).getTime() - new Date(b.start).getTime());
  }

  private convertFhirAppointment(resource: any): AgendaAppointment {
    const participants = Array.isArray(resource?.participant) ? resource.participant : [];
    const patientParticipants: ResourceOption[] = [];
    const practitionerParticipants: ResourceOption[] = [];

    participants.forEach((participant: any) => {
      const reference = this.normalizeReference(participant?.actor?.reference || '');
      if (!reference) {
        return;
      }

      const label = String(participant?.actor?.display || reference);
      const id = reference.split('/')[1] || reference;
      const option: ResourceOption = { id, reference, label };

      if (reference.startsWith('Patient/')) {
        patientParticipants.push(option);
      } else if (reference.startsWith('Practitioner/')) {
        practitionerParticipants.push(option);
      }
    });

    const title = resource?.appointmentType?.text
      || resource?.description
      || resource?.serviceType?.[0]?.text
      || 'Rendez-vous';

    return {
      id: String(resource?.id || ''),
      title,
      status: this.toAppointmentStatus(resource?.status),
      start: String(resource?.start || ''),
      end: String(resource?.end || ''),
      typeCode: String(resource?.appointmentType?.coding?.[0]?.code || ''),
      typeLabel: String(resource?.appointmentType?.coding?.[0]?.display || resource?.appointmentType?.text || ''),
      modelCode: String(resource?.serviceType?.[0]?.coding?.[0]?.code || ''),
      modelLabel: String(resource?.serviceType?.[0]?.coding?.[0]?.display || resource?.serviceType?.[0]?.text || ''),
      description: String(resource?.description || ''),
      comment: String(resource?.comment || ''),
      recurrence: String(resource?.extension?.find((item: any) => item?.url === 'urn:healthapp:appointment-recurrence')?.valueString || 'none'),
      patientParticipants,
      practitionerParticipants
    };
  }

  private normalizeReference(reference: string): string {
    const value = String(reference || '').trim();
    if (!value) {
      return '';
    }

    if (value.startsWith('http://') || value.startsWith('https://')) {
      const markers = ['Patient/', 'Practitioner/'];
      for (const marker of markers) {
        const idx = value.lastIndexOf(marker);
        if (idx >= 0) {
          return value.slice(idx);
        }
      }
    }

    return value;
  }

  private toAppointmentStatus(value: string): FhirAppointmentStatus {
    const allowed: FhirAppointmentStatus[] = [
      'proposed',
      'pending',
      'booked',
      'arrived',
      'fulfilled',
      'cancelled',
      'noshow',
      'entered-in-error',
      'checked-in',
      'waitlist'
    ];

    if (allowed.includes(value as FhirAppointmentStatus)) {
      return value as FhirAppointmentStatus;
    }

    return 'booked';
  }
}
