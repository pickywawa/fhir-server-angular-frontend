export interface OrganizationContact {
  system: 'phone' | 'email' | 'url' | 'other';
  value: string;
}

export interface OrganizationTypeOption {
  code: string;
  display: string;
}

export interface OrganizationAddress {
  lines: string[];
  postalCode?: string;
  city?: string;
  country?: string;
}

export interface OrganizationProfile {
  id?: string;
  identifier: string;
  active: boolean;
  typeCode: string;
  typeDisplay: string;
  name: string;
  description: string;
  aliases?: string[];
  contacts: OrganizationContact[];
  address?: OrganizationAddress;
  parentReference?: string;
  parentDisplay?: string;
}

export interface OrganizationSummary {
  id: string;
  identifier: string;
  active: boolean;
  typeCode: string;
  typeDisplay: string;
  name: string;
  description: string;
  contacts: OrganizationContact[];
  addressCity?: string;
  addressPostalCode?: string;
  parentReference?: string;
  parentId?: string;
}

export interface OrganizationOption {
  id: string;
  reference: string;
  label: string;
}

export interface OrganizationSearchCriteria {
  identifier?: string;
  name?: string;
  active?: '' | 'true' | 'false';
  typeCode?: string;
  limit?: number;
}

export const DEFAULT_ORGANIZATION_TYPE_OPTIONS: OrganizationTypeOption[] = [
  { code: 'prov', display: 'Prestataire de soins' },
  { code: 'dept', display: 'Departement' },
  { code: 'team', display: 'Equipe' },
  { code: 'govt', display: 'Organisation gouvernementale' },
  { code: 'ins', display: 'Assurance' },
  { code: 'pay', display: 'Payer' },
  { code: 'edu', display: 'Etablissement educatif' },
  { code: 'reli', display: 'Organisation religieuse' },
  { code: 'crs', display: 'Sponsor de recherche clinique' },
  { code: 'cg', display: 'Groupe communautaire' },
  { code: 'bus', display: 'Entreprise' },
  { code: 'other', display: 'Autre' }
];
