import { HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { from, switchMap } from 'rxjs';
import { AuthService } from '../services/auth.service';

/**
 * Functional HTTP interceptor that attaches the Keycloak Bearer token
 * to every outgoing request when the user is authenticated.
 */
export const authInterceptor: HttpInterceptorFn = (req, next) => {
  const authService = inject(AuthService);

  if (!authService.isKeycloakReady()) {
    return next(req);
  }

  if (!authService.isAuthenticated()) {
    return next(req);
  }

  return from(authService.getToken()).pipe(
    switchMap(token => {
      const authReq = req.clone({
        headers: req.headers.set('Authorization', `Bearer ${token}`)
      });
      return next(authReq);
    })
  );
};
