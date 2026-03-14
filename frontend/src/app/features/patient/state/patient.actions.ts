import { createAction, props } from '@ngrx/store';
import { Patient } from '../../../core/models/patient.model';

// Load Patients
export const loadPatients = createAction('[Patient] Load Patients');
export const loadPatientsSuccess = createAction(
  '[Patient] Load Patients Success',
  props<{ patients: Patient[] }>()
);
export const loadPatientsFailure = createAction(
  '[Patient] Load Patients Failure',
  props<{ error: any }>()
);

// Load Patient by ID
export const loadPatient = createAction(
  '[Patient] Load Patient',
  props<{ id: string }>()
);
export const loadPatientSuccess = createAction(
  '[Patient] Load Patient Success',
  props<{ patient: Patient }>()
);
export const loadPatientFailure = createAction(
  '[Patient] Load Patient Failure',
  props<{ error: any }>()
);

// Create Patient
export const createPatient = createAction(
  '[Patient] Create Patient',
  props<{ patient: Patient }>()
);
export const createPatientSuccess = createAction(
  '[Patient] Create Patient Success',
  props<{ patient: Patient }>()
);
export const createPatientFailure = createAction(
  '[Patient] Create Patient Failure',
  props<{ error: any }>()
);

// Update Patient
export const updatePatient = createAction(
  '[Patient] Update Patient',
  props<{ id: string; patient: Patient }>()
);
export const updatePatientSuccess = createAction(
  '[Patient] Update Patient Success',
  props<{ patient: Patient }>()
);
export const updatePatientFailure = createAction(
  '[Patient] Update Patient Failure',
  props<{ error: any }>()
);

// Delete Patient
export const deletePatient = createAction(
  '[Patient] Delete Patient',
  props<{ id: string }>()
);
export const deletePatientSuccess = createAction(
  '[Patient] Delete Patient Success',
  props<{ id: string }>()
);
export const deletePatientFailure = createAction(
  '[Patient] Delete Patient Failure',
  props<{ error: any }>()
);

// Select Patient for Editing
export const selectPatient = createAction(
  '[Patient] Select Patient',
  props<{ patient: Patient | null }>()
);

