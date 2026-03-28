export interface CarePlanOption {
  id: string;
  title: string;
  created: string;
}

export interface CarePlanCategoryOption {
  code: string;
  label: string;
}

export interface PatientCarePlanFormValue {
  id: string;
  status: string;
  intent: string;
  categoryCode: string;
  title: string;
  description: string;
  note: string;
}

export interface PatientCarePlanLoadResult {
  carePlans: PatientCarePlanFormValue[];
  categories: CarePlanCategoryOption[];
}
