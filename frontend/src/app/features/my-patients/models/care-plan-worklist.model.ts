export interface CarePlanWorklistItem {
  carePlanId: string;
  title: string;
  description: string;
  note: string;
  created: string;
  lastChanged: string;
  patientId: string;
  patientFirstName: string;
  patientLastName: string;
  patientBirthName: string;
  patientBirthDate: string;
  patientGender: string;
  patientIpp: string;
  patientIns: string;
  identityStatus: 'validated' | 'provisional';
  practitionerDisplay: string;
  practitionerRole: string;
  categoryCode: string;
  categoryLabel: string;
  status: string;
  intent: string;
}
