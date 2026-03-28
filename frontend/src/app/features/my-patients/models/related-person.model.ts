export interface RelatedPersonProfile {
  id: string;
  name: string;
  roleCode: string;
  roleDisplay: string;
  phone?: string;
  email?: string;
  gender: string;
  birthDate: string;
  address?: string;
  language?: string;
}

export interface CreateRelatedPersonInput {
  name: string;
  roleCode: string;
  roleDisplay: string;
  phone?: string;
  email?: string;
  gender: string;
  birthDate: string;
  address: string;
  city?: string;
  postalCode?: string;
  language?: string;
}

export const RELATED_PERSON_RELATIONSHIP_OPTIONS: Array<{ code: string; display: string }> = [
  { code: 'FTH', display: 'Pere' },
  { code: 'MTH', display: 'Mere' },
  { code: 'SPS', display: 'Conjoint' },
  { code: 'CHD', display: 'Enfant' },
  { code: 'SIB', display: 'Frere / Soeur' },
  { code: 'GRPRN', display: 'Grand-parent' },
  { code: 'GRCHILD', display: 'Petit-enfant' },
  { code: 'NOK', display: 'Personne de confiance' },
  { code: 'FRND', display: 'Ami(e)' },
  { code: 'DOMPART', display: 'Partenaire' }
];
