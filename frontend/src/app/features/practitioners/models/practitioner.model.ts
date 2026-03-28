export interface PractitionerSearchCriteria {
  family?: string;
  given?: string;
  identifier?: string;
  limit?: number;
}

export interface PractitionerProfile {
  id?: string;
  mainIdentifier: string;
  firstName: string;
  lastName: string;
  prefix: string;
  profession: string;
  specialty: string;
  specialization: string;
  emails: string[];
  phones: string[];
  addresses: string[];
  contacts: string[];
}

export const EMPTY_PRACTITIONER_PROFILE: PractitionerProfile = {
  mainIdentifier: '',
  firstName: '',
  lastName: '',
  prefix: '',
  profession: '',
  specialty: '',
  specialization: '',
  emails: [],
  phones: [],
  addresses: [],
  contacts: []
};
