export type PatientTimelineCategory =
  | 'document'
  | 'questionnaire'
  | 'appointment'
  | 'care-team'
  | 'related-person'
  | 'careplan'
  | 'patient'
  | 'discussion'
  | 'other';

export type PatientTimelineAction = 'created' | 'updated' | 'recorded';

export interface PatientTimelineEvent {
  id: string;
  occurredAt: string;
  category: PatientTimelineCategory;
  action: PatientTimelineAction;
  actor: string;
  details: string;
  routeCommands: string[];
  queryParams?: Record<string, string>;
}
