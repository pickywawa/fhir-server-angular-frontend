import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';

export interface ChatRequest {
  sessionId: string;
  message: string;
  practitionerId?: string;
  patientId?: string;
  fromUrl?: string;
  contextFiles?: ChatContextFile[];
}

export interface ChatContextFile {
  name: string;
  contentType?: string;
  content: string;
  sizeBytes?: number;
}

export interface ChatResponse {
  sessionId: string;
  response: string;
  timestamp: string;
}

export interface ChatStreamEvent {
  sessionId: string;
  type: 'chunk' | 'done' | string;
  content: string;
}

export interface PatientAnalysisRequest {
  sessionId?: string;
  patientId: string;
  practitionerId?: string;
  patientData: Record<string, unknown>;
  options?: Record<string, unknown>;
}

export interface PatientAnalysisResponse {
  title: string;
  riskLevel: 'low' | 'moderate' | 'high' | 'critical';
  riskScore: number;
  clinicalSummary: string;
  interventionsSummary: string;
  followUpRecommendations: string[];
  alerts: Array<{
    label: string;
    severity: 'info' | 'warning' | 'critical';
    rationale: string;
  }>;
  nextActions: string[];
  metadata: {
    confidence: number;
    generatedAt: string;
    model: string;
  };
  rawJson: string;
}

@Injectable({
  providedIn: 'root'
})
export class ChatBotService {
  private readonly chatBaseUrl = `${environment.chatBotUrl}/api/v1/chat`;
  private readonly patientAnalysisBaseUrl = `${environment.chatBotUrl}/api/v1/patient-analysis`;

  constructor(private readonly http: HttpClient) {}

  chat(request: ChatRequest): Observable<ChatResponse> {
    return this.http.post<ChatResponse>(this.chatBaseUrl, request);
  }

  analyzePatient(request: PatientAnalysisRequest): Observable<PatientAnalysisResponse> {
    return this.http.post<PatientAnalysisResponse>(`${this.patientAnalysisBaseUrl}/generate`, request);
  }

  stream(request: ChatRequest): Observable<ChatStreamEvent> {
    return new Observable<ChatStreamEvent>((observer) => {
      const controller = new AbortController();

      fetch(`${this.chatBaseUrl}/stream`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(request),
        signal: controller.signal
      })
        .then(async (response) => {
          if (!response.ok) {
            const errorBody = await response.text();
            throw new Error(`Streaming request failed: ${response.status} ${errorBody}`);
          }
          if (!response.body) {
            throw new Error('Streaming response body is empty');
          }

          const reader = response.body.getReader();
          const decoder = new TextDecoder();
          let buffer = '';

          while (true) {
            const { value, done } = await reader.read();
            if (done) {
              break;
            }

            buffer += decoder.decode(value, { stream: true });
            let delimiterIndex = this.findSseDelimiter(buffer);

            while (delimiterIndex !== -1) {
              const rawEvent = buffer.slice(0, delimiterIndex);
              const delimiterLength = buffer.startsWith('\r\n\r\n', delimiterIndex) ? 4 : 2;
              buffer = buffer.slice(delimiterIndex + delimiterLength);
              this.parseSseEvent(rawEvent).forEach((evt) => observer.next(evt));
              delimiterIndex = this.findSseDelimiter(buffer);
            }
          }

          if (buffer.trim().length > 0) {
            this.parseSseEvent(buffer).forEach((evt) => observer.next(evt));
          }

          observer.complete();
        })
        .catch((error: unknown) => {
          if ((error as Error)?.name === 'AbortError') {
            observer.complete();
            return;
          }
          observer.error(error);
        });

      return () => controller.abort();
    });
  }

  private parseSseEvent(rawEvent: string): ChatStreamEvent[] {
    const events: ChatStreamEvent[] = [];
    const normalized = rawEvent.replace(/\r\n/g, '\n');
    const dataLines = normalized
      .split('\n')
      .filter((line) => line.startsWith('data:'))
      .map((line) => line.slice(5).trim())
      .filter((line) => line.length > 0);

    for (const dataLine of dataLines) {
      try {
        events.push(JSON.parse(dataLine) as ChatStreamEvent);
      } catch {
        // Ignore non-json payloads from SSE stream.
      }
    }

    return events;
  }

  private findSseDelimiter(buffer: string): number {
    const windowsDelimiter = buffer.indexOf('\r\n\r\n');
    const unixDelimiter = buffer.indexOf('\n\n');

    if (windowsDelimiter === -1) {
      return unixDelimiter;
    }
    if (unixDelimiter === -1) {
      return windowsDelimiter;
    }

    return Math.min(windowsDelimiter, unixDelimiter);
  }
}
