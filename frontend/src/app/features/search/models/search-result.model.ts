export type SearchResultType = 'patient' | 'practitioner' | 'appointment' | 'document';

export interface SearchResultItem {
  id: string;
  type: SearchResultType;
  title: string;
  subtitle: string;
  description: string;
  routeCommands: string[];
  queryParams?: Record<string, string>;
}
