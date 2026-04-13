import { Injectable } from '@angular/core';
import { HttpParams, HttpHeaders } from '@angular/common/http';
import { Observable, map, switchMap, of } from 'rxjs';
import { ApiService } from '../../../../../core/services/api.service';
import { CareTeamMember } from '../../../models/care-team.model';

@Injectable({
  providedIn: 'root'
})
export class FhirCareTeamService {
  private readonly endpoint = '/CareTeam';
  private readonly fhirHeaders = new HttpHeaders({
    'Content-Type': 'application/fhir+json',
    Accept: 'application/fhir+json'
  });

  constructor(private readonly apiService: ApiService) {}

  getMembersByPatient(patientId: string): Observable<CareTeamMember[]> {
    const params = new HttpParams()
      .set('patient', patientId)
      .set('_include', 'CareTeam:participant')
      .set('_count', '50');

    return this.apiService.get<any>(this.endpoint, { params }).pipe(
      map((bundle) => this.convertBundleToMembers(bundle))
    );
  }

  addMemberToPatientCareTeam(
    patientId: string,
    practitionerId: string,
    practitionerName: string,
    role: string,
    roleDisplay: string
  ): Observable<CareTeamMember> {
    return this.getOrCreateCareTeamForPatient(patientId).pipe(
      switchMap((careTeamId) => {
        const participant = {
          member: {
            reference: `Practitioner/${practitionerId}`,
            display: practitionerName
          },
          role: [
            {
              coding: [
                {
                  system: 'http://terminology.hl7.org/CodeSystem/participant-role',
                  code: role
                }
              ],
              text: roleDisplay
            }
          ]
        };

        return this.addParticipantToCareTeam(careTeamId, participant).pipe(
          map((member) => member)
        );
      })
    );
  }

  removeMemberFromCareTeam(memberId: string): Observable<void> {
    const separatorIndex = memberId.lastIndexOf('-');
    if (separatorIndex <= 0) {
      throw new Error('Invalid care team member id');
    }

    const careTeamId = memberId.slice(0, separatorIndex);
    const participantIndex = Number(memberId.slice(separatorIndex + 1));

    if (!Number.isInteger(participantIndex) || participantIndex < 0) {
      throw new Error('Invalid care team participant index');
    }

    return this.apiService.get<any>(`${this.endpoint}/${careTeamId}`).pipe(
      switchMap((careTeam) => {
        const participants = [...(careTeam.participant || [])];

        if (participantIndex >= participants.length) {
          throw new Error('Care team participant not found');
        }

        participants.splice(participantIndex, 1);
        careTeam.participant = participants;

        return this.apiService.put<any>(`${this.endpoint}/${careTeamId}`, careTeam, { headers: this.fhirHeaders }).pipe(
          map(() => undefined)
        );
      })
    );
  }

  getOrCreateCareTeamReference(patientId: string): Observable<string> {
    return this.getOrCreateCareTeamForPatient(patientId).pipe(
      map((careTeamId) => `CareTeam/${careTeamId}`)
    );
  }

  getCareTeamReferencesByPractitioner(practitionerId: string): Observable<string[]> {
    const normalized = String(practitionerId || '').trim();
    if (!normalized) {
      console.debug('[discussions-global] careteam lookup skipped: empty practitioner id');
      return of([]);
    }

    console.debug('[discussions-global] careteam lookup start', { practitionerId: normalized });

    const byQualifiedParticipantParams = new HttpParams()
      .set('participant', `Practitioner/${normalized}`)
      .set('_count', '200');

    const byRawParticipantParams = new HttpParams()
      .set('participant', normalized)
      .set('_count', '200');

    const allCareTeamsParams = new HttpParams().set('_count', '200');

    return this.apiService.get<any>(this.endpoint, { params: byQualifiedParticipantParams }).pipe(
      switchMap((bundleByQualified) => {
        const qualifiedMatches = this.extractCareTeamReferences(bundleByQualified);
        console.debug('[discussions-global] careteam lookup by participant=Practitioner/{id}', {
          practitionerId: normalized,
          matches: qualifiedMatches
        });
        if (qualifiedMatches.length > 0) {
          return of(qualifiedMatches);
        }

        return this.apiService.get<any>(this.endpoint, { params: byRawParticipantParams }).pipe(
          switchMap((bundleByRaw) => {
            const rawMatches = this.extractCareTeamReferences(bundleByRaw);
            console.debug('[discussions-global] careteam lookup by participant={id}', {
              practitionerId: normalized,
              matches: rawMatches
            });
            if (rawMatches.length > 0) {
              return of(rawMatches);
            }

            return this.apiService.get<any>(this.endpoint, { params: allCareTeamsParams }).pipe(
              map((allBundle) => {
                const filtered = this.filterCareTeamsByPractitioner(allBundle, normalized);
                console.debug('[discussions-global] careteam lookup by local filtering', {
                  practitionerId: normalized,
                  matches: filtered
                });
                return filtered;
              })
            );
          })
        );
      })
    );
  }

  private extractCareTeamReferences(bundle: any): string[] {
    const entries = bundle?.entry ?? [];
    const refs = entries
      .map((entry: any) => String(entry?.resource?.id || '').trim())
      .filter(Boolean)
      .map((id: string) => `CareTeam/${id}`);
    return Array.from(new Set(refs));
  }

  private filterCareTeamsByPractitioner(bundle: any, practitionerId: string): string[] {
    const target = `Practitioner/${String(practitionerId || '').trim()}`;
    const entries = bundle?.entry ?? [];

    const refs = entries
      .map((entry: any) => entry?.resource)
      .filter((resource: any) => resource?.resourceType === 'CareTeam' && resource?.id)
      .filter((careTeam: any) => {
        const participants = careTeam?.participant ?? [];
        return participants.some((participant: any) => {
          const reference = String(participant?.member?.reference || '').trim();
          if (!reference) {
            return false;
          }
          return reference === target || reference.endsWith(`/${target}`) || reference === practitionerId;
        });
      })
      .map((careTeam: any) => `CareTeam/${careTeam.id}`);

    return Array.from(new Set(refs));
  }

  private getOrCreateCareTeamForPatient(patientId: string): Observable<string> {
    const params = new HttpParams()
      .set('patient', patientId)
      .set('_count', '1');

    return this.apiService.get<any>(this.endpoint, { params }).pipe(
      switchMap((bundle) => {
        if (bundle?.entry?.length > 0) {
          const careTeamId = bundle.entry[0].resource.id;
          return of(careTeamId);
        } else {
          return this.createCareTeamForPatient(patientId);
        }
      })
    );
  }

  private createCareTeamForPatient(patientId: string): Observable<string> {
    const careTeam = {
      resourceType: 'CareTeam',
      status: 'active',
      subject: {
        reference: `Patient/${patientId}`
      },
      participant: []
    };

    return this.apiService.post<any>(this.endpoint, careTeam, { headers: this.fhirHeaders }).pipe(
      map((response) => response.id)
    );
  }

  private addParticipantToCareTeam(careTeamId: string, participant: any): Observable<CareTeamMember> {
    return this.apiService.get<any>(`${this.endpoint}/${careTeamId}`).pipe(
      switchMap((careTeam) => {
        const participants = careTeam.participant || [];
        participants.push(participant);
        careTeam.participant = participants;

        return this.apiService.put<any>(`${this.endpoint}/${careTeamId}`, careTeam, { headers: this.fhirHeaders }).pipe(
          map(() => ({
            id: `${careTeamId}-${participants.length - 1}`,
            name: participant.member.display,
            role: participant.role[0]?.text || participant.role[0]?.coding?.[0]?.code || '',
            reference: participant.member.reference
          }))
        );
      })
    );
  }

  private convertBundleToMembers(bundle: any): CareTeamMember[] {
    if (!bundle?.entry?.length) {
      return [];
    }

    const resources = bundle.entry.map((entry: any) => entry.resource).filter(Boolean);

    const participantDirectory = new Map<string, string>();
    resources
      .filter((resource: any) => resource.resourceType && resource.id && resource.resourceType !== 'CareTeam')
      .forEach((resource: any) => {
        const key = `${resource.resourceType}/${resource.id}`;
        participantDirectory.set(key, this.extractResourceDisplay(resource));
      });

    const members: CareTeamMember[] = [];

    resources
      .filter((resource: any) => resource.resourceType === 'CareTeam')
      .forEach((careTeam: any) => {
        const participants = careTeam.participant || [];

        participants.forEach((participant: any, index: number) => {
          const reference = participant?.member?.reference || '';
          const nameFromInclude = participantDirectory.get(reference);
          const name =
            participant?.member?.display ||
            nameFromInclude ||
            reference ||
            'Intervenant inconnu';

          const role =
            participant?.role?.[0]?.text ||
            participant?.role?.[0]?.coding?.[0]?.display ||
            participant?.role?.[0]?.coding?.[0]?.code ||
            'Role non renseigne';

          members.push({
            id: `${careTeam.id || 'careteam'}-${index}`,
            name,
            role,
            reference
          });
        });
      });

    return members;
  }

  private extractResourceDisplay(resource: any): string {
    if (resource.resourceType === 'Practitioner') {
      const firstName = resource.name?.[0]?.given?.[0] || '';
      const lastName = resource.name?.[0]?.family || '';
      const combined = `${firstName} ${lastName}`.trim();
      return combined || resource.id;
    }

    if (resource.resourceType === 'PractitionerRole') {
      return resource.practitioner?.display || resource.id;
    }

    if (resource.name) {
      return resource.name;
    }

    return `${resource.resourceType}/${resource.id}`;
  }
}
