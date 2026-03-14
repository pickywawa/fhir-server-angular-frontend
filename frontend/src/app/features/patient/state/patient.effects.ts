import { Injectable, inject } from '@angular/core';
import { Actions, createEffect, ofType } from '@ngrx/effects';
import { of } from 'rxjs';
import { map, catchError, switchMap, tap } from 'rxjs/operators';
import { FhirPatientService } from '../services/fhir-patient.service';
import { ToastService } from '../../../core/services/toast.service';
import * as PatientActions from './patient.actions';

@Injectable()
export class PatientEffects {
  private actions$ = inject(Actions);
  private fhirPatientService = inject(FhirPatientService);
  private toastService = inject(ToastService);

  loadPatients$ = createEffect(() =>
    this.actions$.pipe(
      ofType(PatientActions.loadPatients),
      switchMap(() =>
        this.fhirPatientService.getPatients().pipe(
          map(patients => PatientActions.loadPatientsSuccess({ patients })),
          catchError(error => of(PatientActions.loadPatientsFailure({ error })))
        )
      )
    )
  );

  loadPatient$ = createEffect(() =>
    this.actions$.pipe(
      ofType(PatientActions.loadPatient),
      switchMap(action =>
        this.fhirPatientService.getPatient(action.id).pipe(
          map(patient => PatientActions.loadPatientSuccess({ patient })),
          catchError(error => of(PatientActions.loadPatientFailure({ error })))
        )
      )
    )
  );

  createPatient$ = createEffect(() =>
    this.actions$.pipe(
      ofType(PatientActions.createPatient),
      switchMap(action =>
        this.fhirPatientService.createPatient(action.patient).pipe(
          map(patient => PatientActions.createPatientSuccess({ patient })),
          catchError(error => of(PatientActions.createPatientFailure({ error })))
        )
      )
    )
  );

  updatePatient$ = createEffect(() =>
    this.actions$.pipe(
      ofType(PatientActions.updatePatient),
      switchMap(action =>
        this.fhirPatientService.updatePatient(action.id, action.patient).pipe(
          map(patient => PatientActions.updatePatientSuccess({ patient })),
          catchError(error => of(PatientActions.updatePatientFailure({ error })))
        )
      )
    )
  );

  deletePatient$ = createEffect(() =>
    this.actions$.pipe(
      ofType(PatientActions.deletePatient),
      switchMap(action =>
        this.fhirPatientService.deletePatient(action.id).pipe(
          map(() => PatientActions.deletePatientSuccess({ id: action.id })),
          catchError(error => of(PatientActions.deletePatientFailure({ error })))
        )
      )
    )
  );

  // Effet pour afficher le toast et réinitialiser après succès de modification
  updatePatientSuccess$ = createEffect(() =>
    this.actions$.pipe(
      ofType(PatientActions.updatePatientSuccess),
      tap(() => {
        this.toastService.success('Patient modifié avec succès !');
      }),
      map(() => PatientActions.selectPatient({ patient: null }))
    )
  );
}
