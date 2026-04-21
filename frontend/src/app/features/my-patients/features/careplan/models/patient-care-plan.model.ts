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
  activityReferences?: string[];
  lastUpdated?: string;
}

export interface PatientCarePlanLoadResult {
  carePlans: PatientCarePlanFormValue[];
  categories: CarePlanCategoryOption[];
}

export interface TaskConfig {
  taskReference: string; // Reference to the Task
  taskLabel: string; // Label/title of the task
  description?: string; // Description from the original Task
  participantType?: string;
  timing?: string;
  requestedPerformer?: {
    practitionerId: string;
    practitionerName: string;
    role: string;
    roleDisplay: string;
  };
  priority?: string; // routine, urgent, asap, stat
  requestedPeriodStart?: string; // ISO date
  requestedPeriodEnd?: string; // ISO date
  authoredOn?: string; // ISO date (auto-set to now)
  requesterPractitionerId?: string; // Auto set
  status?: 'draft' | 'requested' | 'received' | 'accepted' | 'rejected' | 'ready' | 'cancelled' | 'in-progress' | 'on-hold' | 'completed' | 'failed' | 'entered-in-error';
}
