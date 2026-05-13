export interface ConsentActionOption {
  code: string;
  display: string;
}

export const CONSENT_ACTION_OPTIONS: ConsentActionOption[] = [
  { code: 'collect', display: 'Collecter' },
  { code: 'access', display: 'Accéder' },
  { code: 'use', display: 'Utiliser' },
  { code: 'disclose', display: 'Divulguer' },
  { code: 'correct', display: 'Corriger' },
];

export interface PatientConsentSummary {
  id: string;
  granted: boolean;
  dateTime: string;
  actions: string[];
  confidentiality: 'N' | 'R';
  periodStart?: string;
  periodEnd?: string;
  note?: string;
  carePlanReference?: string;
  verifiedWithReference?: string;
  grantorReference?: string;
}
