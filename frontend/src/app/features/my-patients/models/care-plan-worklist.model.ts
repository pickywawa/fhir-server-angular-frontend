export interface CarePlanWorklistItem {
  carePlanId: string;
  title: string;
  description: string;
  note: string;
  created: string;
  patientId: string;
  patientFirstName: string;
  patientLastName: string;
  patientBirthDate: string;
  patientGender: string;
  categoryCode: string;
  categoryLabel: string;
  status: string;
  intent: string;
}
