import { APP_INITIALIZER, ApplicationConfig, importProvidersFrom, provideZoneChangeDetection } from '@angular/core';
import { provideRouter } from '@angular/router';
import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { provideStore } from '@ngrx/store';
import { provideEffects } from '@ngrx/effects';
import { provideStoreDevtools } from '@ngrx/store-devtools';
import { TranslateModule } from '@ngx-translate/core';
import { provideTranslateHttpLoader } from '@ngx-translate/http-loader';

import { routes } from './app.routes';
import { patientReducer } from './features/my-patients/state/patient.reducer';
import { PatientEffects } from './features/my-patients/state/patient.effects';
import { authInterceptor } from './core/interceptors/auth.interceptor';
import { AuthService } from './core/services/auth.service';

export const appConfig: ApplicationConfig = {
  providers: [
    provideZoneChangeDetection({ eventCoalescing: true }),
    provideRouter(routes),
    provideHttpClient(withInterceptors([authInterceptor])),
    importProvidersFrom(TranslateModule.forRoot({ defaultLanguage: 'fr' })),
    ...provideTranslateHttpLoader({
      prefix: '/i18n/',
      suffix: '.json'
    }),
    provideStore({ patient: patientReducer }),
    provideEffects([PatientEffects]),
    provideStoreDevtools({ maxAge: 25, logOnly: false }),
    {
      provide: APP_INITIALIZER,
      useFactory: (authService: AuthService) => () => authService.init(),
      deps: [AuthService],
      multi: true
    }
  ]
};
