export interface PatientProfile {
  id: string;
  firstName: string;
  lastName: string;
  birthDate?: string;
  gender?: 'male' | 'female' | 'other' | 'unknown';
  phoneNumber?: string;
  email?: string;
  address?: string;
  city?: string;
  postalCode?: string;
  country?: string;
}

export interface PatientSearchCriteria {
  family?: string;
  given?: string;
  birthDate?: string;
}
