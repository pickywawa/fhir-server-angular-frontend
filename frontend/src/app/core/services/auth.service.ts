import { Injectable } from '@angular/core';
import Keycloak from 'keycloak-js';
import { environment } from '../../../environments/environment';

@Injectable({
  providedIn: 'root'
})
export class AuthService {
  private keycloakReady = true;

  private keycloak: Keycloak = new Keycloak({
    url: environment.keycloakUrl,
    realm: environment.keycloakRealm,
    clientId: environment.keycloakClientId
  });

  /**
   * Called once at application startup via APP_INITIALIZER.
   * Uses check-sso so that already-authenticated users are silently recognized,
   * while unauthenticated users continue to the app (the AuthGuard will redirect them).
   */
  init(): Promise<boolean> {
    const initPromise = this.keycloak.init({
      onLoad: 'check-sso',
      pkceMethod: 'S256',
      checkLoginIframe: false
    });

    const timeoutPromise = new Promise<boolean>((resolve) => {
      window.setTimeout(() => resolve(false), 3500);
    });

    return Promise.race([initPromise, timeoutPromise])
      .catch(() => false)
      .then((initialized) => {
        if (!initialized) {
          this.keycloakReady = false;
        }
        return initialized;
      });
  }

  /** Redirects browser to the Keycloak login page. */
  login(): Promise<void> {
    return this.keycloak.login({
      redirectUri: window.location.origin
    });
  }

  /** Logs the user out and redirects back to the app root. */
  logout(): Promise<void> {
    return this.keycloak.logout({
      redirectUri: window.location.origin
    });
  }

  isAuthenticated(): boolean {
    return !!this.keycloak.authenticated;
  }

  isKeycloakReady(): boolean {
    return this.keycloakReady;
  }

  /**
   * Returns a fresh (or refreshed) access token.
   * Automatically refreshes if it expires within the next 30 seconds.
   */
  getToken(): Promise<string> {
    if (!this.keycloakReady) {
      return Promise.resolve('');
    }

    return this.keycloak.updateToken(30).then(() => this.keycloak.token ?? '');
  }

  getUsername(): string {
    return this.keycloak.tokenParsed?.['preferred_username'] ?? '';
  }

  getConnectedPractitionerId(): string {
    const claims = this.keycloak.tokenParsed as Record<string, unknown> | undefined;
    const claimKeys = [
      'practitioner_id',
      'practitionerId',
      'practitioner',
      'practitioner_reference',
      'practitionerReference',
      'fhir_practitioner_id',
      'fhirPractitionerId'
    ];

    for (const key of claimKeys) {
      const normalized = this.normalizePractitionerId(claims?.[key]);
      if (normalized) {
        return normalized;
      }
    }

    return '';
  }

  getPhoneNumber(): string {
    const claims = this.keycloak.tokenParsed as Record<string, unknown> | undefined;
    const pick = (key: string): string => {
      const v = claims?.[key];
      return typeof v === 'string' ? v.trim() : '';
    };
    return pick('phone_number') || pick('phoneNumber') || pick('mobile_phone') || '';
  }

  getConnectedUserHints(): {
    username: string;
    email: string;
    firstName: string;
    lastName: string;
  } {
    const claims = this.keycloak.tokenParsed as Record<string, unknown> | undefined;
    const pick = (key: string): string => {
      const value = claims?.[key];
      return typeof value === 'string' ? value.trim() : '';
    };

    return {
      username: this.getUsername().trim(),
      email: pick('email'),
      firstName: pick('given_name'),
      lastName: pick('family_name')
    };
  }

  getUserInfo(): {
    firstName: string;
    lastName: string;
    fullName: string;
    email: string;
    avatarInitials: string;
  } {
    const claims = this.keycloak.tokenParsed as Record<string, unknown> | undefined;
    const claim = (key: string): string => {
      const value = claims?.[key];
      return typeof value === 'string' ? value : '';
    };

    const firstName = claim('given_name');
    const lastName = claim('family_name');
    const username = claim('preferred_username');
    const email = claim('email');
    const fallbackName = claim('name') || username || 'Utilisateur';
    const fullName = `${firstName} ${lastName}`.trim() || fallbackName;

    const initialsSource = `${firstName} ${lastName}`.trim() || fallbackName;
    const avatarInitials = initialsSource
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((part) => part.charAt(0).toUpperCase())
      .join('') || 'U';

    return {
      firstName,
      lastName,
      fullName,
      email: email || username || 'profil@local',
      avatarInitials
    };
  }

  private normalizePractitionerId(raw: unknown): string {
    const value = String(raw ?? '').trim();
    if (!value) {
      return '';
    }

    const forbiddenValues = new Set(['openid', 'profile', 'email', 'roles', 'offline_access', 'microprofile-jwt']);
    if (forbiddenValues.has(value)) {
      return '';
    }

    const marker = 'Practitioner/';
    const markerIndex = value.lastIndexOf(marker);
    if (markerIndex >= 0) {
      return value.slice(markerIndex + marker.length).trim();
    }

    const directPrefixes = ['practitioner:', 'practitioner_id:', 'pro:', 'practitioner='];
    for (const prefix of directPrefixes) {
      if (value.toLowerCase().startsWith(prefix)) {
        return value.slice(prefix.length).trim();
      }
    }

    return value.includes('/') ? '' : value;
  }
}
