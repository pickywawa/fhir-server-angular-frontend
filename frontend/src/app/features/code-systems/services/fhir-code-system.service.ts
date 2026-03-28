import { Injectable } from '@angular/core';
import { HttpHeaders, HttpParams } from '@angular/common/http';
import { Observable, map } from 'rxjs';
import { ApiService } from '../../../core/services/api.service';
import { CodeSystemDetail, CodeSystemSummary, CreateCodeSystemInput } from '../models/code-system.model';

@Injectable({ providedIn: 'root' })
export class FhirCodeSystemService {
  private readonly endpoint = '/CodeSystem';
  private readonly fhirHeaders = new HttpHeaders({
    'Content-Type': 'application/fhir+json',
    Accept: 'application/fhir+json'
  });

  constructor(private readonly apiService: ApiService) {}

  listCodeSystems(limit = 200): Observable<CodeSystemSummary[]> {
    const params = new HttpParams()
      .set('_count', String(limit))
      .set('_sort', '-_lastUpdated');

    return this.apiService.get<any>(this.endpoint, { params }).pipe(
      map((bundle) => this.convertBundle(bundle))
    );
  }

  getCodeSystem(id: string): Observable<CodeSystemDetail> {
    return this.apiService.get<any>(`${this.endpoint}/${id}`).pipe(
      map((resource) => {
        const converted = this.convertDetailResource(resource);
        if (!converted) {
          throw new Error('Invalid CodeSystem response');
        }
        return converted;
      })
    );
  }

  createCodeSystem(input: CreateCodeSystemInput): Observable<CodeSystemSummary> {
    const payload = {
      resourceType: 'CodeSystem',
      url: input.url.trim(),
      status: 'active',
      content: 'complete',
      concept: input.concepts
        .map((item) => ({ code: item.code.trim(), display: item.display.trim() }))
        .filter((item) => item.code.length > 0 && item.display.length > 0)
    };

    return this.apiService.post<any>(this.endpoint, payload, { headers: this.fhirHeaders }).pipe(
      map((resource) => {
        const converted = this.convertResource(resource);
        if (!converted) {
          throw new Error('Invalid CodeSystem response');
        }
        return converted;
      })
    );
  }

  updateCodeSystem(id: string, input: CreateCodeSystemInput): Observable<CodeSystemSummary> {
    const payload = {
      resourceType: 'CodeSystem',
      id,
      url: input.url.trim(),
      status: 'active',
      content: 'complete',
      concept: input.concepts
        .map((item) => ({ code: item.code.trim(), display: item.display.trim() }))
        .filter((item) => item.code.length > 0 && item.display.length > 0)
    };

    return this.apiService.put<any>(`${this.endpoint}/${id}`, payload, { headers: this.fhirHeaders }).pipe(
      map((resource) => {
        const converted = this.convertResource(resource);
        if (!converted) {
          throw new Error('Invalid CodeSystem response');
        }
        return converted;
      })
    );
  }

  private convertBundle(bundle: any): CodeSystemSummary[] {
    if (!bundle?.entry) {
      return [];
    }

    return bundle.entry
      .map((entry: any) => this.convertResource(entry?.resource))
      .filter((item: CodeSystemSummary | null): item is CodeSystemSummary => !!item);
  }

  private convertResource(resource: any): CodeSystemSummary | null {
    if (!resource?.id) {
      return null;
    }

    return {
      id: String(resource.id),
      url: String(resource.url || ''),
      title: String(resource.title || resource.name || resource.url || resource.id),
      status: String(resource.status || 'unknown'),
      conceptCount: Array.isArray(resource.concept) ? resource.concept.length : 0
    };
  }

  private convertDetailResource(resource: any): CodeSystemDetail | null {
    const summary = this.convertResource(resource);
    if (!summary) {
      return null;
    }

    const concepts = Array.isArray(resource.concept)
      ? resource.concept
        .map((item: any) => ({
          code: String(item?.code || '').trim(),
          display: String(item?.display || '').trim()
        }))
        .filter((item: { code: string; display: string }) => item.code.length > 0 || item.display.length > 0)
      : [];

    return {
      ...summary,
      concepts
    };
  }
}
