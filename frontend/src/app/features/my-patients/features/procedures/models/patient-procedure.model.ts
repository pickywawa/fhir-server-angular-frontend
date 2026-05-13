export interface ProcedureCategory {
  code: string;
  display: string;
  system: string;
}

/** https://build.fhir.org/valueset-procedure-category.html */
export const PROCEDURE_CATEGORIES: ProcedureCategory[] = [
  { code: '24642003', display: 'Psychiatry procedure or service', system: 'http://snomed.info/sct' },
  { code: '409063005', display: 'Counselling', system: 'http://snomed.info/sct' },
  { code: '409073007', display: 'Education', system: 'http://snomed.info/sct' },
  { code: '387713003', display: 'Surgical procedure', system: 'http://snomed.info/sct' },
  { code: '103693007', display: 'Diagnostic procedure', system: 'http://snomed.info/sct' },
  { code: '46947000',  display: 'Chiropractic manipulation', system: 'http://snomed.info/sct' },
  { code: '410606002', display: 'Social service procedure', system: 'http://snomed.info/sct' },
];

export type ProcedureStatus =
  | 'preparation'
  | 'in-progress'
  | 'not-done'
  | 'on-hold'
  | 'stopped'
  | 'completed'
  | 'entered-in-error'
  | 'unknown';

export const PROCEDURE_STATUSES: { code: ProcedureStatus; display: string }[] = [
  { code: 'preparation',       display: 'En préparation' },
  { code: 'in-progress',       display: 'En cours' },
  { code: 'not-done',          display: 'Non réalisé' },
  { code: 'on-hold',           display: 'En attente' },
  { code: 'stopped',           display: 'Arrêté' },
  { code: 'completed',         display: 'Terminé' },
  { code: 'entered-in-error',  display: 'Erreur de saisie' },
  { code: 'unknown',           display: 'Inconnu' },
];

export interface SnomedSuggestion {
  code: string;
  display: string;
  system: string;
}

export interface PerformerOption {
  id: string;
  reference: string;
  label: string;
}

export interface ProcedureSummary {
  id: string;
  status: ProcedureStatus;
  categoryCode: string;
  categoryDisplay: string;
  codeCode: string;
  codeDisplay: string;
  codeSystem: string;
  occurrenceStart?: string;
  occurrenceEnd?: string;
  recorded?: string;
  location?: string;
  performerDisplays: string[];
  hasReport: boolean;
  note?: string;
}

export interface ProcedureDetail extends ProcedureSummary {
  subjectReference?: string;
  basedOnReference?: string;
  recorderReference?: string;
  performerReferences: PerformerOption[];
  reportReference?: string;
}

export interface ProcedureSaveInput {
  patientReference: string;
  basedOnReference?: string;
  recorderReference?: string;
  status: ProcedureStatus;
  codeCode: string;
  codeDisplay: string;
  codeSystem: string;
  occurrenceStart: string;
  occurrenceEnd?: string;
  recorded: string;
  performers: PerformerOption[];
  location?: string;
  note?: string;
  createDiagnosticReport: boolean;
  diagnosticReportConclusion?: string;
}
