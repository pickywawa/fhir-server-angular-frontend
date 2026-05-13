import { Injectable } from '@angular/core';
import { HttpParams } from '@angular/common/http';
import { forkJoin, map, Observable } from 'rxjs';
import { ApiService } from '../../../core/services/api.service';
import { CarePlanWorklistItem } from '../models/care-plan-worklist.model';

@Injectable({ providedIn: 'root' })
export class FhirCarePlanWorklistService {
  private readonly carePlanEndpoint = '/CarePlan';
  private readonly patientEndpoint = '/Patient';
  private readonly practitionerEndpoint = '/Practitioner';
  private readonly codeSystemEndpoint = '/CodeSystem';
  private readonly categoryCodeSystemUrl = 'https://healthapp.local/fhir/CodeSystem/care-plan-category/fr_FR';
  private readonly identityStatusExtensionUrl = 'http://healthapp.local/fhir/extensions/patient-identity-status';
  private readonly attendingPhysicianExtensionUrl = 'http://healthapp.local/fhir/extensions/attending-physician';

  constructor(private readonly apiService: ApiService) {}

  getCarePlanWorklist(limit = 200): Observable<CarePlanWorklistItem[]> {
    const carePlanParams = new HttpParams().set('_count', String(limit));
    const patientParams = new HttpParams().set('_count', '300');
    const practitionerParams = new HttpParams().set('_count', '300');
    const codeSystemParams = new HttpParams()
      .set('url', this.categoryCodeSystemUrl)
      .set('_count', '1');

    return forkJoin({
      carePlansBundle: this.apiService.get<any>(this.carePlanEndpoint, { params: carePlanParams }),
      patientsBundle: this.apiService.get<any>(this.patientEndpoint, { params: patientParams }),
      practitionersBundle: this.apiService.get<any>(this.practitionerEndpoint, { params: practitionerParams }),
      codeSystemBundle: this.apiService.get<any>(this.codeSystemEndpoint, { params: codeSystemParams })
    }).pipe(
      map(({ carePlansBundle, patientsBundle, practitionersBundle, codeSystemBundle }) => {
        const patientMap = this.buildPatientMap(patientsBundle);
        const practitionerMap = this.buildPractitionerMap(practitionersBundle);
        const categoryMap = this.buildCategoryMap(codeSystemBundle);
        return this.convertCarePlans(carePlansBundle, patientMap, practitionerMap, categoryMap);
      })
    );
  }

  private buildPatientMap(bundle: any): Map<string, any> {
    const mapById = new Map<string, any>();
    const entries = Array.isArray(bundle?.entry) ? bundle.entry : [];

    for (const entry of entries) {
      const patient = entry?.resource;
      const id = patient?.id;
      if (!id) {
        continue;
      }
      mapById.set(String(id), patient);
    }

    return mapById;
  }

  private buildCategoryMap(bundle: any): Map<string, string> {
    const mapByCode = new Map<string, string>();
    const entries = Array.isArray(bundle?.entry) ? bundle.entry : [];
    const codeSystem = entries[0]?.resource;
    const concepts = Array.isArray(codeSystem?.concept) ? codeSystem.concept : [];

    for (const concept of concepts) {
      const code = String(concept?.code || '').trim();
      const display = String(concept?.display || '').trim();
      if (code) {
        mapByCode.set(code, display || code);
      }
    }

    return mapByCode;
  }

  private buildPractitionerMap(bundle: any): Map<string, { display: string; role: string }> {
    const mapById = new Map<string, { display: string; role: string }>();
    const entries = Array.isArray(bundle?.entry) ? bundle.entry : [];

    for (const entry of entries) {
      const practitioner = entry?.resource;
      const id = String(practitioner?.id || '').trim();
      if (!id) {
        continue;
      }

      const firstName = String(practitioner?.name?.[0]?.given?.[0] || '').trim();
      const lastName = String(practitioner?.name?.[0]?.family || '').trim();
      const fullName = `${firstName} ${lastName}`.trim();
      const display = fullName || String(practitioner?.name?.[0]?.text || '').trim() || `Practitioner/${id}`;
      const role = this.extractPractitionerRole(practitioner);

      mapById.set(id, { display, role });
    }

    return mapById;
  }

  private convertCarePlans(
    bundle: any,
    patientMap: Map<string, any>,
    practitionerMap: Map<string, { display: string; role: string }>,
    categoryMap: Map<string, string>
  ): CarePlanWorklistItem[] {
    const entries = Array.isArray(bundle?.entry) ? bundle.entry : [];

    return entries
      .map((entry: any) => this.convertCarePlan(entry?.resource, patientMap, practitionerMap, categoryMap))
      .filter((item: CarePlanWorklistItem | null): item is CarePlanWorklistItem => !!item)
      .sort((a: CarePlanWorklistItem, b: CarePlanWorklistItem) =>
        (b.lastChanged || b.created || '').localeCompare(a.lastChanged || a.created || '')
      );
  }

  private convertCarePlan(
    carePlan: any,
    patientMap: Map<string, any>,
    practitionerMap: Map<string, { display: string; role: string }>,
    categoryMap: Map<string, string>
  ): CarePlanWorklistItem | null {
    const carePlanId = String(carePlan?.id || '').trim();
    const patientRef = String(carePlan?.subject?.reference || '').trim();
    const patientId = this.extractPatientId(patientRef);

    if (!carePlanId || !patientId) {
      return null;
    }

    const patient = patientMap.get(patientId);
    const name = this.pickPatientDisplayName(patient);
    const categoryCoding = carePlan?.category?.[0]?.coding?.[0] || {};
    const categoryCode = String(categoryCoding?.code || '').trim();
    const fallbackLabel = String(categoryCoding?.display || carePlan?.category?.[0]?.text || '').trim();
    const patientIpp = this.extractPatientIdentifier(patient, 'ipp');
    const patientIns = this.extractPatientIdentifier(patient, 'ins');
    const identityStatus = this.resolveIdentityStatus(patient, patientIns);
    const practitionerRef = this.extractPractitionerReference(carePlan, patient);
    const practitionerId = this.extractResourceId(practitionerRef, 'Practitioner');
    const practitionerInfo = practitionerMap.get(practitionerId);
    const practitionerDisplay = this.resolveAttendingPhysicianDisplay(patient, practitionerInfo?.display || this.extractReferenceDisplay(practitionerRef));
    const practitionerRole = practitionerInfo?.role || 'Medecin';
    const lastChanged = String(carePlan?.meta?.lastUpdated || carePlan?.created || '').trim();

    return {
      carePlanId,
      title: String(carePlan?.title || '').trim(),
      description: String(carePlan?.description || '').trim(),
      note: String(carePlan?.note?.[0]?.text || '').trim(),
      created: String(carePlan?.created || '').trim(),
      lastChanged,
      patientId,
      patientFirstName: String(name?.given || '').trim(),
      patientLastName: String(name?.family || '').trim(),
      patientBirthName: String(name?.birthFamily || '').trim(),
      patientBirthDate: String(patient?.birthDate || '').trim(),
      patientGender: String(patient?.gender || '').trim(),
      patientIpp,
      patientIns,
      identityStatus,
      practitionerDisplay,
      practitionerRole,
      categoryCode,
      categoryLabel: categoryMap.get(categoryCode) || fallbackLabel || categoryCode || '-',
      status: String(carePlan?.status || '').trim(),
      intent: String(carePlan?.intent || '').trim()
    };
  }

  private pickPatientDisplayName(patient: any): { given: string; family: string; birthFamily: string } {
    const names = Array.isArray(patient?.name) ? patient.name : [];
    const official = names.find((entry: any) => String(entry?.use || '').toLowerCase() === 'official') || names[0] || {};
    const maiden = names.find((entry: any) => {
      const use = String(entry?.use || '').toLowerCase();
      return use === 'maiden' || use === 'old';
    }) || {};

    return {
      given: String(official?.given?.[0] || '').trim(),
      family: String(official?.family || '').trim(),
      birthFamily: String(maiden?.family || '').trim()
    };
  }

  private extractPatientIdentifier(patient: any, kind: 'ipp' | 'ins'): string {
    const identifiers = Array.isArray(patient?.identifier) ? patient.identifier : [];

    const matcher = kind === 'ipp'
      ? (identifier: any) => {
        const system = String(identifier?.system || '').toLowerCase();
        const typeCode = String(identifier?.type?.coding?.[0]?.code || '').toUpperCase();
        return typeCode === 'PI' || typeCode === 'MR' || typeCode === 'IPP' || system.includes('ipp') || system.includes('mrn');
      }
      : (identifier: any) => {
        const system = String(identifier?.system || '').toLowerCase();
        const typeCode = String(identifier?.type?.coding?.[0]?.code || '').toUpperCase();
        return typeCode === 'INS' || typeCode === 'NI' || typeCode === 'NIR' || typeCode === 'SS' || system.includes('ins') || system.includes('nir') || system.includes('insee');
      };

    const bestMatch = identifiers.find(matcher);
    if (bestMatch?.value) {
      return String(bestMatch.value).trim();
    }

    if (kind === 'ipp' && patient?.id) {
      return String(patient.id).trim();
    }

    return '';
  }

  private resolveIdentityStatus(patient: any, ins: string): CarePlanWorklistItem['identityStatus'] {
    const extensionStatus = this.extractExtensionValue(patient, this.identityStatusExtensionUrl).toLowerCase();
    if (extensionStatus.includes('valid')) {
      return 'validated';
    }
    if (extensionStatus.includes('prov')) {
      return 'provisional';
    }

    return ins ? 'validated' : 'provisional';
  }

  private resolveAttendingPhysicianDisplay(patient: any, fallback?: string): string {
    const extensionPhysician = this.extractExtensionValue(patient, this.attendingPhysicianExtensionUrl);
    if (extensionPhysician) {
      return extensionPhysician;
    }

    return String(fallback || '-').trim() || '-';
  }

  private extractExtensionValue(patient: any, extensionUrl: string): string {
    const extensions = Array.isArray(patient?.extension) ? patient.extension : [];
    const extension = extensions.find((entry: any) => String(entry?.url || '') === extensionUrl);
    return String(extension?.valueString || extension?.valueCode || '').trim();
  }

  private extractPractitionerReference(carePlan: any, patient: any): any {
    const patientPractitioner = Array.isArray(patient?.generalPractitioner) ? patient.generalPractitioner[0] : null;
    const carePlanAuthor = carePlan?.author;

    return patientPractitioner || carePlanAuthor || null;
  }

  private extractReferenceDisplay(reference: any): string {
    return String(reference?.display || '').trim();
  }

  private extractResourceId(reference: any, resourceType: string): string {
    const raw = String(reference?.reference || '').trim();
    if (!raw) {
      return '';
    }

    const marker = `${resourceType}/`;
    const markerIndex = raw.lastIndexOf(marker);
    if (markerIndex >= 0) {
      return raw.slice(markerIndex + marker.length).trim();
    }

    return '';
  }

  private extractPractitionerRole(practitioner: any): string {
    const qualifications = Array.isArray(practitioner?.qualification) ? practitioner.qualification : [];
    const roleText = qualifications
      .map((entry: any) => String(entry?.code?.text || entry?.code?.coding?.[0]?.display || '').trim())
      .find((value: string) => value.length > 0);

    if (!roleText) {
      return 'Medecin';
    }

    const lowered = roleText.toLowerCase();
    if (lowered.includes('medecin') || lowered.includes('doctor') || lowered.includes('docteur')) {
      return 'Medecin';
    }

    return roleText;
  }

  private extractPatientId(reference: string): string {
    if (!reference) {
      return '';
    }

    const marker = 'Patient/';
    const markerIndex = reference.lastIndexOf(marker);
    if (markerIndex >= 0) {
      return reference.substring(markerIndex + marker.length);
    }

    return reference;
  }
}
