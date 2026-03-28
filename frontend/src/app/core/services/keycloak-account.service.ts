import { Injectable } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { from, Observable, switchMap } from 'rxjs';
import { environment } from '../../../environments/environment';
import { AuthService } from './auth.service';

export interface KeycloakAccountInfo {
  username?: string;
  email?: string;
  firstName?: string;
  lastName?: string;
  attributes?: Record<string, string[]>;
}

@Injectable({ providedIn: 'root' })
export class KeycloakAccountService {
  private readonly accountUrl = `${environment.keycloakUrl}/realms/${environment.keycloakRealm}/account`;

  constructor(
    private readonly http: HttpClient,
    private readonly authService: AuthService
  ) {}

  getAccountInfo(): Observable<KeycloakAccountInfo> {
    return from(this.authService.getToken()).pipe(
      switchMap(token =>
        this.http.get<KeycloakAccountInfo>(this.accountUrl, {
          headers: new HttpHeaders({ Authorization: `Bearer ${token}` })
        })
      )
    );
  }

  updateAccountInfo(info: KeycloakAccountInfo): Observable<void> {
    return from(this.authService.getToken()).pipe(
      switchMap(token =>
        this.http.post<void>(this.accountUrl, info, {
          headers: new HttpHeaders({
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json'
          })
        })
      )
    );
  }
}
