export interface CareTeamMemberInput {
  practitionerId: string;
  practitionerName: string;
  role: string;
  roleDisplay: string;
}

export interface PractitionerOption {
  id: string;
  firstName: string;
  lastName: string;
  displayName: string;
}

export const PARTICIPANT_ROLES = [
  { code: 'doctor', display: 'Docteur / Médecin', title: 'doctor' },
  { code: 'nurse', display: 'Infirmière', title: 'nurse' },
  { code: 'midwife', display: 'Sage-femme', title: 'midwife' },
  { code: 'coordinator', display: 'Coordinateur', title: 'coordinator' },
  { code: 'therapist', display: 'Thérapeute', title: 'therapist' },
  { code: 'careteam-manager', display: 'Gestionnaire de soins', title: 'careteam-manager' },
  { code: 'rehabilitation-specialist', display: 'Spécialiste en réadaptation', title: 'rehabilitation-specialist' },
  { code: 'administrative', display: 'Personnel administratif', title: 'administrative' }
];
