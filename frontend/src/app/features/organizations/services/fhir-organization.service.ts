import { Injectable } from '@angular/core';
import { HttpHeaders, HttpParams } from '@angular/common/http';
import { Observable, catchError, forkJoin, map, of, switchMap } from 'rxjs';
import { ApiService } from '../../../core/services/api.service';
import {
  DEFAULT_ORGANIZATION_TYPE_OPTIONS,
  OrganizationContact,
  OrganizationOption,
  OrganizationProfile,
  OrganizationSearchCriteria,
  OrganizationSummary,
  OrganizationTypeOption
} from '../models/organization.model';

@Injectable({
  providedIn: 'root'
})
export class FhirOrganizationService {
  private readonly organizationEndpoint = '/Organization';
  private readonly codeSystemEndpoint = '/CodeSystem';
  private readonly fhirHeaders = new HttpHeaders({
    'Content-Type': 'application/fhir+json',
    Accept: 'application/fhir+json'
  });

  private readonly organizationTypeCodeSystemUrl = 'https://health-fhir.fr/CodeSystem/organization-type/fr-FR';
  private readonly organizationDescriptionExtensionUrl = 'https://health-fhir.fr/StructureDefinition/organization-description';

  private readonly bfcSeedDefinitions = [
    {
      key: 'besancon',
      name: 'CHU Besancon',
      identifier: 'BFC-BESANCON',
      city: 'Besancon',
      postalCode: '25000'
    },
    {
      key: 'vesoul',
      name: 'Centre Hospitalier de Vesoul',
      identifier: 'BFC-VESOUL',
      city: 'Vesoul',
      postalCode: '70000',
      parentKey: 'besancon'
    },
    {
      key: 'belfort',
      name: 'Hopital Nord Franche-Comte - Belfort',
      identifier: 'BFC-BELFORT',
      city: 'Belfort',
      postalCode: '90000',
      parentKey: 'besancon'
    },
    {
      key: 'lons',
      name: 'Centre Hospitalier de Lons-le-Saunier',
      identifier: 'BFC-LONS-LE-SAUNIER',
      city: 'Lons-le-Saunier',
      postalCode: '39000',
      parentKey: 'besancon'
    },
    {
      key: 'pontarlier',
      name: 'Hopital de Pontarlier',
      identifier: 'BFC-PONTARLIER',
      city: 'Pontarlier',
      postalCode: '25300',
      parentKey: 'besancon'
    },
    {
      key: 'pontarlier-urgences',
      name: 'Urgences Pontarlier',
      identifier: 'BFC-PONTARLIER-URG',
      city: 'Pontarlier',
      postalCode: '25300',
      parentKey: 'pontarlier'
    }
  ];

  constructor(private readonly apiService: ApiService) {}

  searchOrganizations(criteria: OrganizationSearchCriteria): Observable<OrganizationSummary[]> {
    let params = new HttpParams().set('_count', String(criteria.limit ?? 100));

    if (criteria.identifier?.trim()) {
      params = params.set('identifier', criteria.identifier.trim());
    }

    if (criteria.name?.trim()) {
      params = params.set('name:contains', criteria.name.trim());
    }

    if (criteria.active === 'true' || criteria.active === 'false') {
      params = params.set('active', criteria.active);
    }

    if (criteria.typeCode?.trim()) {
      params = params.set('type', criteria.typeCode.trim());
    }

    return this.apiService.get<any>(this.organizationEndpoint, { params }).pipe(
      map((bundle) => this.convertBundleToSummaries(bundle))
    );
  }

  getOrganization(id: string): Observable<OrganizationProfile> {
    return this.apiService.get<any>(`${this.organizationEndpoint}/${id}`).pipe(
      map((resource) => this.convertResourceToProfile(resource))
    );
  }

  searchOrganizationOptions(query: string, limit = 12): Observable<OrganizationOption[]> {
    const trimmed = query.trim();
    if (!trimmed) {
      return of([]);
    }

    const parts = trimmed.split(/\s+/).filter(Boolean);
    const first = parts[0] || '';

    const requests = [
      this.fetchOrganizationOptions({ name: first, limit }),
      this.fetchOrganizationOptions({ identifier: first, limit })
    ];

    return forkJoin(requests.map((request) => request.pipe(catchError(() => of([]))))).pipe(
      map((resultSets) => this.mergeOptionsByReference(resultSets.flat()))
    );
  }

  resolveOrganizationReferenceDisplay(reference: string): Observable<string> {
    const normalized = this.normalizeReference(reference);
    if (!normalized) {
      return of('');
    }

    return this.apiService.get<any>(`/${normalized}`).pipe(
      map((resource) => String(resource?.name || resource?.id || normalized)),
      catchError(() => of(normalized))
    );
  }

  ensureBourgogneFrancheComteSeed(): Observable<void> {
    return this.searchOrganizations({ identifier: 'BFC-', limit: 200 }).pipe(
      switchMap((existing) => {
        if (existing.length >= this.bfcSeedDefinitions.length) {
          return of(undefined);
        }

        const byKey = new Map<string, string>();
        let chain$ = of(undefined as void | undefined);

        this.bfcSeedDefinitions.forEach((def) => {
          chain$ = chain$.pipe(
            switchMap(() => {
              const parentReference = def.parentKey ? byKey.get(def.parentKey) || '' : '';
              return this.ensureBfcOrganization(def.name, def.identifier, def.city, def.postalCode, parentReference).pipe(
                map((createdOrFound) => {
                  if (createdOrFound?.id) {
                    byKey.set(def.key, `Organization/${createdOrFound.id}`);
                  }
                  return undefined;
                })
              );
            })
          );
        });

        return chain$.pipe(map(() => undefined));
      }),
      catchError(() => of(undefined))
    );
  }

  createOrganization(organization: OrganizationProfile): Observable<OrganizationProfile> {
    const payload = this.convertProfileToResource(organization);
    return this.apiService.post<any>(this.organizationEndpoint, payload, { headers: this.fhirHeaders }).pipe(
      map((resource) => this.convertResourceToProfile(resource))
    );
  }

  updateOrganization(id: string, organization: OrganizationProfile): Observable<OrganizationProfile> {
    const payload = {
      ...this.convertProfileToResource(organization),
      id
    };

    return this.apiService.put<any>(`${this.organizationEndpoint}/${id}`, payload, { headers: this.fhirHeaders }).pipe(
      map((resource) => this.convertResourceToProfile(resource))
    );
  }

  getOrganizationTypeOptions(): Observable<OrganizationTypeOption[]> {
    return this.ensureOrganizationTypeCodeSystem().pipe(
      map((resource) => {
        const concepts = Array.isArray(resource?.concept) ? resource.concept : [];
        const options = concepts
          .map((item: any) => ({
            code: String(item?.code || '').trim(),
            display: String(item?.display || item?.code || '').trim()
          }))
          .filter((item: OrganizationTypeOption) => item.code.length > 0);

        return options.length > 0 ? options : DEFAULT_ORGANIZATION_TYPE_OPTIONS;
      }),
      catchError(() => of(DEFAULT_ORGANIZATION_TYPE_OPTIONS))
    );
  }

  private ensureOrganizationTypeCodeSystem(): Observable<any> {
    return this.findOrganizationTypeCodeSystem().pipe(
      switchMap((resource) => {
        if (resource) {
          return of(resource);
        }

        const payload = {
          resourceType: 'CodeSystem',
          url: this.organizationTypeCodeSystemUrl,
          status: 'active',
          content: 'complete',
          language: 'fr-FR',
          concept: DEFAULT_ORGANIZATION_TYPE_OPTIONS.map((item) => ({
            code: item.code,
            display: item.display
          }))
        };

        return this.apiService.post<any>(this.codeSystemEndpoint, payload, { headers: this.fhirHeaders }).pipe(
          catchError(() => this.findOrganizationTypeCodeSystem())
        );
      })
    );
  }

  private findOrganizationTypeCodeSystem(): Observable<any | null> {
    const params = new HttpParams()
      .set('url', this.organizationTypeCodeSystemUrl)
      .set('_count', '1');

    return this.apiService.get<any>(this.codeSystemEndpoint, { params }).pipe(
      map((bundle) => {
        const resource = bundle?.entry?.[0]?.resource;
        return resource || null;
      })
    );
  }

  private convertBundleToSummaries(bundle: any): OrganizationSummary[] {
    if (!bundle?.entry) {
      return [];
    }

    return bundle.entry
      .map((entry: any) => this.convertResourceToSummary(entry?.resource))
      .filter((item: OrganizationSummary | null): item is OrganizationSummary => !!item);
  }

  private convertResourceToSummary(resource: any): OrganizationSummary | null {
    if (!resource?.id) {
      return null;
    }

    const typeCoding = resource.type?.[0]?.coding?.[0];

    const parentReference = String(resource.partOf?.reference || '').trim();
    const parentId = parentReference.startsWith('Organization/')
      ? parentReference.slice('Organization/'.length)
      : '';

    return {
      id: String(resource.id),
      identifier: String(resource.identifier?.[0]?.value || ''),
      active: Boolean(resource.active ?? true),
      typeCode: String(typeCoding?.code || ''),
      typeDisplay: String(resource.type?.[0]?.text || typeCoding?.display || typeCoding?.code || ''),
      name: String(resource.name || resource.alias?.[0] || resource.id),
      description: this.extractOrganizationDescription(resource),
      contacts: Array.isArray(resource.telecom)
        ? resource.telecom
            .map((item: any) => ({
              system: (['phone', 'email', 'url', 'other'].includes(item?.system) ? item.system : 'other') as OrganizationContact['system'],
              value: String(item?.value || '')
            }))
            .filter((item: { value: string }) => item.value.trim().length > 0)
        : [],
      addressCity: String(resource.address?.[0]?.city || '') || undefined,
      addressPostalCode: String(resource.address?.[0]?.postalCode || '') || undefined,
      parentReference: parentReference || undefined,
      parentId: parentId || undefined
    };
  }

  private convertResourceToProfile(resource: any): OrganizationProfile {
    const summary = this.convertResourceToSummary(resource);
    if (!summary) {
      throw new Error('Invalid Organization response');
    }

    const contacts = Array.isArray(resource.telecom)
      ? resource.telecom
        .map((item: any) => ({
          system: ['phone', 'email', 'url', 'other'].includes(item?.system) ? item.system : 'other',
          value: String(item?.value || '')
        }))
        .filter((item: { value: string }) => item.value.trim().length > 0)
      : [];

    return {
      id: summary.id,
      identifier: summary.identifier,
      active: summary.active,
      typeCode: summary.typeCode,
      typeDisplay: summary.typeDisplay,
      name: summary.name,
      description: summary.description,
      aliases: Array.isArray(resource.alias)
        ? resource.alias.map((item: any) => String(item || '').trim()).filter((item: string) => item.length > 0)
        : [],
      contacts,
      parentReference: String(resource.partOf?.reference || '').trim() || undefined,
      parentDisplay: String(resource.partOf?.display || '').trim() || undefined,
      address: resource.address?.[0]
        ? {
          lines: Array.isArray(resource.address[0].line)
            ? resource.address[0].line.map((line: any) => String(line || '')).filter((line: string) => line.trim().length > 0)
            : [],
          postalCode: String(resource.address[0].postalCode || ''),
          city: String(resource.address[0].city || ''),
          country: String(resource.address[0].country || '')
        }
        : undefined
    };
  }

  private convertProfileToResource(profile: OrganizationProfile): any {
    const address = profile.address;
    const description = (profile.description || '').trim();

    return {
      resourceType: 'Organization',
      identifier: profile.identifier.trim().length > 0
        ? [{ value: profile.identifier.trim() }]
        : undefined,
      active: profile.active,
      type: profile.typeCode.trim().length > 0
        ? [{
          coding: [{
            system: this.organizationTypeCodeSystemUrl,
            code: profile.typeCode.trim(),
            display: profile.typeDisplay.trim() || profile.typeCode.trim()
          }],
          text: profile.typeDisplay.trim() || profile.typeCode.trim()
        }]
        : undefined,
      name: profile.name.trim(),
      description: description || undefined,
      extension: description
        ? [{
          url: this.organizationDescriptionExtensionUrl,
          valueString: description
        }]
        : undefined,
      alias: (profile.aliases || []).map((alias) => alias.trim()).filter((alias) => alias.length > 0),
      telecom: profile.contacts
        .map((contact) => ({
          system: contact.system,
          value: contact.value.trim()
        }))
        .filter((contact) => contact.value.length > 0),
      partOf: profile.parentReference
        ? {
          reference: profile.parentReference,
          display: profile.parentDisplay?.trim() || undefined
        }
        : undefined,
      address: address
        ? [{
          line: (address.lines || []).map((line) => line.trim()).filter((line) => line.length > 0),
          postalCode: (address.postalCode || '').trim() || undefined,
          city: (address.city || '').trim() || undefined,
          country: (address.country || '').trim() || undefined
        }]
        : undefined
    };
  }

  private extractOrganizationDescription(resource: any): string {
    const direct = String(resource?.description || '').trim();
    if (direct) {
      return direct;
    }

    const extension = Array.isArray(resource?.extension)
      ? resource.extension.find((item: any) => String(item?.url || '').trim() === this.organizationDescriptionExtensionUrl)
      : null;

    return String(extension?.valueString || '').trim();
  }

  private fetchOrganizationOptions(criteria: { name?: string; identifier?: string; limit: number }): Observable<OrganizationOption[]> {
    let params = new HttpParams().set('_count', String(criteria.limit));

    if (criteria.name?.trim()) {
      params = params.set('name:contains', criteria.name.trim());
    }

    if (criteria.identifier?.trim()) {
      params = params.set('identifier', criteria.identifier.trim());
    }

    return this.apiService.get<any>(this.organizationEndpoint, { params }).pipe(
      map((bundle) => {
        if (!bundle?.entry) {
          return [];
        }

        return bundle.entry
          .map((entry: any) => entry?.resource)
          .filter((resource: any) => resource?.resourceType === 'Organization' && resource?.id)
          .map((resource: any): OrganizationOption => ({
            id: String(resource.id),
            reference: `Organization/${String(resource.id)}`,
            label: String(resource.name || resource.alias?.[0] || `Organization/${resource.id}`)
          }));
      })
    );
  }

  private mergeOptionsByReference(items: OrganizationOption[]): OrganizationOption[] {
    const unique = new Map<string, OrganizationOption>();
    items.forEach((item) => {
      if (!item.reference || unique.has(item.reference)) {
        return;
      }
      unique.set(item.reference, item);
    });
    return Array.from(unique.values());
  }

  private normalizeReference(reference: string): string {
    const value = String(reference || '').trim();
    if (!value) {
      return '';
    }
    if (value.startsWith('Organization/')) {
      return value;
    }
    if (value.startsWith('http://') || value.startsWith('https://')) {
      const idx = value.lastIndexOf('Organization/');
      if (idx >= 0) {
        return value.slice(idx);
      }
    }
    return value;
  }

  private ensureBfcOrganization(
    name: string,
    identifier: string,
    city: string,
    postalCode: string,
    parentReference: string
  ): Observable<OrganizationProfile> {
    return this.searchOrganizations({ identifier, limit: 1 }).pipe(
      switchMap((matches) => {
        if (matches.length > 0) {
          return this.getOrganization(matches[0].id).pipe(
            switchMap((existing) => {
              const nextParent = parentReference || '';
              const existingParent = existing.parentReference || '';
              if (nextParent === existingParent) {
                return of(existing);
              }
              return this.updateOrganization(existing.id || '', {
                ...existing,
                parentReference: nextParent || undefined,
                parentDisplay: undefined
              });
            })
          );
        }

        return this.createOrganization({
          identifier,
          active: true,
          typeCode: 'prov',
          typeDisplay: 'Prestataire de soins',
          name,
          description: `Etablissement Bourgogne-Franche-Comte - ${city}`,
          aliases: [],
          contacts: [],
          parentReference: parentReference || undefined,
          address: {
            lines: ['Adresse principale'],
            city,
            postalCode,
            country: 'FR'
          }
        });
      })
    );
  }
}
