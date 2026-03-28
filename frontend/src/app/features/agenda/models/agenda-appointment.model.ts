export type FhirAppointmentStatus =
  | 'proposed'
  | 'pending'
  | 'booked'
  | 'arrived'
  | 'fulfilled'
  | 'cancelled'
  | 'noshow'
  | 'entered-in-error'
  | 'checked-in'
  | 'waitlist';

export interface ResourceOption {
  id: string;
  reference: string;
  label: string;
  isSelf?: boolean;
}

export interface AgendaAppointment {
  id: string;
  title: string;
  status: FhirAppointmentStatus;
  start: string;
  end: string;
  typeCode: string;
  typeLabel: string;
  modelCode: string;
  modelLabel: string;
  description: string;
  comment: string;
  recurrence: string;
  patientParticipants: ResourceOption[];
  practitionerParticipants: ResourceOption[];
}

export interface AppointmentCreateInput {
  title: string;
  status: FhirAppointmentStatus;
  typeCode: string;
  typeLabel: string;
  modelCode: string;
  modelLabel: string;
  start: string;
  durationMinutes: number;
  recurrence: string;
  comment: string;
  patientReferences: string[];
  practitionerReferences: string[];
}

export interface AppointmentUpdateInput extends AppointmentCreateInput {
  id: string;
}

export interface WeekDayCell {
  key: string;
  label: string;
  date: Date;
}

export interface WeekRow {
  key: string;
  weekStart: Date;
  days: WeekDayCell[];
}

export const APPOINTMENT_STATUS_OPTIONS: Array<{ value: FhirAppointmentStatus; label: string }> = [
  { value: 'proposed', label: 'Proposed' },
  { value: 'pending', label: 'Pending' },
  { value: 'booked', label: 'Booked' },
  { value: 'arrived', label: 'Arrived' },
  { value: 'fulfilled', label: 'Fulfilled' },
  { value: 'checked-in', label: 'Checked-in' },
  { value: 'waitlist', label: 'Waitlist' },
  { value: 'cancelled', label: 'Cancelled' },
  { value: 'noshow', label: 'No-show' },
  { value: 'entered-in-error', label: 'Entered in error' }
];

export const APPOINTMENT_TYPE_OPTIONS: Array<{ code: string; label: string }> = [
  { code: 'consultation', label: 'Consultation' },
  { code: 'suivi', label: 'Suivi' },
  { code: 'urgence', label: 'Urgence' },
  { code: 'teleconsultation', label: 'Teleconsultation' }
];

export const APPOINTMENT_MODEL_OPTIONS: Array<{ code: string; label: string }> = [
  { code: 'presentiel', label: 'Presentiel' },
  { code: 'visio', label: 'Visio' },
  { code: 'telephone', label: 'Telephone' },
  { code: 'domicile', label: 'Domicile' }
];

export const RECURRENCE_OPTIONS: Array<{ value: string; label: string }> = [
  { value: 'none', label: 'Aucune' },
  { value: 'daily', label: 'Quotidienne' },
  { value: 'weekly', label: 'Hebdomadaire' },
  { value: 'monthly', label: 'Mensuelle' }
];
