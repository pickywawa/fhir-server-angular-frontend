import { computed, Injectable, signal } from '@angular/core';

export type UtilityDockView = 'chat' | 'agenda' | 'discussions' | 'procedure' | 'observation' | 'document' | 'patient-analysis';
export type ObservationDraftReturnView = 'close' | 'procedure';

const UTILITY_DOCK_VIEW_STORAGE_KEY = 'utilityDock.activeView';

@Injectable({
  providedIn: 'root'
})
export class ChatAssistantStateService {
  readonly activeView = signal<UtilityDockView | null>(this.loadInitialView());
  readonly isOpen = computed(() => this.activeView() !== null);
  readonly procedureDraftPatientId = signal<string | null>(null);
  readonly procedureDraftProcedureId = signal<string | null>(null);
  readonly hasProcedureDraft = computed(() => !!this.procedureDraftPatientId());
  readonly observationDraftPatientId = signal<string | null>(null);
  readonly observationDraftObservationId = signal<string | null>(null);
  readonly observationDraftReturnView = signal<ObservationDraftReturnView>('close');
  readonly observationRefreshToken = signal(0);
  readonly lastSavedObservation = signal<{ patientId: string; observation: any } | null>(null);
  readonly hasObservationDraft = computed(() => !!this.observationDraftPatientId());
  readonly documentDraftPatientId = signal<string | null>(null);
  readonly documentDraftDocumentId = signal<string | null>(null);
  readonly hasDocumentDraft = computed(() => !!this.documentDraftPatientId() && !!this.documentDraftDocumentId());
  readonly patientAnalysisPatientId = signal<string | null>(null);
  readonly patientAnalysisCarePlanId = signal<string | null>(null);
  readonly patientAnalysisExistingOnly = signal<boolean>(false);
  readonly hasPatientAnalysisDraft = computed(() => !!this.patientAnalysisPatientId());

  open(view: UtilityDockView = 'chat'): void {
    this.activeView.set(view);
    this.persistView(view);
  }

  close(): void {
    this.activeView.set(null);
    this.persistView(null);
  }

  toggle(view: UtilityDockView = 'chat'): void {
    this.activeView.update((current) => {
      const next = current === view ? null : view;
      this.persistView(next);
      return next;
    });
  }

  isViewActive(view: UtilityDockView): boolean {
    return this.activeView() === view;
  }

  startProcedureDraft(patientId: string, procedureId?: string): void {
    const normalizedId = String(patientId || '').trim();
    if (!normalizedId) {
      return;
    }

    this.procedureDraftPatientId.set(normalizedId);
    this.procedureDraftProcedureId.set(String(procedureId || '').trim() || null);
    this.open('procedure');
  }

  startObservationDraft(patientId: string, observationId?: string, returnView: ObservationDraftReturnView = 'close'): void {
    const normalizedId = String(patientId || '').trim();
    if (!normalizedId) {
      return;
    }

    this.observationDraftPatientId.set(normalizedId);
    this.observationDraftObservationId.set(String(observationId || '').trim() || null);
    this.observationDraftReturnView.set(returnView);
    this.open('observation');
  }

  notifyObservationSaved(patientId: string, observation: any): void {
    const normalizedId = String(patientId || '').trim();
    if (!normalizedId) {
      return;
    }

    this.lastSavedObservation.set({ patientId: normalizedId, observation });
    this.observationRefreshToken.update((value) => value + 1);
  }

  finishObservationDraft(patientId: string, observation: any): void {
    this.notifyObservationSaved(patientId, observation);
    const returnView = this.observationDraftReturnView();

    this.observationDraftPatientId.set(null);
    this.observationDraftObservationId.set(null);
    this.observationDraftReturnView.set('close');

    if (returnView === 'procedure') {
      this.open('procedure');
      return;
    }

    this.close();
  }

  clearObservationDraft(): void {
    this.observationDraftPatientId.set(null);
    this.observationDraftObservationId.set(null);
    this.observationDraftReturnView.set('close');
    if (this.activeView() === 'observation') {
      this.close();
    }
  }

  clearProcedureDraft(): void {
    this.procedureDraftPatientId.set(null);
    this.procedureDraftProcedureId.set(null);
    if (this.activeView() === 'procedure') {
      this.close();
    }
  }

  startDocumentDraft(patientId: string, documentId: string): void {
    const normalizedPatientId = String(patientId || '').trim();
    const normalizedDocumentId = String(documentId || '').trim();
    if (!normalizedPatientId || !normalizedDocumentId) {
      return;
    }

    this.documentDraftPatientId.set(normalizedPatientId);
    this.documentDraftDocumentId.set(normalizedDocumentId);
    this.open('document');
  }

  clearDocumentDraft(): void {
    this.documentDraftPatientId.set(null);
    this.documentDraftDocumentId.set(null);
    if (this.activeView() === 'document') {
      this.close();
    }
  }

  startPatientAnalysis(patientId: string): void {
    const normalizedPatientId = String(patientId || '').trim();
    if (!normalizedPatientId) {
      return;
    }

    this.patientAnalysisPatientId.set(normalizedPatientId);
    this.patientAnalysisCarePlanId.set(null);
    this.patientAnalysisExistingOnly.set(false);
    this.open('patient-analysis');
  }

  startPatientRiskAssessment(patientId: string, carePlanId: string): void {
    const normalizedPatientId = String(patientId || '').trim();
    const normalizedCarePlanId = String(carePlanId || '').trim();
    if (!normalizedPatientId || !normalizedCarePlanId) {
      return;
    }

    this.patientAnalysisPatientId.set(normalizedPatientId);
    this.patientAnalysisCarePlanId.set(normalizedCarePlanId);
    this.patientAnalysisExistingOnly.set(true);
    this.open('patient-analysis');
  }

  clearPatientAnalysisDraft(): void {
    this.patientAnalysisPatientId.set(null);
    this.patientAnalysisCarePlanId.set(null);
    this.patientAnalysisExistingOnly.set(false);
    if (this.activeView() === 'patient-analysis') {
      this.close();
    }
  }

  private loadInitialView(): UtilityDockView | null {
    if (typeof window === 'undefined') {
      return 'chat';
    }

    const raw = window.localStorage.getItem(UTILITY_DOCK_VIEW_STORAGE_KEY);
    if (raw === null) {
      return 'chat';
    }

    if (raw === 'none') {
      return null;
    }

    if (raw === 'chat' || raw === 'agenda' || raw === 'discussions') {
      return raw;
    }

    if (raw === 'procedure' || raw === 'document' || raw === 'patient-analysis') {
      return 'chat';
    }

    if (raw === 'observation') {
      return 'chat';
    }

    return 'chat';
  }

  private persistView(view: UtilityDockView | null): void {
    if (typeof window === 'undefined') {
      return;
    }

    window.localStorage.setItem(UTILITY_DOCK_VIEW_STORAGE_KEY, view ?? 'none');
  }
}