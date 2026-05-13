import { Injectable } from '@angular/core';
import { HttpHeaders, HttpParams } from '@angular/common/http';
import { Observable, of } from 'rxjs';
import { map, catchError } from 'rxjs/operators';
import { switchMap } from 'rxjs/operators';
import { HttpClient } from '@angular/common/http';
import { ApiService } from '../../../../../core/services/api.service';
import {
  ProcedureSummary,
  ProcedureDetail,
  ProcedureSaveInput,
  PerformerOption,
  SnomedSuggestion,
  ProcedureStatus
} from '../models/patient-procedure.model';

@Injectable({ providedIn: 'root' })
export class FhirPatientProcedureService {
  private readonly endpoint = '/Procedure';

  private readonly fhirHeaders = new HttpHeaders({
    'Content-Type': 'application/fhir+json',
    Accept: 'application/fhir+json'
  });

  constructor(
    private readonly apiService: ApiService,
    private readonly http: HttpClient
  ) {}

  searchProceduresByPatient(patientId: string): Observable<ProcedureSummary[]> {
    const params = new HttpParams()
      .set('subject', `Patient/${patientId}`)
      .set('_count', '100')
      .set('_sort', '-date');

    return this.apiService.get<any>(this.endpoint, { params }).pipe(
      map((bundle) => {
        const entries = Array.isArray(bundle?.entry) ? bundle.entry : [];
        return entries
          .map((e: any) => this.convertToSummary(e?.resource))
          .filter((p: ProcedureSummary | null): p is ProcedureSummary => !!p);
      })
    );
  }

  getProcedure(id: string): Observable<ProcedureDetail> {
    return this.apiService.get<any>(`${this.endpoint}/${id}`).pipe(
      map((resource) => this.convertToDetail(resource))
    );
  }

  createProcedure(input: ProcedureSaveInput): Observable<ProcedureDetail> {
    const payload = this.buildPayload(input);
    return this.prepareProcedurePayloadWithReport(payload, input).pipe(
      switchMap((preparedPayload) =>
        this.apiService.post<any>(this.endpoint, preparedPayload, { headers: this.fhirHeaders })
      ),
      map((resource) => this.convertToDetail(resource))
    );
  }

  updateProcedure(id: string, input: ProcedureSaveInput): Observable<ProcedureDetail> {
    return this.apiService.get<any>(`${this.endpoint}/${id}`).pipe(
      switchMap((existing) => {
        const payload = { ...this.buildPayload(input), id };
        return this.prepareProcedurePayloadWithReport(payload, input, existing).pipe(
          switchMap((preparedPayload) =>
            this.apiService.put<any>(`${this.endpoint}/${id}`, preparedPayload, { headers: this.fhirHeaders })
          )
        );
      }),
      map((resource) => this.convertToDetail(resource))
    );
  }

  getDiagnosticReportConclusion(reportReference: string): Observable<string> {
    const trimmed = String(reportReference || '').trim();
    if (!trimmed) {
      return of('');
    }

    const ref = trimmed.startsWith('DiagnosticReport/')
      ? trimmed
      : `DiagnosticReport/${trimmed}`;

    return this.apiService.get<any>(`/${ref}`).pipe(
      map((resource) => String(resource?.conclusion || '').trim()),
      catchError(() => of(''))
    );
  }

  /**
   * SNOMED CT procedure code search via NLM Clinical Tables API.
   * Uses the SNOMED procedures value set.
   */
  searchSnomedProcedures(query: string, limit = 12): Observable<SnomedSuggestion[]> {
    const q = query.trim();
    if (q.length < 2) return of([]);

    const params = new HttpParams()
      .set('terms', q)
      .set('maxList', String(limit))
      .set('ef', 'PT')
      .set('df', 'PT');

    return this.http
      .get<any>('https://clinicaltables.nlm.nih.gov/api/snomed_ct_procedures/v3/search', { params })
      .pipe(
        map((response) => this.parseSnomedResponse(response)),
        switchMap((parsed) => {
          if (parsed.length > 0) {
            return of(parsed);
          }

          const genericParams = new HttpParams()
            .set('terms', q)
            .set('maxList', String(limit))
            .set('df', 'PT')
            .set('ef', 'PT');

          return this.http
            .get<any>('https://clinicaltables.nlm.nih.gov/api/snomed_ct/v3/search', { params: genericParams })
            .pipe(
              map((response) => this.parseSnomedResponse(response)),
              catchError(() => of([]))
            );
        }),
        catchError(() => of([]))
      );
  }

  searchPractitioners(query: string, limit = 10): Observable<PerformerOption[]> {
    const trimmed = query.trim();
    if (trimmed.length < 2) return of([]);

    const parts = trimmed.split(/\s+/).filter(Boolean);
    const first = parts[0] || '';
    const last = parts[parts.length - 1] || '';

    const searches: Observable<PerformerOption[]>[] = [
      this.fetchPractitionerOptions({ family: first, limit }),
      this.fetchPractitionerOptions({ given: first, limit })
    ];

    if (parts.length >= 2) {
      searches.push(this.fetchPractitionerOptions({ given: first, family: last, limit }));
    }

    return new Observable<PerformerOption[]>((observer) => {
      const results: PerformerOption[] = [];
      let completed = 0;
      searches.forEach((obs) => {
        obs.pipe(catchError(() => of([]))).subscribe({
          next: (items) => results.push(...items),
          error: () => { completed++; if (completed === searches.length) { observer.next(this.mergeByRef(results)); observer.complete(); } },
          complete: () => { completed++; if (completed === searches.length) { observer.next(this.mergeByRef(results)); observer.complete(); } }
        });
      });
    });
  }

  private fetchPractitionerOptions(criteria: { family?: string; given?: string; limit: number }): Observable<PerformerOption[]> {
    let params = new HttpParams().set('_count', String(criteria.limit));
    if (criteria.family?.trim()) params = params.set('family', criteria.family.trim());
    if (criteria.given?.trim()) params = params.set('given', criteria.given.trim());

    return this.apiService.get<any>('/Practitioner', { params }).pipe(
      map((bundle) => {
        if (!bundle?.entry) return [];
        return bundle.entry
          .map((e: any) => e?.resource)
          .filter((r: any) => r?.resourceType === 'Practitioner')
          .map((p: any): PerformerOption => {
            const family = p?.name?.[0]?.family || '';
            const given = p?.name?.[0]?.given?.[0] || '';
            const label = `${given} ${family}`.trim() || `Practitioner/${p.id}`;
            return { id: p.id, reference: `Practitioner/${p.id}`, label };
          });
      })
    );
  }

  private mergeByRef(items: PerformerOption[]): PerformerOption[] {
    const map = new Map<string, PerformerOption>();
    items.forEach((i) => { if (!map.has(i.reference)) map.set(i.reference, i); });
    return Array.from(map.values());
  }

  private parseSnomedResponse(response: any): SnomedSuggestion[] {
    if (!Array.isArray(response) || response.length < 2) return [];
    const codes: string[] = Array.isArray(response[1]) ? response[1] : [];
    const extraFields: Record<string, string[] | string> = response[2] ?? {};
    const ptFromEf = extraFields['PT'];
    const pts: string[] = Array.isArray(ptFromEf)
      ? ptFromEf
      : (Array.isArray(response[3]) ? response[3].map((row: any) => String(Array.isArray(row) ? row[0] : row || '')) : []);

    return codes.map((code, i) => ({
      code,
      display: pts[i] ?? code,
      system: 'http://snomed.info/sct'
    }));
  }

  private prepareProcedurePayloadWithReport(payload: any, input: ProcedureSaveInput, existingProcedure?: any): Observable<any> {
    const conclusion = String(input.diagnosticReportConclusion || '').trim();
    const existingReportRef = String(existingProcedure?.report?.[0]?.reference || '').trim();

    if (conclusion) {
      return this.upsertDiagnosticReport(conclusion, input, existingReportRef).pipe(
        map((reportReference) => ({
          ...payload,
          report: [{ reference: reportReference }]
        }))
      );
    }

    if (existingReportRef) {
      return of({
        ...payload,
        report: [{ reference: existingReportRef }]
      });
    }

    return of(payload);
  }

  private upsertDiagnosticReport(
    conclusion: string,
    input: ProcedureSaveInput,
    existingReportReference?: string
  ): Observable<string> {
    const existingId = this.extractIdFromReference(existingReportReference || '', 'DiagnosticReport');
    const resource = this.buildDiagnosticReportResource(conclusion, input, existingId);

    if (existingId) {
      return this.apiService.put<any>(`/DiagnosticReport/${existingId}`, resource, { headers: this.fhirHeaders }).pipe(
        map((updated) => {
          const id = String(updated?.id || existingId).trim();
          return `DiagnosticReport/${id}`;
        })
      );
    }

    return this.apiService.post<any>('/DiagnosticReport', resource, { headers: this.fhirHeaders }).pipe(
      map((created) => {
        const id = String(created?.id || '').trim();
        return `DiagnosticReport/${id}`;
      })
    );
  }

  private buildDiagnosticReportResource(conclusion: string, input: ProcedureSaveInput, existingId?: string): any {
    const effectiveDateTime = this.normalizeDateTime(input.occurrenceEnd || input.occurrenceStart);
    const firstPerformer = input.performers[0];

    return {
      resourceType: 'DiagnosticReport',
      ...(existingId ? { id: existingId } : {}),
      status: 'final',
      code: {
        coding: [
          {
            system: input.codeSystem || 'http://snomed.info/sct',
            code: input.codeCode,
            display: input.codeDisplay
          }
        ],
        text: input.codeDisplay
      },
      subject: {
        reference: input.patientReference
      },
      effectiveDateTime,
      issued: new Date().toISOString(),
      ...(firstPerformer
        ? {
            performer: [
              {
                reference: firstPerformer.reference,
                display: firstPerformer.label
              }
            ]
          }
        : {}),
      ...(input.basedOnReference ? { basedOn: [{ reference: input.basedOnReference }] } : {}),
      conclusion
    };
  }

  private normalizeDateTime(value: string): string {
    const trimmed = String(value || '').trim();
    if (!trimmed) {
      return new Date().toISOString();
    }
    if (trimmed.length === 16) {
      return `${trimmed}:00`;
    }
    return trimmed;
  }

  private extractIdFromReference(reference: string, resourceType: string): string {
    const normalized = String(reference || '').trim();
    if (!normalized) {
      return '';
    }

    const marker = `${resourceType}/`;
    const index = normalized.lastIndexOf(marker);
    if (index >= 0) {
      return normalized.slice(index + marker.length).trim();
    }

    if (!normalized.includes('/')) {
      return normalized;
    }

    return '';
  }

  private buildPayload(input: ProcedureSaveInput): any {
    const payload: any = {
      resourceType: 'Procedure',
      status: input.status,
      code: {
        coding: [
          {
            system: input.codeSystem || 'http://snomed.info/sct',
            code: input.codeCode,
            display: input.codeDisplay
          }
        ],
        text: input.codeDisplay
      },
      subject: { reference: input.patientReference }
    };

    if (input.basedOnReference) {
      payload['basedOn'] = [{ reference: input.basedOnReference }];
    }

    const start = input.occurrenceStart?.length === 16
      ? `${input.occurrenceStart}:00`
      : input.occurrenceStart;
    const end = input.occurrenceEnd?.length === 16
      ? `${input.occurrenceEnd}:00`
      : input.occurrenceEnd;

    if (start) {
      payload['occurrencePeriod'] = { start };
      if (end) payload['occurrencePeriod']['end'] = end;
    }

    if (input.recorded) {
      const rec = input.recorded.length === 16 ? `${input.recorded}:00` : input.recorded;
      payload['recorded'] = rec;
    }

    if (input.recorderReference) {
      payload['recorder'] = { reference: input.recorderReference };
    }

    if (input.performers.length > 0) {
      payload['performer'] = input.performers.map((p) => ({
        actor: { reference: p.reference, display: p.label }
      }));
    }

    if (input.location?.trim()) {
      payload['location'] = { display: input.location.trim() };
    }

    if (input.note?.trim()) {
      payload['note'] = [{ text: input.note.trim() }];
    }

    return payload;
  }

  private convertToSummary(resource: any): ProcedureSummary | null {
    if (!resource?.resourceType || resource.resourceType !== 'Procedure') return null;
    return this.extractBase(resource);
  }

  private convertToDetail(resource: any): ProcedureDetail {
    const base = this.extractBase(resource);
    const performers: PerformerOption[] = (resource?.performer ?? []).map((p: any, i: number) => ({
      id: String(i),
      reference: p?.actor?.reference ?? '',
      label: p?.actor?.display ?? p?.actor?.reference ?? ''
    }));

    return {
      ...base,
      subjectReference: resource?.subject?.reference,
      basedOnReference: resource?.basedOn?.[0]?.reference,
      recorderReference: resource?.recorder?.reference,
      performerReferences: performers,
      reportReference: resource?.report?.[0]?.reference
    };
  }

  private extractBase(resource: any): ProcedureSummary {
    const catCoding = resource?.category?.coding?.[0];
    const codeCoding = resource?.code?.coding?.[0];
    const performers: string[] = (resource?.performer ?? []).map(
      (p: any) => p?.actor?.display ?? p?.actor?.reference ?? ''
    );

    return {
      id: resource?.id ?? '',
      status: (resource?.status ?? 'unknown') as ProcedureStatus,
      categoryCode: catCoding?.code ?? '',
      categoryDisplay: catCoding?.display ?? catCoding?.code ?? '',
      codeCode: codeCoding?.code ?? '',
      codeDisplay: codeCoding?.display ?? resource?.code?.text ?? '',
      codeSystem: codeCoding?.system ?? '',
      occurrenceStart: resource?.occurrencePeriod?.start ?? resource?.occurrenceDateTime,
      occurrenceEnd: resource?.occurrencePeriod?.end,
      recorded: resource?.recorded,
      location: resource?.location?.display ?? resource?.location?.reference,
      performerDisplays: performers,
      hasReport: Array.isArray(resource?.report) && resource.report.length > 0,
      note: resource?.note?.[0]?.text
    };
  }
}
