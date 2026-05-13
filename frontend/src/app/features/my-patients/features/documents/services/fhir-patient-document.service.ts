import { Injectable } from '@angular/core';
import { HttpHeaders, HttpParams } from '@angular/common/http';
import { Observable, catchError, map, of, switchMap, throwError } from 'rxjs';
import { ApiService } from '../../../../../core/services/api.service';
import { DocumentCodeOption, PatientDocumentHistoryItem, PatientDocumentItem } from '../models/patient-document.model';

@Injectable({
  providedIn: 'root'
})
export class FhirPatientDocumentService {
  private readonly fhirHeaders = new HttpHeaders({
    'Content-Type': 'application/fhir+json',
    Accept: 'application/fhir+json'
  });
  private readonly fhirReadHeaders = new HttpHeaders({
    Accept: 'application/fhir+json'
  });

  constructor(private readonly apiService: ApiService) {}

  listPatientDocuments(patientId: string): Observable<PatientDocumentItem[]> {
    const params = new HttpParams().set('subject', `Patient/${patientId}`).set('_sort', '-date').set('_count', '50');

    return this.apiService.get<any>('/DocumentReference', { params }).pipe(
      map((bundle) => {
        const entries = bundle?.entry ?? [];
        return entries
          .map((entry: any) => entry.resource)
          .filter((resource: any) => resource?.resourceType === 'DocumentReference')
          .map((doc: any): PatientDocumentItem => this.mapDocumentReferenceToItem(doc));
      })
    );
  }

  uploadPatientDocument(
    patientId: string,
    file: File,
    title: string,
    classCode: DocumentCodeOption,
    typeCode: DocumentCodeOption,
    authorReference: string
  ): Observable<PatientDocumentItem> {
    return this.fileToBase64(file).pipe(
      switchMap((base64Data) => {
        const binaryPayload = {
          resourceType: 'Binary',
          contentType: file.type || 'application/octet-stream',
          data: base64Data
        };

        return this.apiService.post<any>('/Binary', binaryPayload, { headers: this.fhirHeaders });
      }),
      switchMap((binaryResource) => {
        const now = new Date().toISOString();
        const payload = {
          resourceType: 'DocumentReference',
          status: 'current',
          subject: {
            reference: `Patient/${patientId}`
          },
          author: authorReference ? [{ reference: authorReference }] : [],
          date: now,
          description: title,
          category: [
            {
              coding: [
                {
                  system: classCode.system,
                  code: classCode.code,
                  display: classCode.display
                }
              ],
              text: classCode.display
            }
          ],
          type: {
            coding: [
              {
                system: typeCode.system,
                code: typeCode.code,
                display: typeCode.display
              }
            ],
            text: typeCode.display
          },
          content: [
            {
              attachment: {
                contentType: file.type || 'application/octet-stream',
                url: `Binary/${binaryResource.id}`,
                title,
                size: file.size,
                creation: now
              }
            }
          ]
        };

        return this.apiService.post<any>('/DocumentReference', payload, { headers: this.fhirHeaders });
      }),
      map((doc: any) => this.mapDocumentReferenceToItem(doc))
    );
  }

  replaceDocumentBinary(documentId: string, file: File): Observable<PatientDocumentItem> {
    return this.fileToBase64(file).pipe(
      switchMap((base64Data) => {
        const binaryPayload = {
          resourceType: 'Binary',
          contentType: file.type || 'application/octet-stream',
          data: base64Data
        };

        return this.apiService.post<any>('/Binary', binaryPayload, { headers: this.fhirHeaders });
      }),
      switchMap((binaryResource) => this.getDocumentReferenceById(documentId).pipe(
        switchMap((doc) => {
          const now = new Date().toISOString();
          const currentContent = Array.isArray(doc?.content) ? [...doc.content] : [];
          const currentFirst = currentContent[0] || {};
          const currentAttachment = currentFirst.attachment || {};

          currentContent[0] = {
            ...currentFirst,
            attachment: {
              ...currentAttachment,
              contentType: file.type || currentAttachment.contentType || 'application/octet-stream',
              url: `Binary/${binaryResource.id}`,
              title: currentAttachment.title || doc?.description || file.name,
              size: file.size,
              creation: now
            }
          };

          const updatedResource = {
            ...doc,
            date: now,
            content: currentContent
          };

          return this.updateDocumentReference(documentId, updatedResource);
        })
      )),
      map((doc) => this.mapDocumentReferenceToItem(doc))
    );
  }

  getDocumentReferenceHistory(documentId: string): Observable<PatientDocumentHistoryItem[]> {
    const params = new HttpParams().set('_count', '50').set('_sort', '-_lastUpdated');
    return this.apiService.get<any>(`/DocumentReference/${documentId}/_history`, { headers: this.fhirReadHeaders, params }).pipe(
      map((bundle) => {
        const entries = Array.isArray(bundle?.entry) ? bundle.entry : [];
        return entries
          .map((entry: any) => entry?.resource)
          .filter((resource: any) => resource?.resourceType === 'DocumentReference')
          .map((doc: any): PatientDocumentHistoryItem => ({
            versionId: String(doc?.meta?.versionId || ''),
            lastUpdated: String(doc?.meta?.lastUpdated || doc?.date || ''),
            title: String(doc?.description || doc?.content?.[0]?.attachment?.title || 'Document sans titre'),
            authorReference: String(doc?.author?.[0]?.reference || ''),
            authorLabel: String(doc?.author?.[0]?.display || doc?.author?.[0]?.reference || 'Auteur non renseigne'),
            contentType: String(doc?.content?.[0]?.attachment?.contentType || 'application/octet-stream'),
            binaryUrl: String(doc?.content?.[0]?.attachment?.url || '')
          }));
      })
    );
  }

  getDocumentReferenceById(documentId: string): Observable<any> {
    const params = new HttpParams().set('_ts', String(Date.now()));
    return this.apiService.get<any>(`/DocumentReference/${documentId}`, { headers: this.fhirReadHeaders, params }).pipe(
      catchError((error: any) => {
        if (error?.status === 0 || error?.status === 304) {
          return this.getDocumentReferenceBySearch(documentId);
        }
        return throwError(() => error);
      })
    );
  }

  updateDocumentReference(documentId: string, resource: any): Observable<any> {
    return this.apiService.put<any>(`/DocumentReference/${documentId}`, resource, { headers: this.fhirHeaders });
  }

  getBinaryContent(binaryUrl: string): Observable<{ contentType: string; data: string }> {
    const endpoint = binaryUrl.startsWith('/') ? binaryUrl : `/${binaryUrl}`;
    return this.apiService.get<any>(endpoint, { headers: this.fhirReadHeaders }).pipe(
      map((binary) => ({
        contentType: binary?.contentType || 'application/octet-stream',
        data: binary?.data || ''
      }))
    );
  }

  resolveReferenceDisplay(reference: string): Observable<string> {
    const normalized = this.normalizeReference(reference);
    if (!normalized) {
      return of('Inconnu');
    }

    return this.apiService.get<any>(`/${normalized}`, { headers: this.fhirReadHeaders }).pipe(
      map((resource) => {
        if (resource?.resourceType === 'Practitioner') {
          const first = resource?.name?.[0]?.given?.[0] || '';
          const last = resource?.name?.[0]?.family || '';
          const text = `${first} ${last}`.trim();
          return text || resource?.name?.[0]?.text || normalized;
        }

        return resource?.name || resource?.id || normalized;
      })
    );
  }

  private fileToBase64(file: File): Observable<string> {
    return new Observable<string>((observer) => {
      const reader = new FileReader();
      reader.onload = () => {
        const raw = String(reader.result || '');
        const base64 = raw.includes(',') ? raw.split(',')[1] : raw;
        observer.next(base64);
        observer.complete();
      };
      reader.onerror = () => observer.error(new Error('Impossible de lire le fichier.'));
      reader.readAsDataURL(file);
    });
  }

  private normalizeReference(reference: string): string {
    const value = String(reference || '').trim();
    if (!value) {
      return '';
    }

    if (value.startsWith('http://') || value.startsWith('https://')) {
      const known = ['Practitioner/', 'Patient/', 'CareTeam/'];
      for (const marker of known) {
        const idx = value.lastIndexOf(marker);
        if (idx >= 0) {
          return value.slice(idx);
        }
      }
    }

    return value;
  }

  private getDocumentReferenceBySearch(documentId: string): Observable<any> {
    const params = new HttpParams().set('_id', documentId).set('_count', '1').set('_ts', String(Date.now()));

    return this.apiService.get<any>('/DocumentReference', { headers: this.fhirReadHeaders, params }).pipe(
      map((bundle) => {
        const resource = bundle?.entry?.[0]?.resource;
        if (!resource || resource.resourceType !== 'DocumentReference') {
          throw new Error('DocumentReference not found');
        }
        return resource;
      })
    );
  }

  private mapDocumentReferenceToItem(doc: any): PatientDocumentItem {
    const attachmentTitle = String(doc?.content?.[0]?.attachment?.title || '').trim();
    const description = String(doc?.description || '').trim();
    const legacySummary = String(doc?.relatedTo?.[0]?.description || '').trim();
    const aiSummaryDescription = description && description !== attachmentTitle ? description : legacySummary;

    return {
      id: doc.id,
      title: attachmentTitle || description || 'Document sans titre',
      classLabel:
        doc.category?.[0]?.coding?.[0]?.display ||
        doc.category?.[0]?.text ||
        'Classe non renseignee',
      typeLabel:
        doc.type?.coding?.[0]?.display ||
        doc.type?.text ||
        'Type non renseigne',
      contentType: doc.content?.[0]?.attachment?.contentType || 'application/octet-stream',
      createdAt: doc.date || doc.content?.[0]?.attachment?.creation || '',
      binaryUrl: doc.content?.[0]?.attachment?.url || '',
      authorReference: doc.author?.[0]?.reference || '',
      authorLabel: doc.author?.[0]?.display || doc.author?.[0]?.reference || 'Auteur non renseigne',
      patientReference: doc.subject?.reference || '',
      sizeBytes: doc.content?.[0]?.attachment?.size || 0,
      aiSummaryDescription
    };
  }
}
