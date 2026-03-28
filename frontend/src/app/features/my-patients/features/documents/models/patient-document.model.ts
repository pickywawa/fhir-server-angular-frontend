export interface PatientDocumentItem {
  id: string;
  title: string;
  classLabel: string;
  typeLabel: string;
  contentType: string;
  createdAt: string;
  binaryUrl: string;
  authorReference: string;
  authorLabel: string;
  patientReference: string;
  sizeBytes: number;
}

export interface DocumentCodeOption {
  code: string;
  display: string;
  system: string;
}

export const XDS_CLASS_OPTIONS: DocumentCodeOption[] = [
  { code: '34133-9', display: 'Synthese clinique', system: 'http://loinc.org' },
  { code: '18842-5', display: 'Compte rendu de sortie', system: 'http://loinc.org' },
  { code: '18748-4', display: 'Diagnostic imaging study', system: 'http://loinc.org' },
  { code: '11506-3', display: 'Rapport de pathologie', system: 'http://loinc.org' },
  { code: '11488-3', display: 'Consultation note', system: 'http://loinc.org' }
];

export const XDS_TYPE_OPTIONS: DocumentCodeOption[] = [
  { code: '34108-1', display: 'Outpatient Note', system: 'http://loinc.org' },
  { code: '18841-7', display: 'Discharge Summary', system: 'http://loinc.org' },
  { code: '28570-0', display: 'Procedure note', system: 'http://loinc.org' },
  { code: '47039-3', display: 'Consult note', system: 'http://loinc.org' },
  { code: '55107-7', display: 'Patient summary document', system: 'http://loinc.org' }
];
