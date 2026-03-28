import { createFeatureSelector, createSelector } from '@ngrx/store';
import { PatientState } from './patient.reducer';

export const selectPatientState = createFeatureSelector<PatientState>('patient');

export const selectAllPatients = createSelector(
  selectPatientState,
  (state: PatientState) => state.patients
);

export const selectSelectedPatient = createSelector(
  selectPatientState,
  (state: PatientState) => state.selectedPatient
);

export const selectPatientLoading = createSelector(
  selectPatientState,
  (state: PatientState) => state.loading
);

export const selectPatientError = createSelector(
  selectPatientState,
  (state: PatientState) => state.error
);
