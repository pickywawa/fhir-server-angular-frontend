import { createReducer, on } from '@ngrx/store';
import { Patient } from '../../../core/models/patient.model';
import * as PatientActions from './patient.actions';

export interface PatientState {
  patients: Patient[];
  selectedPatient: Patient | null;
  loading: boolean;
  error: any;
}

export const initialState: PatientState = {
  patients: [],
  selectedPatient: null,
  loading: false,
  error: null
};

export const patientReducer = createReducer(
  initialState,

  // Load Patients
  on(PatientActions.loadPatients, (state) => ({
    ...state,
    loading: true,
    error: null
  })),
  on(PatientActions.loadPatientsSuccess, (state, { patients }) => ({
    ...state,
    patients,
    loading: false
  })),
  on(PatientActions.loadPatientsFailure, (state, { error }) => ({
    ...state,
    loading: false,
    error
  })),

  // Load Patient
  on(PatientActions.loadPatient, (state) => ({
    ...state,
    loading: true,
    error: null
  })),
  on(PatientActions.loadPatientSuccess, (state, { patient }) => ({
    ...state,
    selectedPatient: patient,
    loading: false
  })),
  on(PatientActions.loadPatientFailure, (state, { error }) => ({
    ...state,
    loading: false,
    error
  })),

  // Create Patient
  on(PatientActions.createPatient, (state) => ({
    ...state,
    loading: true,
    error: null
  })),
  on(PatientActions.createPatientSuccess, (state, { patient }) => ({
    ...state,
    patients: [...state.patients, patient],
    loading: false
  })),
  on(PatientActions.createPatientFailure, (state, { error }) => ({
    ...state,
    loading: false,
    error
  })),

  // Update Patient
  on(PatientActions.updatePatient, (state) => ({
    ...state,
    loading: true,
    error: null
  })),
  on(PatientActions.updatePatientSuccess, (state, { patient }) => ({
    ...state,
    patients: state.patients.map(p => p.id === patient.id ? patient : p),
    selectedPatient: patient,
    loading: false
  })),
  on(PatientActions.updatePatientFailure, (state, { error }) => ({
    ...state,
    loading: false,
    error
  })),

  // Delete Patient
  on(PatientActions.deletePatient, (state) => ({
    ...state,
    loading: true,
    error: null
  })),
  on(PatientActions.deletePatientSuccess, (state, { id }) => ({
    ...state,
    patients: state.patients.filter(p => p.id !== id),
    loading: false
  })),
  on(PatientActions.deletePatientFailure, (state, { error }) => ({
    ...state,
    loading: false,
    error
  })),

  // Select Patient
  on(PatientActions.selectPatient, (state, { patient }) => ({
    ...state,
    selectedPatient: patient
  }))
);
