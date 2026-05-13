import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, catchError, tap, throwError } from 'rxjs';
import { environment } from '../../../../../../environments/environment';

export interface StructuredDocumentSummary {
  type_document: string;
  titre: string;
  date_document: string | null;
  auteur: string | null;
  resume: string;
  donnees_cles: Array<{
    type: string;
    label: string;
    valeur: string;
    unite: string | null;
    date: string | null;
  }>;
  actes: Array<{
    nom: string;
    date: string | null;
    statut: string;
  }>;
  observations: Array<{
    description: string;
    gravite: string;
    localisation: string | null;
  }>;
  traitements: Array<{
    nom: string;
    dosage: string | null;
    frequence: string | null;
    duree: string | null;
  }>;
  recommandations: string[];
  alertes: Array<{
    message: string;
    niveau: string;
  }>;
  metadata: {
    confidence: number;
    langue: string;
    source: string;
  };
}

export interface DocumentSummaryResponse {
  title: string;
  resume: string;
  description: string;
  summary: StructuredDocumentSummary;
  rawJson: string;
}

@Injectable({
  providedIn: 'root'
})
export class DocumentAiSummaryService {
  private readonly summaryBaseUrl = `${environment.chatBotUrl}/api/v1/document-summaries`;

  constructor(private readonly http: HttpClient) {}

  generateSummary(payload: {
    file: Blob;
    fileName: string;
    metadata: {
      sessionId?: string;
      practitionerId?: string;
      patientId?: string;
      documentReference: any;
    };
  }): Observable<DocumentSummaryResponse> {
    const formData = new FormData();
    formData.append('metadata', JSON.stringify(payload.metadata));
    formData.append('document', payload.file, payload.fileName || 'document');

    console.info('[DocumentSummaryService] POST generate payload', {
      url: `${this.summaryBaseUrl}/generate`,
      fileName: payload.fileName,
      fileType: payload.file.type,
      fileSize: payload.file.size,
      metadataKeys: Object.keys(payload.metadata || {}),
      metadataLength: JSON.stringify(payload.metadata || {}).length
    });

    return this.http.post<DocumentSummaryResponse>(`${this.summaryBaseUrl}/generate`, formData).pipe(
      tap((response) => {
        console.info('[DocumentSummaryService] generate success', {
          title: response?.title,
          resumeLength: String(response?.resume || '').length,
          descriptionLength: String(response?.description || '').length
        });
      }),
      catchError((error) => {
        console.error('[DocumentSummaryService] generate failed', {
          status: error?.status,
          statusText: error?.statusText,
          message: error?.message,
          errorBody: error?.error
        });
        return throwError(() => error);
      })
    );
  }
}
