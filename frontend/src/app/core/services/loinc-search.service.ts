import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable, of } from 'rxjs';
import { map, catchError } from 'rxjs/operators';

export interface LoincSuggestion {
  code: string;
  display: string;
  component?: string;
  system: string;
}

@Injectable({ providedIn: 'root' })
export class LoincSearchService {
  private readonly http = inject(HttpClient);

  /**
   * NLM Clinical Tables LOINC search API — CORS-enabled, no auth required.
   * Searches across code number AND long common name (includes French translations when available).
   * Docs: https://clinicaltables.nlm.nih.gov/apidoc/loinc_items/v3/doc.html
   */
  private readonly endpoint = 'https://clinicaltables.nlm.nih.gov/api/loinc_items/v3/search';

  searchCodes(query: string, limit = 12): Observable<LoincSuggestion[]> {
    const q = query.trim();
    if (q.length < 2) {
      return of([]);
    }

    const params = new HttpParams()
      .set('terms', q)
      .set('maxList', String(limit))
      .set('ef', 'LONG_COMMON_NAME,COMPONENT');

    return this.http.get<any>(this.endpoint, { params }).pipe(
      map((response) => this.parseResponse(response)),
      catchError(() => of([]))
    );
  }

  /**
   * Response format: [total, codes[], {ef_field: values[]}, displayStrings[]]
   * - response[1]: array of LOINC codes
   * - response[2].LONG_COMMON_NAME: array of long common names
   * - response[2].COMPONENT: array of component names (what is measured)
   */
  private parseResponse(response: any): LoincSuggestion[] {
    if (!Array.isArray(response) || response.length < 2) {
      return [];
    }

    const codes: string[] = Array.isArray(response[1]) ? response[1] : [];
    const extraFields: Record<string, string[]> = response[2] ?? {};
    const longNames: string[] = extraFields['LONG_COMMON_NAME'] ?? [];
    const components: string[] = extraFields['COMPONENT'] ?? [];

    return codes.map((code, i) => ({
      code,
      display: longNames[i] ?? code,
      component: components[i] ?? undefined,
      system: 'http://loinc.org'
    }));
  }
}
