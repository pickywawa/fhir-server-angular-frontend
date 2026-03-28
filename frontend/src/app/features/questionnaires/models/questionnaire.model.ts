export type QuestionnaireStatus = 'draft' | 'active' | 'retired' | 'unknown';

export type QuestionnaireItemType =
  | 'group'
  | 'string'
  | 'text'
  | 'boolean'
  | 'integer'
  | 'quantity'
  | 'date'
  | 'choice';

export type EnableWhenOperator = 'exists' | '=' | '!=' | '>' | '<' | '>=' | '<=';

export interface QuestionnaireEnableWhen {
  uid: string;
  questionLinkId: string;
  operator: EnableWhenOperator;
  answer: string;
}

export interface QuestionnaireItem {
  uid: string;
  linkId: string;
  text: string;
  type: QuestionnaireItemType;
  required: boolean;
  repeats: boolean;
  answerOptions: string[];
  enableWhen: QuestionnaireEnableWhen[];
  items: QuestionnaireItem[];
  unit?: string;
}

export interface QuestionnaireProfile {
  id?: string;
  title: string;
  description: string;
  status: QuestionnaireStatus;
  items: QuestionnaireItem[];
  date?: string;
}

export interface QuestionnaireSearchCriteria {
  title?: string;
  status?: QuestionnaireStatus | '';
  limit?: number;
}

export interface QuestionnaireSummary {
  id: string;
  title: string;
  description: string;
  status: QuestionnaireStatus;
  itemCount: number;
  date?: string;
}

export const FHIR_QUESTIONNAIRE_STATUSES: QuestionnaireStatus[] = ['draft', 'active', 'retired', 'unknown'];

export const QUESTION_ITEM_TYPES: QuestionnaireItemType[] = [
  'group',
  'string',
  'text',
  'boolean',
  'integer',
  'quantity',
  'date',
  'choice'
];

export const ENABLE_WHEN_OPERATORS: EnableWhenOperator[] = ['exists', '=', '!=', '>', '<', '>=', '<='];
