import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable, map } from 'rxjs';

export interface BanAddressSuggestion {
  label: string;
  city: string;
  postcode: string;
}

@Injectable({
  providedIn: 'root'
})
export class BanAddressService {
  private readonly http = inject(HttpClient);
  private readonly endpoint = 'https://api-adresse.data.gouv.fr/search/';

  searchAddresses(query: string, limit = 5): Observable<BanAddressSuggestion[]> {
    const q = query.trim();
    if (!q) {
      return new Observable<BanAddressSuggestion[]>((subscriber) => {
        subscriber.next([]);
        subscriber.complete();
      });
    }

    const params = new HttpParams()
      .set('q', q)
      .set('limit', String(limit))
      .set('autocomplete', '1');

    return this.http.get<any>(this.endpoint, { params }).pipe(
      map((response) => {
        const features = response?.features ?? [];
        return features.map((feature: any) => ({
          label: feature?.properties?.label ?? '',
          city: feature?.properties?.city ?? '',
          postcode: feature?.properties?.postcode ?? ''
        }));
      })
    );
  }
}
