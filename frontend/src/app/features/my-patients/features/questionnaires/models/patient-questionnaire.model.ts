import { QuestionnaireItem } from '../../../../questionnaires/models/questionnaire.model';

export interface QuestionnaireResponseSummary {
  id: string;
  status: string;
  questionnaireReference: string;
  questionnaireId: string;
  subjectReference?: string;
  authored?: string;
}

export interface QuestionnaireResponseDetail {
  id: string;
  status: string;
  questionnaireReference: string;
  questionnaireId: string;
  subjectReference?: string;
  authored?: string;
  item: any[];
}

export interface QuestionnaireAnswerMap {
  [linkId: string]: string | number | boolean | string[];
}

export interface QuestionnaireResponsePayload {
  patientId: string;
  questionnaireId: string;
  status: string;
  answers: QuestionnaireAnswerMap;
  questionnaireItems: QuestionnaireItem[];
}
