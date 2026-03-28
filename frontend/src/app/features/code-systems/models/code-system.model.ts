export interface CodeSystemSummary {
  id: string;
  url: string;
  title: string;
  status: string;
  conceptCount: number;
}

export interface CodeSystemDetail extends CodeSystemSummary {
  concepts: CodeSystemConceptInput[];
}

export interface CodeSystemConceptInput {
  code: string;
  display: string;
}

export interface CreateCodeSystemInput {
  url: string;
  concepts: CodeSystemConceptInput[];
}
