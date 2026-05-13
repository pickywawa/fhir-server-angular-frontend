export interface ObservationCategory {
  code: string;
  display: string;
  system: string;
}

export const OBSERVATION_CATEGORIES: ObservationCategory[] = [
  { code: 'social-history', display: 'Histoire sociale', system: 'http://terminology.hl7.org/CodeSystem/observation-category' },
  { code: 'vital-signs', display: 'Signes vitaux', system: 'http://terminology.hl7.org/CodeSystem/observation-category' },
  { code: 'imaging', display: 'Imagerie', system: 'http://terminology.hl7.org/CodeSystem/observation-category' },
  { code: 'laboratory', display: 'Biologie / Laboratoire', system: 'http://terminology.hl7.org/CodeSystem/observation-category' },
  { code: 'procedure', display: 'Procédure', system: 'http://terminology.hl7.org/CodeSystem/observation-category' },
  { code: 'survey', display: 'Questionnaire / Évaluation', system: 'http://terminology.hl7.org/CodeSystem/observation-category' },
  { code: 'exam', display: 'Examen clinique', system: 'http://terminology.hl7.org/CodeSystem/observation-category' },
  { code: 'therapy', display: 'Thérapie', system: 'http://terminology.hl7.org/CodeSystem/observation-category' },
  { code: 'activity', display: 'Activité physique', system: 'http://terminology.hl7.org/CodeSystem/observation-category' },
];

export type ObservationValueType = 'string' | 'boolean' | 'integer' | 'date';

export const OBSERVATION_VALUE_TYPES: { type: ObservationValueType; display: string }[] = [
  { type: 'string', display: 'Texte' },
  { type: 'integer', display: 'Nombre entier' },
  { type: 'boolean', display: 'Oui / Non' },
  { type: 'date', display: 'Date' },
];

export interface ObservationInterpretation {
  code: string;
  display: string;
}

export const OBSERVATION_INTERPRETATIONS: ObservationInterpretation[] = [
  { code: 'N', display: 'Normal' },
  { code: 'H', display: 'Élevé' },
  { code: 'L', display: 'Bas' },
  { code: 'A', display: 'Anormal' },
  { code: 'HH', display: 'Critique élevé' },
  { code: 'LL', display: 'Critique bas' },
];

export interface ObservationSummary {
  id: string;
  status: string;
  categoryCode: string;
  categoryDisplay: string;
  codeSystem: string;
  codeCode: string;
  codeDisplay: string;
  valueType: ObservationValueType | null;
  valueString?: string;
  valueBoolean?: boolean;
  valueInteger?: number;
  valueDate?: string;
  effectiveDateTime?: string;
  performerDisplay?: string;
  interpretationCode?: string;
}

export interface ObservationDetail extends ObservationSummary {
  note?: string;
  subjectReference?: string;
}

export interface ObservationSaveInput {
  patientReference: string;
  categoryCode: string;
  codeSystem: string;
  codeCode: string;
  codeDisplay: string;
  valueType: ObservationValueType;
  valueString?: string;
  valueBoolean?: boolean;
  valueInteger?: number;
  valueDate?: string;
  effectiveDateTime?: string;
  interpretationCode?: string;
  note?: string;
  performerReference?: string;
  performerDisplay?: string;
}
