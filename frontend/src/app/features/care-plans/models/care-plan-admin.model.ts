export type CarePlansTab = 'plans' | 'actions' | 'objectives';

export interface LinkedReferenceOption {
  id: string;
  reference: string;
  label: string;
}

export interface CarePlanSummary {
  id: string;
  title: string;
  description: string;
  status: string;
  version: string;
  goalRefs: string[];
  actionRefs: string[];
  steps: CarePlanStep[];
  lastUpdated: string;
}

export interface CarePlanDetail extends CarePlanSummary {}

export type CarePlanStepType = 'questionnaire' | 'appointment' | 'communication' | 'task';

export interface CarePlanStep {
  uid?: string;
  title: string;
  description: string;
  priority: string;
  type: CarePlanStepType;
  questionnaireRef: string;
  activityDefinitionRef: string;
  communicationMessage: string;
  taskRef: string;
}

export interface CareActionSummary {
  id: string;
  title: string;
  description: string;
  code: string;
  status: string;
  priority: string;
  required: boolean;
  goalRefs: string[];
  relatedActionRefs: string[];
  definition: string;
  timing: string;
  participantType: string;
  participantRole: string;
  requestedPeriodStart: string;
  requestedPeriodEnd: string;
  conditions: string[];
  lastUpdated: string;
}

export interface CareActionDetail extends CareActionSummary {}

export interface CareGoalSummary {
  id: string;
  title: string;
  description: string;
  lifecycleStatus: string;
  achievementStatus: string;
  priority: string;
  dueDate: string;
  lastUpdated: string;
}

export interface CareGoalDetail extends CareGoalSummary {}

export interface CarePlanUpsertPayload {
  id?: string;
  title: string;
  description: string;
  status: string;
  version: string;
  goalRefs: string[];
  actionRefs: string[];
  steps: CarePlanStep[];
}

export interface CareActionUpsertPayload {
  id?: string;
  title: string;
  description: string;
  code: string;
  status: string;
  priority: string;
  required: boolean;
  goalRefs: string[];
  relatedActionRefs: string[];
  definition: string;
  timing: string;
  participantType: string;
  participantRole: string;
  conditions: string[];
}

export interface CareGoalUpsertPayload {
  id?: string;
  title: string;
  description: string;
  lifecycleStatus: string;
  achievementStatus: string;
  priority: string;
  dueDate: string;
}

export const CARE_PLAN_STATUS_OPTIONS = [
  'draft',
  'active',
  'retired',
  'unknown'
];

export const CARE_PLAN_STEP_TYPE_OPTIONS: Array<{ value: CarePlanStepType; label: string }> = [
  { value: 'questionnaire', label: 'Questionnaire' },
  { value: 'appointment', label: 'RDV' },
  { value: 'communication', label: 'Communication' },
  { value: 'task', label: 'Task' }
];

export const CARE_ACTION_STATUS_OPTIONS = [
  'draft',
  'requested',
  'received',
  'accepted',
  'rejected',
  'ready',
  'cancelled',
  'in-progress',
  'on-hold',
  'failed',
  'completed',
  'entered-in-error'
];

export const CARE_PRIORITY_OPTIONS = ['routine', 'urgent', 'asap', 'stat'];

export const CARE_DEFINITION_OPTIONS = [
  'task',
  'appointment',
  'communication',
  'service-request',
  'procedure',
  'other'
];

// Based on common FHIR TimingAbbreviation codes for display and filtering.
export const CARE_ACTION_TIMING_OPTIONS = [
  'HS',
  'WAKE',
  'C',
  'CM',
  'CD',
  'CV',
  'AC',
  'ACM',
  'ACD',
  'ACV',
  'PC',
  'PCM',
  'PCD',
  'PCV',
  'MORN',
  'AFT',
  'EVE',
  'NIGHT',
  'PHS',
  'IMD',
  'PRN',
  'QD',
  'BID',
  'TID',
  'QID',
  'QOD',
  'Q4H',
  'Q6H',
  'Q8H',
  'Q12H'
];

export const CARE_ACTION_PARTICIPANT_TYPE_OPTIONS = [
  'patient',
  'practitioner',
  'related-person',
  'caregiver',
  'organization',
  'care-team'
];

export const CARE_ACTION_PARTICIPANT_ROLE_OPTIONS = [
  'general-practitioner',
  'specialist',
  'nurse',
  'pharmacist',
  'physiotherapist',
  'dietitian',
  'psychologist',
  'social-worker',
  'care-coordinator',
  'case-manager',
  'family-caregiver',
  'self'
];

export const CARE_GOAL_LIFECYCLE_OPTIONS = [
  'proposed',
  'planned',
  'accepted',
  'active',
  'on-hold',
  'completed',
  'cancelled',
  'entered-in-error',
  'rejected'
];

export const CARE_GOAL_ACHIEVEMENT_OPTIONS = [
  'in-progress',
  'improving',
  'worsening',
  'no-change',
  'achieved',
  'sustaining',
  'not-achieved',
  'no-progress',
  'not-attainable'
];

// Task priority levels (FHIR)
export const TASK_PRIORITY_OPTIONS = [
  { value: 'routine', label: 'Routine' },
  { value: 'urgent', label: 'Urgent' },
  { value: 'asap', label: 'ASAP' },
  { value: 'stat', label: 'Stat' }
];

// Task status options
export const TASK_STATUS_OPTIONS = [
  { value: 'draft', label: 'Brouillon' },
  { value: 'requested', label: 'Demandée' },
  { value: 'received', label: 'Reçue' },
  { value: 'accepted', label: 'Acceptée' },
  { value: 'rejected', label: 'Rejetée' },
  { value: 'ready', label: 'Prête' },
  { value: 'cancelled', label: 'Annulée' },
  { value: 'in-progress', label: 'En cours' },
  { value: 'on-hold', label: 'En pause' },
  { value: 'completed', label: 'Complétée' },
  { value: 'failed', label: 'Échouée' },
  { value: 'entered-in-error', label: 'Saisi en erreur' }
];
