import { Injectable } from '@angular/core';
import { HttpParams } from '@angular/common/http';
import { forkJoin, Observable, of } from 'rxjs';
import { catchError, map } from 'rxjs/operators';
import { ApiService } from '../../../core/services/api.service';
import { SearchResultItem } from '../models/search-result.model';

@Injectable({
  providedIn: 'root'
})
export class FhirSearchService {
  constructor(private readonly apiService: ApiService) {}

  search(term: string): Observable<SearchResultItem[]> {
    const query = term.trim();
    if (!query) {
      return of([]);
    }

    return forkJoin([
      this.searchPatients(query).pipe(catchError(() => of([]))),
      this.searchPractitioners(query).pipe(catchError(() => of([]))),
      this.searchAppointments(query).pipe(catchError(() => of([]))),
      this.searchDocuments(query).pipe(catchError(() => of([])))
    ]).pipe(
      map(([patients, practitioners, appointments, documents]) => [
        ...patients,
        ...practitioners,
        ...appointments,
        ...documents
      ])
    );
  }

  private searchPatients(query: string): Observable<SearchResultItem[]> {
    const parts = query.trim().split(/\s+/).filter(Boolean);
    const first = parts[0] || '';
    const last = parts[parts.length - 1] || '';

    const requests = [
      this.fetchPatientsByCriteria({ family: first }),
      this.fetchPatientsByCriteria({ given: first })
    ];

    if (parts.length >= 2) {
      requests.push(this.fetchPatientsByCriteria({ given: first, family: last }));
      requests.push(this.fetchPatientsByCriteria({ given: last, family: first }));
    }

    return forkJoin(requests.map((request) => request.pipe(catchError(() => of([]))))).pipe(
      map((resultSets) => this.mergeSearchResults(resultSets.flat())),
      map((results) => this.filterByQuery(results, query))
    );
  }

  private searchPractitioners(query: string): Observable<SearchResultItem[]> {
    const parts = query.trim().split(/\s+/).filter(Boolean);
    const first = parts[0] || '';
    const last = parts[parts.length - 1] || '';

    const requests = [
      this.fetchPractitionersByCriteria({ family: first }),
      this.fetchPractitionersByCriteria({ given: first })
    ];

    if (parts.length >= 2) {
      requests.push(this.fetchPractitionersByCriteria({ given: first, family: last }));
      requests.push(this.fetchPractitionersByCriteria({ given: last, family: first }));
    }

    return forkJoin(requests.map((request) => request.pipe(catchError(() => of([]))))).pipe(
      map((resultSets) => this.mergeSearchResults(resultSets.flat())),
      map((results) => this.filterByQuery(results, query))
    );
  }

  private searchAppointments(query: string): Observable<SearchResultItem[]> {
    const params = new HttpParams().set('_count', '100').set('_sort', '-date');
    const normalizedQuery = query.toLowerCase();

    return this.apiService.get<any>('/Appointment', { params }).pipe(
      map((bundle) => {
        const entries = bundle?.entry ?? [];
        return entries
          .map((entry: any) => entry?.resource)
          .filter((resource: any) => resource?.resourceType === 'Appointment')
          .map((appointment: any) => {
            const title = String(
              appointment?.appointmentType?.text
              || appointment?.description
              || appointment?.serviceType?.[0]?.text
              || 'Rendez-vous'
            );
            const participants = (appointment?.participant ?? [])
              .map((item: any) => String(item?.actor?.display || item?.actor?.reference || ''))
              .filter(Boolean)
              .join(' · ');
            return {
              resource: appointment,
              title,
              participants
            };
          })
          .filter((item: any) => {
            const haystack = `${item.title} ${item.participants}`.toLowerCase();
            return haystack.includes(normalizedQuery);
          })
          .map((item: any): SearchResultItem => ({
            id: String(item.resource?.id || ''),
            type: 'appointment',
            title: item.title,
            subtitle: item.resource?.start || 'Rendez-vous',
            description: item.participants || 'Ouvrir agenda',
            routeCommands: ['/agenda']
          }));
      })
    );
  }

  private searchDocuments(query: string): Observable<SearchResultItem[]> {
    const params = new HttpParams().set('_count', '100').set('_sort', '-date');
    return this.apiService.get<any>('/DocumentReference', { params }).pipe(
      map((bundle) => {
        const normalizedQuery = query.toLowerCase();
        const entries = bundle?.entry ?? [];
        return entries
          .map((entry: any) => entry?.resource)
          .filter((resource: any) => resource?.resourceType === 'DocumentReference')
          .map((document: any): SearchResultItem | null => {
            const patientReference = String(document?.subject?.reference || '');
            const patientId = patientReference.startsWith('Patient/') ? patientReference.slice('Patient/'.length) : '';
            if (!patientId) {
              return null;
            }

            const title = String(document?.description || document?.content?.[0]?.attachment?.title || 'Document');
            const subtitle = String(document?.type?.coding?.[0]?.display || document?.type?.text || 'DocumentReference');
            const description = String(document?.date || document?.content?.[0]?.attachment?.creation || 'Ouvrir document patient');

            return {
              id: String(document?.id || ''),
              type: 'document',
              title,
              subtitle,
              description,
              routeCommands: ['/my-patients', patientId],
              queryParams: { tab: 'documents' }
            };
          })
          .filter((item: SearchResultItem | null): item is SearchResultItem => !!item)
          .filter((item: SearchResultItem) => {
            const haystack = `${item.title} ${item.subtitle} ${item.description}`.toLowerCase();
            return haystack.includes(normalizedQuery);
          });
      })
    );
  }

  private fetchPatientsByCriteria(criteria: { family?: string; given?: string }): Observable<SearchResultItem[]> {
    let params = new HttpParams().set('_count', '20');

    if (criteria.family?.trim()) {
      params = params.set('family', criteria.family.trim());
    }

    if (criteria.given?.trim()) {
      params = params.set('given', criteria.given.trim());
    }

    return this.apiService.get<any>('/Patient', { params }).pipe(
      map((bundle) => {
        const entries = bundle?.entry ?? [];
        return entries
          .map((entry: any) => entry?.resource)
          .filter((resource: any) => resource?.resourceType === 'Patient')
          .map((patient: any): SearchResultItem => {
            const family = patient?.name?.[0]?.family || '';
            const given = patient?.name?.[0]?.given?.[0] || '';
            const title = `${given} ${family}`.trim() || `Patient/${patient.id}`;
            const subtitle = [patient?.birthDate || '', patient?.gender || ''].filter(Boolean).join(' · ');
            return {
              id: String(patient?.id || ''),
              type: 'patient',
              title,
              subtitle: subtitle || 'Patient',
              description: 'Detail patient',
              routeCommands: ['/my-patients', String(patient?.id || '')]
            };
          });
      })
    );
  }

  private fetchPractitionersByCriteria(criteria: { family?: string; given?: string }): Observable<SearchResultItem[]> {
    let params = new HttpParams().set('_count', '20');

    if (criteria.family?.trim()) {
      params = params.set('family', criteria.family.trim());
    }

    if (criteria.given?.trim()) {
      params = params.set('given', criteria.given.trim());
    }

    return this.apiService.get<any>('/Practitioner', { params }).pipe(
      map((bundle) => {
        const entries = bundle?.entry ?? [];
        return entries
          .map((entry: any) => entry?.resource)
          .filter((resource: any) => resource?.resourceType === 'Practitioner')
          .map((practitioner: any): SearchResultItem => {
            const family = practitioner?.name?.[0]?.family || '';
            const given = practitioner?.name?.[0]?.given?.[0] || '';
            const title = `${given} ${family}`.trim() || `Practitioner/${practitioner.id}`;
            const subtitle = practitioner?.qualification?.[0]?.code?.text || practitioner?.identifier?.[0]?.value || 'Professionnel';
            return {
              id: String(practitioner?.id || ''),
              type: 'practitioner',
              title,
              subtitle,
              description: 'Detail professionnel',
              routeCommands: ['/practitioners', String(practitioner?.id || '')]
            };
          });
      })
    );
  }

  private mergeSearchResults(items: SearchResultItem[]): SearchResultItem[] {
    const byKey = new Map<string, SearchResultItem>();

    items.forEach((item) => {
      const key = `${item.type}:${item.id}`;
      if (!item.id || byKey.has(key)) {
        return;
      }
      byKey.set(key, item);
    });

    return Array.from(byKey.values());
  }

  private filterByQuery(items: SearchResultItem[], query: string): SearchResultItem[] {
    const normalizedQuery = query.toLowerCase();
    return items.filter((item) => {
      const haystack = `${item.title} ${item.subtitle} ${item.description}`.toLowerCase();
      return haystack.includes(normalizedQuery);
    });
  }
}
