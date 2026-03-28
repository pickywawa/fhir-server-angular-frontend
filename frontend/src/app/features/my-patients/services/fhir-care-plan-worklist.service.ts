import { Injectable } from '@angular/core';
import { HttpParams } from '@angular/common/http';
import { forkJoin, map, Observable } from 'rxjs';
import { ApiService } from '../../../core/services/api.service';
import { CarePlanWorklistItem } from '../models/care-plan-worklist.model';

@Injectable({ providedIn: 'root' })
export class FhirCarePlanWorklistService {
  private readonly carePlanEndpoint = '/CarePlan';
  private readonly patientEndpoint = '/Patient';
  private readonly codeSystemEndpoint = '/CodeSystem';
  private readonly categoryCodeSystemUrl = 'https://healthapp.local/fhir/CodeSystem/care-plan-category/fr_FR';

  constructor(private readonly apiService: ApiService) {}

  getCarePlanWorklist(limit = 200): Observable<CarePlanWorklistItem[]> {
    const carePlanParams = new HttpParams().set('_count', String(limit));
    const patientParams = new HttpParams().set('_count', '300');
    const codeSystemParams = new HttpParams()
      .set('url', this.categoryCodeSystemUrl)
      .set('_count', '1');

    return forkJoin({
      carePlansBundle: this.apiService.get<any>(this.carePlanEndpoint, { params: carePlanParams }),
      patientsBundle: this.apiService.get<any>(this.patientEndpoint, { params: patientParams }),
      codeSystemBundle: this.apiService.get<any>(this.codeSystemEndpoint, { params: codeSystemParams })
    }).pipe(
      map(({ carePlansBundle, patientsBundle, codeSystemBundle }) => {
        const patientMap = this.buildPatientMap(patientsBundle);
        const categoryMap = this.buildCategoryMap(codeSystemBundle);
        return this.convertCarePlans(carePlansBundle, patientMap, categoryMap);
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

  private convertCarePlans(
    bundle: any,
    patientMap: Map<string, any>,
    categoryMap: Map<string, string>
  ): CarePlanWorklistItem[] {
    const entries = Array.isArray(bundle?.entry) ? bundle.entry : [];

    return entries
      .map((entry: any) => this.convertCarePlan(entry?.resource, patientMap, categoryMap))
      .filter((item: CarePlanWorklistItem | null): item is CarePlanWorklistItem => !!item)
      .sort((a: CarePlanWorklistItem, b: CarePlanWorklistItem) =>
        (b.created || '').localeCompare(a.created || '')
      );
  }

  private convertCarePlan(
    carePlan: any,
    patientMap: Map<string, any>,
    categoryMap: Map<string, string>
  ): CarePlanWorklistItem | null {
    const carePlanId = String(carePlan?.id || '').trim();
    const patientRef = String(carePlan?.subject?.reference || '').trim();
    const patientId = this.extractPatientId(patientRef);

    if (!carePlanId || !patientId) {
      return null;
    }

    const patient = patientMap.get(patientId);
    const name = patient?.name?.[0] || {};
    const categoryCoding = carePlan?.category?.[0]?.coding?.[0] || {};
    const categoryCode = String(categoryCoding?.code || '').trim();
    const fallbackLabel = String(categoryCoding?.display || carePlan?.category?.[0]?.text || '').trim();

    return {
      carePlanId,
      title: String(carePlan?.title || '').trim(),
      description: String(carePlan?.description || '').trim(),
      note: String(carePlan?.note?.[0]?.text || '').trim(),
      created: String(carePlan?.created || '').trim(),
      patientId,
      patientFirstName: String(name?.given?.[0] || '').trim(),
      patientLastName: String(name?.family || '').trim(),
      patientBirthDate: String(patient?.birthDate || '').trim(),
      patientGender: String(patient?.gender || '').trim(),
      categoryCode,
      categoryLabel: categoryMap.get(categoryCode) || fallbackLabel || categoryCode || '-',
      status: String(carePlan?.status || '').trim(),
      intent: String(carePlan?.intent || '').trim()
    };
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
