import { Injectable } from '@angular/core';
import { HttpParams } from '@angular/common/http';
import { Observable, of } from 'rxjs';
import { catchError, map, switchMap } from 'rxjs/operators';
import { ApiService } from './api.service';
import { AuthService } from './auth.service';

@Injectable({ providedIn: 'root' })
export class ConnectedPractitionerResolverService {
  private cachedReference = '';

  constructor(
    private readonly apiService: ApiService,
    private readonly authService: AuthService
  ) {}

  resolveReference(forceRefresh = false): Observable<string> {
    if (!forceRefresh && this.cachedReference) {
      return of(this.cachedReference);
    }

    const fromClaim = this.authService.getConnectedPractitionerId();
    if (fromClaim) {
      this.cachedReference = `Practitioner/${fromClaim}`;
      return of(this.cachedReference);
    }

    const hints = this.authService.getConnectedUserHints();

    return this.findByIdentifier(hints.username).pipe(
      switchMap((found) => found ? of(found) : this.findByEmail(hints.email)),
      switchMap((found) => found ? of(found) : this.findByName(hints.firstName, hints.lastName)),
      map((found) => {
        this.cachedReference = found;
        return found;
      })
    );
  }

  private findByIdentifier(identifier: string): Observable<string> {
    const value = String(identifier || '').trim();
    if (!value) {
      return of('');
    }

    const params = new HttpParams()
      .set('identifier:contains', value)
      .set('_count', '5');

    return this.findSingleReference(params);
  }

  private findByEmail(email: string): Observable<string> {
    const value = String(email || '').trim();
    if (!value) {
      return of('');
    }

    const params = new HttpParams()
      .set('email', value)
      .set('_count', '5');

    return this.findSingleReference(params);
  }

  private findByName(firstName: string, lastName: string): Observable<string> {
    const given = String(firstName || '').trim();
    const family = String(lastName || '').trim();
    if (!given || !family) {
      return of('');
    }

    const params = new HttpParams()
      .set('given', given)
      .set('family', family)
      .set('_count', '5');

    return this.findSingleReference(params);
  }

  private findSingleReference(params: HttpParams): Observable<string> {
    return this.apiService.get<any>('/Practitioner', { params }).pipe(
      map((bundle) => {
        const resources = (bundle?.entry || [])
          .map((entry: any) => entry?.resource)
          .filter((resource: any) => resource?.resourceType === 'Practitioner' && resource?.id)
          .map((resource: any) => String(resource.id));

        const uniqueIds = Array.from(new Set(resources));
        return uniqueIds.length === 1 ? `Practitioner/${uniqueIds[0]}` : '';
      }),
      catchError(() => of(''))
    );
  }
}
