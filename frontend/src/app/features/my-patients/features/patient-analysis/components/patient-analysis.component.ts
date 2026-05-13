import { CommonModule } from '@angular/common';
import { HttpParams } from '@angular/common/http';
import { Component, Input, OnChanges, SimpleChanges, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { TranslateModule } from '@ngx-translate/core';
import { firstValueFrom } from 'rxjs';
import { ApiService } from '../../../../../core/services/api.service';
import {
  ChatBotService,
  PatientAnalysisResponse
} from '../../../../../core/services/chat-bot.service';
import { AuthService } from '../../../../../core/services/auth.service';
import { FhirCarePlanService } from '../../careplan/services/fhir-care-plan.service';
import { FhirPatientDiscussionService } from '../../discussions/services/fhir-patient-discussion.service';
import { FhirPatientDocumentService } from '../../documents/services/fhir-patient-document.service';
import { DocumentAiSummaryService } from '../../documents/services/document-ai-summary.service';
import { FhirPatientObservationService } from '../../observations/services/fhir-patient-observation.service';
import { FhirPatientProcedureService } from '../../procedures/services/fhir-patient-procedure.service';
import { FhirPatientQuestionnaireService } from '../../questionnaires/services/fhir-patient-questionnaire.service';
import { FhirCareTeamService } from '../../care-team/services/fhir-care-team.service';
import { PatientDocumentItem } from '../../documents/models/patient-document.model';

interface StepStatus {
  key: string;
  labelKey: string;
  descriptionKey: string;
  status: 'idle' | 'loading' | 'success' | 'error';
  error?: string;
}

interface DocumentSummaryProgress {
  documentId: string;
  title: string;
  status: 'idle' | 'loading' | 'success' | 'error';
  summary: string;
  expanded: boolean;
  error?: string;
}

interface AggregatedPatientData {
  identity: any;
  documents: Array<PatientDocumentItem & { aiSummaryDescription: string }>;
  procedures: any[];
  diagnosticReports: any[];
  observations: any[];
  questionnaireResponses: any[];
  carePlans: any[];
  patientActions: any[];
  appointments: any[];
  discussions: any[];
  careTeam: any[];
}

@Component({
  selector: 'app-patient-analysis',
  standalone: true,
  imports: [CommonModule, FormsModule, TranslateModule],
  templateUrl: './patient-analysis.component.html',
  styleUrl: './patient-analysis.component.scss'
})
export class PatientAnalysisComponent implements OnChanges {
  @Input() patientIdInput?: string;
  @Input() carePlanIdInput?: string;
  @Input() existingOnlyInput = false;

  private readonly apiService = inject(ApiService);
  private readonly authService = inject(AuthService);
  private readonly chatBotService = inject(ChatBotService);
  private readonly documentService = inject(FhirPatientDocumentService);
  private readonly documentSummaryService = inject(DocumentAiSummaryService);
  private readonly procedureService = inject(FhirPatientProcedureService);
  private readonly observationService = inject(FhirPatientObservationService);
  private readonly questionnaireService = inject(FhirPatientQuestionnaireService);
  private readonly carePlanService = inject(FhirCarePlanService);
  private readonly discussionService = inject(FhirPatientDiscussionService);
  private readonly careTeamService = inject(FhirCareTeamService);

  readonly dataSteps: StepStatus[] = [
    { key: 'identity', labelKey: 'myPatients.patientAnalysis.steps.identity', descriptionKey: 'myPatients.patientAnalysis.stepDescriptions.identity', status: 'idle' },
    { key: 'documents', labelKey: 'myPatients.patientAnalysis.steps.documents', descriptionKey: 'myPatients.patientAnalysis.stepDescriptions.documents', status: 'idle' },
    { key: 'procedures', labelKey: 'myPatients.patientAnalysis.steps.procedures', descriptionKey: 'myPatients.patientAnalysis.stepDescriptions.procedures', status: 'idle' },
    { key: 'observations', labelKey: 'myPatients.patientAnalysis.steps.observations', descriptionKey: 'myPatients.patientAnalysis.stepDescriptions.observations', status: 'idle' },
    { key: 'questionnaires', labelKey: 'myPatients.patientAnalysis.steps.questionnaires', descriptionKey: 'myPatients.patientAnalysis.stepDescriptions.questionnaires', status: 'idle' },
    { key: 'careplan', labelKey: 'myPatients.patientAnalysis.steps.careplan', descriptionKey: 'myPatients.patientAnalysis.stepDescriptions.careplan', status: 'idle' },
    { key: 'actions', labelKey: 'myPatients.patientAnalysis.steps.actions', descriptionKey: 'myPatients.patientAnalysis.stepDescriptions.actions', status: 'idle' },
    { key: 'appointments', labelKey: 'myPatients.patientAnalysis.steps.appointments', descriptionKey: 'myPatients.patientAnalysis.stepDescriptions.appointments', status: 'idle' },
    { key: 'discussions', labelKey: 'myPatients.patientAnalysis.steps.discussions', descriptionKey: 'myPatients.patientAnalysis.stepDescriptions.discussions', status: 'idle' },
    { key: 'intervenants', labelKey: 'myPatients.patientAnalysis.steps.intervenants', descriptionKey: 'myPatients.patientAnalysis.stepDescriptions.intervenants', status: 'idle' }
  ];

  documentProgress: DocumentSummaryProgress[] = [];
  analysisLoading = false;
  isProcessing = false;
  cancelRequested = false;
  hasStarted = false;
  isEditingResult = false;
  isSavingRiskAssessment = false;
  analysisError = '';
  analysisResponse: PatientAnalysisResponse | null = null;
  validationStatus: 'pending' | 'accepted' | 'rejected' | null = null;
  editableClinicalSummary = '';
  editableInterventionsSummary = '';
  editableRecommendations = '';
  editableAlerts = '';

  private activePatientId = '';
  private activeCarePlanId = '';
  private currentRiskAssessmentId: string | null = null;
  private readonly riskAssessmentConfidenceExtensionUrl = 'https://healthapp.local/fhir/StructureDefinition/riskassessment-confidence';

  ngOnChanges(changes: SimpleChanges): void {
    if (!changes['patientIdInput'] && !changes['carePlanIdInput'] && !changes['existingOnlyInput']) {
      return;
    }

    const nextPatientId = String(this.patientIdInput || '').trim();
    const nextCarePlanId = String(this.carePlanIdInput || '').trim();
    const patientChanged = nextPatientId !== this.activePatientId;
    const carePlanChanged = nextCarePlanId !== this.activeCarePlanId;
    const modeChanged = !!changes['existingOnlyInput'];

    if (!nextPatientId) {
      return;
    }

    if (!patientChanged && !carePlanChanged && !modeChanged) {
      return;
    }

    this.activePatientId = nextPatientId;
    this.activeCarePlanId = nextCarePlanId;
    this.hasStarted = false;
    this.resetState();

    if (this.existingOnlyInput && this.activeCarePlanId) {
      this.hasStarted = true;
      void this.loadExistingRiskAssessment(this.activePatientId, this.activeCarePlanId);
    }
  }

  launchAnalysis(): void {
    if (!this.activePatientId || this.isProcessing) {
      return;
    }

    this.hasStarted = true;
    void this.runAnalysis(this.activePatientId);
  }

  toggleEditResult(): void {
    if (!this.analysisResponse) {
      return;
    }

    this.isEditingResult = !this.isEditingResult;
    if (this.isEditingResult) {
      this.syncEditableFromResponse(this.analysisResponse);
    }
  }

  toggleSummary(progress: DocumentSummaryProgress): void {
    progress.expanded = !progress.expanded;
  }

  async validateAnalysis(accepted: boolean): Promise<void> {
    if (!accepted) {
      this.validationStatus = 'rejected';
      return;
    }

    if (!this.analysisResponse || this.isSavingRiskAssessment) {
      return;
    }

    this.isSavingRiskAssessment = true;
    this.analysisError = '';

    try {
      const carePlanId = this.activeCarePlanId || await this.resolveTargetCarePlanId(this.activePatientId);
      if (!carePlanId) {
        throw new Error('Aucun CarePlan cible pour sauvegarder le RiskAssessment.');
      }

      const normalizedResponse = this.buildResponseFromEditable(this.analysisResponse);
      this.analysisResponse = normalizedResponse;

      const savedRiskId = await this.upsertRiskAssessmentForCarePlan(
        carePlanId,
        this.activePatientId,
        normalizedResponse
      );

      this.currentRiskAssessmentId = savedRiskId;
      this.activeCarePlanId = carePlanId;
      this.validationStatus = 'accepted';
      this.isEditingResult = false;
    } catch (error) {
      this.analysisError = this.resolveError(error, 'Erreur lors de la sauvegarde du RiskAssessment.');
    } finally {
      this.isSavingRiskAssessment = false;
    }
  }

  retry(): void {
    if (!this.activePatientId) {
      return;
    }
    this.hasStarted = true;
    if (this.existingOnlyInput && this.activeCarePlanId) {
      void this.loadExistingRiskAssessment(this.activePatientId, this.activeCarePlanId);
      return;
    }
    void this.runAnalysis(this.activePatientId);
  }

  cancelAnalysis(): void {
    this.cancelRequested = true;
  }

  riskBadgeClass(level: string): string {
    const normalized = String(level || '').toLowerCase();
    if (normalized === 'low') {
      return 'badge-low';
    }
    if (normalized === 'high') {
      return 'badge-high';
    }
    if (normalized === 'critical') {
      return 'badge-critical';
    }
    return 'badge-moderate';
  }

  confidencePercent(value: number | undefined): number {
    const safe = Number(value);
    if (!Number.isFinite(safe)) {
      return 0;
    }
    return Math.round(Math.max(0, Math.min(1, safe)) * 100);
  }

  private async runAnalysis(patientId: string): Promise<void> {
    this.resetState();
    this.isProcessing = true;

    try {
      const aggregated = await this.fetchAllData(patientId);
      if (this.cancelRequested) {
        this.analysisError = 'Analyse annulee.';
        return;
      }

      aggregated.documents = await this.generateMissingDocumentSummaries(patientId, aggregated.documents);
      if (this.cancelRequested) {
        this.analysisError = 'Analyse annulee.';
        return;
      }

      this.analysisLoading = true;
      this.analysisError = '';

      const practitionerId = this.authService.getConnectedPractitionerId() || undefined;
      const requestPayload = {
        sessionId: this.newSessionId(),
        patientId,
        practitionerId,
        patientData: this.buildCompactPayload(aggregated)
      };

      this.analysisResponse = this.cancelRequested
        ? null
        : await firstValueFrom(this.chatBotService.analyzePatient(requestPayload));

      if (this.cancelRequested) {
        this.analysisResponse = null;
        this.analysisError = 'Analyse annulee.';
        return;
      }

      this.validationStatus = 'pending';
      if (this.analysisResponse) {
        this.syncEditableFromResponse(this.analysisResponse);
      }
    } catch (error) {
      this.analysisError = this.resolveError(error, 'Erreur lors de la generation de l analyse patient.');
    } finally {
      this.analysisLoading = false;
      this.isProcessing = false;
    }
  }

  private resetState(): void {
    this.analysisLoading = false;
    this.isProcessing = false;
    this.cancelRequested = false;
    this.analysisError = '';
    this.analysisResponse = null;
    this.currentRiskAssessmentId = null;
    this.isEditingResult = false;
    this.isSavingRiskAssessment = false;
    this.editableClinicalSummary = '';
    this.editableInterventionsSummary = '';
    this.editableRecommendations = '';
    this.editableAlerts = '';
    this.validationStatus = null;
    this.documentProgress = [];

    this.dataSteps.forEach((step) => {
      step.status = 'idle';
      step.error = '';
    });
  }

  private async fetchAllData(patientId: string): Promise<AggregatedPatientData> {
    const [
      identity,
      documents,
      proceduresWithReports,
      observations,
      questionnaireResponses,
      carePlans,
      patientActions,
      appointments,
      discussions,
      careTeam
    ] = await Promise.all([
      this.fetchStep('identity', () => this.fetchIdentity(patientId), {}),
      this.fetchStep('documents', () => firstValueFrom(this.documentService.listPatientDocuments(patientId)), [] as PatientDocumentItem[]),
      this.fetchStep('procedures', () => this.fetchProceduresAndDiagnosticReports(patientId), { procedures: [], diagnosticReports: [] }),
      this.fetchStep('observations', () => firstValueFrom(this.observationService.searchObservationsByPatient(patientId)), []),
      this.fetchStep('questionnaires', () => this.fetchQuestionnaireResponses(patientId), []),
      this.fetchStep('careplan', () => this.fetchCarePlans(patientId), []),
      this.fetchStep('actions', () => this.fetchPatientActions(patientId), []),
      this.fetchStep('appointments', () => this.fetchAppointments(patientId), []),
      this.fetchStep('discussions', () => firstValueFrom(this.discussionService.listMessagesByPatient(patientId)), []),
      this.fetchStep('intervenants', () => firstValueFrom(this.careTeamService.getMembersByPatient(patientId)), [])
    ]);

    return {
      identity,
      documents: (documents || []).map((item) => ({ ...item, aiSummaryDescription: String(item.aiSummaryDescription || '').trim() })),
      procedures: proceduresWithReports.procedures,
      diagnosticReports: proceduresWithReports.diagnosticReports,
      observations,
      questionnaireResponses,
      carePlans,
      patientActions,
      appointments,
      discussions,
      careTeam
    };
  }

  private async fetchIdentity(patientId: string): Promise<any> {
    return firstValueFrom(this.apiService.get<any>(`/Patient/${patientId}`));
  }

  private async fetchProceduresAndDiagnosticReports(patientId: string): Promise<{ procedures: any[]; diagnosticReports: any[] }> {
    const procedureSummaries = await firstValueFrom(this.procedureService.searchProceduresByPatient(patientId));
    const procedures = await Promise.all(
      procedureSummaries.map(async (summary) => {
        try {
          return await firstValueFrom(this.procedureService.getProcedure(summary.id));
        } catch {
          return summary;
        }
      })
    );

    const reportReferences = Array.from(
      new Set(
        procedures
          .map((procedure: any) => String(procedure?.reportReference || '').trim())
          .filter((reference) => reference.length > 0)
      )
    );

    const diagnosticReports = await Promise.all(
      reportReferences.map(async (reference) => {
        const endpoint = reference.startsWith('/') ? reference : `/${reference}`;
        try {
          return await firstValueFrom(this.apiService.get<any>(endpoint));
        } catch {
          return null;
        }
      })
    );

    return {
      procedures,
      diagnosticReports: diagnosticReports.filter((item): item is any => !!item)
    };
  }

  private async fetchQuestionnaireResponses(patientId: string): Promise<any[]> {
    const responses = await firstValueFrom(this.questionnaireService.searchResponsesByPatient(patientId));
    const limitedResponses = responses.slice(0, 40);

    const details = await Promise.all(
      limitedResponses.map(async (response) => {
        try {
          const detail = await firstValueFrom(this.questionnaireService.getResponse(response.id));
          return {
            ...response,
            answers: this.questionnaireService.extractAnswerMap(detail),
            item: detail.item
          };
        } catch {
          return {
            ...response,
            answers: {}
          };
        }
      })
    );

    return details;
  }

  private async fetchCarePlans(patientId: string): Promise<any[]> {
    const result = await firstValueFrom(this.carePlanService.getCarePlansForPatient(patientId));
    const carePlans = Array.isArray(result?.carePlans) ? result.carePlans : [];

    const withActivities = await Promise.all(
      carePlans.map(async (carePlan) => {
        const activityReferences = Array.isArray(carePlan.activityReferences) ? carePlan.activityReferences : [];
        const activities = await Promise.all(
          activityReferences.map(async (reference: string) => {
            const ref = String(reference || '').trim();
            if (!ref.includes('/')) {
              return null;
            }
            try {
              return await firstValueFrom(this.apiService.get<any>(`/${ref}`));
            } catch {
              return { reference: ref, unresolved: true };
            }
          })
        );

        return {
          ...carePlan,
          activities: activities.filter((entry): entry is any => !!entry)
        };
      })
    );

    return withActivities;
  }

  private async fetchPatientActions(patientId: string): Promise<any[]> {
    const commonParams = new HttpParams().set('_count', '100').set('_sort', '-_lastUpdated');

    try {
      const patientParams = commonParams.set('patient', patientId);
      const patientBundle = await firstValueFrom(this.apiService.get<any>('/Task', { params: patientParams }));
      const entries = Array.isArray(patientBundle?.entry) ? patientBundle.entry : [];
      return entries.map((entry: any) => entry?.resource).filter((resource: any) => resource?.resourceType === 'Task');
    } catch {
      const fallbackParams = commonParams.set('for', `Patient/${patientId}`);
      const bundle = await firstValueFrom(this.apiService.get<any>('/Task', { params: fallbackParams }));
      const entries = Array.isArray(bundle?.entry) ? bundle.entry : [];
      return entries.map((entry: any) => entry?.resource).filter((resource: any) => resource?.resourceType === 'Task');
    }

  }

  private async fetchAppointments(patientId: string): Promise<any[]> {
    const params = new HttpParams().set('actor', `Patient/${patientId}`).set('_count', '100').set('_sort', '-date');
    const bundle = await firstValueFrom(this.apiService.get<any>('/Appointment', { params }));
    const entries = Array.isArray(bundle?.entry) ? bundle.entry : [];
    return entries
      .map((entry: any) => entry?.resource)
      .filter((resource: any) => resource?.resourceType === 'Appointment');
  }

  private async generateMissingDocumentSummaries(
    patientId: string,
    documents: Array<PatientDocumentItem & { aiSummaryDescription: string }>
  ): Promise<Array<PatientDocumentItem & { aiSummaryDescription: string }>> {
    this.documentProgress = documents.map((document) => ({
      documentId: document.id,
      title: document.title,
      status: document.aiSummaryDescription ? 'success' : 'idle',
      summary: document.aiSummaryDescription,
      expanded: false
    }));

    const missingDocuments = documents.filter((document) => !document.aiSummaryDescription && !!document.binaryUrl);

    for (const document of missingDocuments) {
      if (this.cancelRequested) {
        this.setDocumentProgressStatus(document.id, 'error', '', 'Annule');
        continue;
      }

      this.setDocumentProgressStatus(document.id, 'loading');

      try {
        const summary = await this.generateAndPersistSummary(patientId, document);
        document.aiSummaryDescription = summary;
        this.setDocumentProgressStatus(document.id, 'success', summary);
      } catch (error) {
        this.setDocumentProgressStatus(
          document.id,
          'error',
          '',
          this.resolveError(error, 'Generation du resume impossible pour ce document.')
        );
      }
    }

    return documents;
  }

  private async generateAndPersistSummary(patientId: string, document: PatientDocumentItem): Promise<string> {
    const documentReference = await firstValueFrom(this.documentService.getDocumentReferenceById(document.id));
    const binary = await firstValueFrom(this.documentService.getBinaryContent(document.binaryUrl));
    const blob = this.base64ToBlob(binary.data, binary.contentType || document.contentType || 'application/octet-stream');

    const summaryResponse = await firstValueFrom(
      this.documentSummaryService.generateSummary({
        file: blob,
        fileName: document.title || 'document',
        metadata: {
          patientId,
          practitionerId: this.authService.getConnectedPractitionerId() || undefined,
          documentReference
        }
      })
    );

    const summaryValue = String(summaryResponse?.resume || '').trim();
    const content = Array.isArray(documentReference?.content) ? [...documentReference.content] : [];
    const firstContent = content[0] || {};
    const attachment = firstContent.attachment || {};
    const safeTitle = String(document.title || attachment.title || '').trim();

    if (safeTitle) {
      content[0] = {
        ...firstContent,
        attachment: {
          ...attachment,
          title: safeTitle
        }
      };
      documentReference.content = content;
    }

    documentReference.description = summaryValue;
    const relatedTo = Array.isArray(documentReference?.relatedTo) ? [...documentReference.relatedTo] : [];
    if (!relatedTo.length) {
      relatedTo.push({});
    }
    relatedTo[0] = {
      ...relatedTo[0],
      description: summaryValue
    };

    documentReference.relatedTo = relatedTo;
    await firstValueFrom(this.documentService.updateDocumentReference(document.id, documentReference));

    return summaryValue;
  }

  private buildCompactPayload(data: AggregatedPatientData): Record<string, unknown> {
    return {
      identity: this.compactIdentity(data.identity),
      documents: data.documents.map((item) => ({
        id: item.id,
        title: item.title,
        classLabel: item.classLabel,
        typeLabel: item.typeLabel,
        author: item.authorLabel || item.authorReference,
        createdAt: item.createdAt,
        aiSummary: item.aiSummaryDescription
      })),
      procedures: data.procedures.map((item: any) => ({
        id: item.id,
        status: item.status,
        category: item.categoryDisplay,
        code: item.codeDisplay,
        start: item.occurrenceStart,
        end: item.occurrenceEnd,
        recorded: item.recorded,
        location: item.location,
        performers: item.performerDisplays,
        note: item.note
      })),
      diagnosticReports: data.diagnosticReports.map((item: any) => ({
        id: item.id,
        status: item.status,
        code: item.code?.text || item.code?.coding?.[0]?.display || item.code?.coding?.[0]?.code || '',
        category: item.category?.[0]?.text || item.category?.[0]?.coding?.[0]?.display || '',
        effectiveDateTime: item.effectiveDateTime,
        issued: item.issued,
        performer: item.performer?.[0]?.display || item.performer?.[0]?.reference || '',
        conclusion: item.conclusion || '',
        resultCount: Array.isArray(item.result) ? item.result.length : 0
      })),
      observations: data.observations.map((item: any) => ({
        id: item.id,
        category: item.categoryDisplay,
        code: item.codeDisplay,
        valueType: item.valueType,
        value: this.toObservationValue(item),
        performer: item.performerDisplay,
        interpretation: item.interpretationCode,
        effectiveDateTime: item.effectiveDateTime,
        note: item.note
      })),
      questionnaireResponses: data.questionnaireResponses.map((item: any) => ({
        id: item.id,
        questionnaireId: item.questionnaireId,
        status: item.status,
        authored: item.authored,
        answers: item.answers
      })),
      carePlans: data.carePlans.map((item: any) => ({
        id: item.id,
        title: item.title,
        status: item.status,
        intent: item.intent,
        categoryCode: item.categoryCode,
        description: item.description,
        note: item.note,
        activityCount: Array.isArray(item.activities) ? item.activities.length : 0,
        activities: (item.activities || []).map((activity: any) => ({
          resourceType: activity.resourceType || 'Unknown',
          id: activity.id || activity.reference || '',
          status: activity.status || '',
          description: activity.description || activity.title || activity.code?.text || ''
        }))
      })),
      patientActions: data.patientActions.map((item: any) => ({
        id: item.id,
        status: item.status,
        priority: item.priority,
        authoredOn: item.authoredOn,
        description: item.description,
        owner: item.owner?.display || item.owner?.reference || '',
        requester: item.requester?.display || item.requester?.reference || ''
      })),
      appointments: data.appointments.map((item: any) => ({
        id: item.id,
        status: item.status,
        start: item.start,
        end: item.end,
        description: item.description || item.comment || '',
        type: item.appointmentType?.text || item.appointmentType?.coding?.[0]?.display || '',
        participantCount: Array.isArray(item.participant) ? item.participant.length : 0
      })),
      discussions: data.discussions.map((item: any) => ({
        id: item.id,
        discussionId: item.discussionId,
        sent: item.sent,
        sender: item.senderReference,
        recipients: item.recipientReferences,
        content: String(item.content || '').slice(0, 300)
      })),
      careTeam: data.careTeam.map((item: any) => ({
        id: item.id,
        name: item.name,
        role: item.role,
        reference: item.reference
      })),
      stats: {
        documentCount: data.documents.length,
        procedureCount: data.procedures.length,
        diagnosticReportCount: data.diagnosticReports.length,
        observationCount: data.observations.length,
        questionnaireCount: data.questionnaireResponses.length,
        carePlanCount: data.carePlans.length,
        actionCount: data.patientActions.length,
        appointmentCount: data.appointments.length,
        discussionCount: data.discussions.length,
        careTeamCount: data.careTeam.length
      }
    };
  }

  private compactIdentity(resource: any): Record<string, unknown> {
    const name = resource?.name?.[0] || {};
    const telecom = Array.isArray(resource?.telecom) ? resource.telecom : [];
    const address = resource?.address?.[0] || {};

    return {
      id: String(resource?.id || ''),
      active: !!resource?.active,
      familyName: String(name?.family || ''),
      givenNames: Array.isArray(name?.given) ? name.given : [],
      birthDate: String(resource?.birthDate || ''),
      gender: String(resource?.gender || ''),
      telecom: telecom.map((item: any) => ({
        system: item.system,
        value: item.value,
        use: item.use
      })),
      address: {
        line: Array.isArray(address?.line) ? address.line : [],
        city: address?.city,
        postalCode: address?.postalCode,
        country: address?.country
      },
      identifiers: (resource?.identifier || []).map((item: any) => ({
        system: item.system,
        value: item.value,
        type: item.type?.text || item.type?.coding?.[0]?.code || ''
      }))
    };
  }

  private toObservationValue(observation: any): string | number | boolean | null {
    if (observation.valueType === 'string') {
      return observation.valueString || null;
    }
    if (observation.valueType === 'integer') {
      return Number.isFinite(observation.valueInteger) ? observation.valueInteger : null;
    }
    if (observation.valueType === 'boolean') {
      return typeof observation.valueBoolean === 'boolean' ? observation.valueBoolean : null;
    }
    if (observation.valueType === 'date') {
      return observation.valueDate || null;
    }
    return null;
  }

  private async fetchStep<T>(key: string, factory: () => Promise<T>, fallback: T): Promise<T> {
    this.setStepStatus(key, 'loading');
    try {
      const result = await factory();
      this.setStepStatus(key, 'success');
      return result;
    } catch (error) {
      this.setStepStatus(key, 'error', this.resolveError(error, 'Erreur de recuperation'));
      return fallback;
    }
  }

  private setStepStatus(key: string, status: 'idle' | 'loading' | 'success' | 'error', error = ''): void {
    const step = this.dataSteps.find((entry) => entry.key === key);
    if (!step) {
      return;
    }

    step.status = status;
    step.error = error;
  }

  private setDocumentProgressStatus(
    documentId: string,
    status: 'idle' | 'loading' | 'success' | 'error',
    summary = '',
    error = ''
  ): void {
    const item = this.documentProgress.find((entry) => entry.documentId === documentId);
    if (!item) {
      return;
    }

    item.status = status;
    item.summary = summary;
    item.error = error;
  }

  private base64ToBlob(base64Data: string, contentType: string): Blob {
    const binary = atob(base64Data);
    const size = binary.length;
    const bytes = new Uint8Array(size);

    for (let index = 0; index < size; index += 1) {
      bytes[index] = binary.charCodeAt(index);
    }

    return new Blob([bytes], { type: contentType || 'application/octet-stream' });
  }

  private async loadExistingRiskAssessment(patientId: string, carePlanId: string): Promise<void> {
    this.resetState();
    this.hasStarted = true;
    this.isProcessing = true;

    try {
      const carePlan = await firstValueFrom(this.apiService.get<any>(`/CarePlan/${carePlanId}`));
      const supportingInfo = Array.isArray(carePlan?.supportingInfo) ? carePlan.supportingInfo : [];
      const riskRef = supportingInfo
        .map((item: any) => String(item?.reference || '').trim())
        .find((ref: string) => ref.startsWith('RiskAssessment/'));

      if (!riskRef) {
        throw new Error('Aucun RiskAssessment associe a ce CarePlan.');
      }

      const riskId = this.extractIdFromReference(riskRef, 'RiskAssessment');
      if (!riskId) {
        throw new Error('Reference RiskAssessment invalide sur le CarePlan.');
      }

      const riskAssessment = await firstValueFrom(this.apiService.get<any>(`/RiskAssessment/${riskId}`));
      this.currentRiskAssessmentId = riskId;
      this.analysisResponse = this.mapRiskAssessmentToAnalysisResponse(riskAssessment);
      this.validationStatus = 'pending';
      this.syncEditableFromResponse(this.analysisResponse);
    } catch (error) {
      this.analysisError = this.resolveError(error, 'Erreur lors du chargement du RiskAssessment.');
      this.analysisResponse = null;
    } finally {
      this.isProcessing = false;
    }
  }

  private syncEditableFromResponse(response: PatientAnalysisResponse): void {
    this.editableClinicalSummary = String(response.clinicalSummary || '').trim();
    this.editableInterventionsSummary = String(response.interventionsSummary || '').trim();
    this.editableRecommendations = (response.followUpRecommendations || []).join('\n');
    this.editableAlerts = (response.alerts || [])
      .map((alert) => `${alert.severity} - ${alert.label}: ${alert.rationale}`)
      .join('\n');
  }

  private buildResponseFromEditable(base: PatientAnalysisResponse): PatientAnalysisResponse {
    const recommendations = this.editableRecommendations
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter((line) => line.length > 0);

    const alerts = this.editableAlerts
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter((line) => line.length > 0)
      .map((line) => {
        const [left, ...rest] = line.split(':');
        const rationale = rest.join(':').trim();
        const [severityRaw, ...labelParts] = left.split('-');
        const severity = String(severityRaw || 'info').trim().toLowerCase();
        const label = labelParts.join('-').trim() || 'Alerte';
        return {
          label,
          severity: (severity === 'critical' || severity === 'warning' ? severity : 'info') as 'info' | 'warning' | 'critical',
          rationale: rationale || ''
        };
      });

    return {
      ...base,
      clinicalSummary: String(this.editableClinicalSummary || '').trim(),
      interventionsSummary: String(this.editableInterventionsSummary || '').trim(),
      followUpRecommendations: recommendations,
      alerts
    };
  }

  private async resolveTargetCarePlanId(patientId: string): Promise<string> {
    const result = await firstValueFrom(this.carePlanService.getCarePlansForPatient(patientId));
    const plans = Array.isArray(result?.carePlans) ? [...result.carePlans] : [];
    if (!plans.length) {
      return '';
    }

    plans.sort((left, right) => {
      const leftActive = left.status === 'active' ? 1 : 0;
      const rightActive = right.status === 'active' ? 1 : 0;
      if (leftActive !== rightActive) {
        return rightActive - leftActive;
      }
      const leftDate = Date.parse(String(left.lastUpdated || '')) || 0;
      const rightDate = Date.parse(String(right.lastUpdated || '')) || 0;
      return rightDate - leftDate;
    });

    return String(plans[0]?.id || '').trim();
  }

  private async upsertRiskAssessmentForCarePlan(
    carePlanId: string,
    patientId: string,
    response: PatientAnalysisResponse
  ): Promise<string> {
    const carePlan = await firstValueFrom(this.apiService.get<any>(`/CarePlan/${carePlanId}`));
    const supportingInfo = Array.isArray(carePlan?.supportingInfo) ? [...carePlan.supportingInfo] : [];
    const currentRefIndex = supportingInfo.findIndex((item: any) =>
      String(item?.reference || '').trim().startsWith('RiskAssessment/')
    );

    const fromSupportingRef = currentRefIndex >= 0
      ? String(supportingInfo[currentRefIndex]?.reference || '').trim()
      : '';
    const fromSupportingId = this.extractIdFromReference(fromSupportingRef, 'RiskAssessment');
    const targetRiskId = this.currentRiskAssessmentId || fromSupportingId;

    const payload = this.buildRiskAssessmentResource(targetRiskId, patientId, response);

    let savedRiskId = '';
    if (targetRiskId) {
      await firstValueFrom(this.apiService.put<any>(`/RiskAssessment/${targetRiskId}`, payload));
      savedRiskId = targetRiskId;
    } else {
      const created = await firstValueFrom(this.apiService.post<any>('/RiskAssessment', payload));
      savedRiskId = String(created?.id || '').trim();
      if (!savedRiskId) {
        throw new Error('Creation RiskAssessment sans identifiant.');
      }
    }

    const desiredRef = `RiskAssessment/${savedRiskId}`;
    if (currentRefIndex >= 0) {
      supportingInfo[currentRefIndex] = { reference: desiredRef };
    } else {
      supportingInfo.push({ reference: desiredRef });
    }

    const updatedCarePlan = {
      ...carePlan,
      supportingInfo
    };

    await firstValueFrom(this.apiService.put<any>(`/CarePlan/${carePlanId}`, updatedCarePlan));
    return savedRiskId;
  }

  private buildRiskAssessmentResource(
    riskAssessmentId: string,
    patientId: string,
    response: PatientAnalysisResponse
  ): any {
    const probabilityDecimal = Math.max(0, Math.min(1, Number(response.riskScore || 0) / 100));

    return {
      resourceType: 'RiskAssessment',
      ...(riskAssessmentId ? { id: riskAssessmentId } : {}),
      status: 'final',
      occurrenceDateTime: new Date().toISOString(),
      subject: {
        reference: `Patient/${patientId}`
      },
      method: {
        text: 'Analyse parcours patient'
      },
      prediction: [
        {
          probabilityDecimal,
          qualitativeRisk: {
            text: response.riskLevel
          },
          rationale: String(response.interventionsSummary || '').trim()
        }
      ],
      note: [
        { text: String(response.clinicalSummary || '').trim() },
        { text: String(response.interventionsSummary || '').trim() },
        { text: (response.followUpRecommendations || []).join('\n') },
        {
          text: (response.alerts || [])
            .map((item) => `${item.severity} - ${item.label}: ${item.rationale}`)
            .join('\n')
        }
      ],
      extension: [
        {
          url: this.riskAssessmentConfidenceExtensionUrl,
          valueDecimal: Number(response.metadata?.confidence ?? 0)
        }
      ]
    };
  }

  private mapRiskAssessmentToAnalysisResponse(resource: any): PatientAnalysisResponse {
    const prediction = resource?.prediction?.[0] || {};
    const notes = Array.isArray(resource?.note) ? resource.note : [];
    const clinicalSummary = String(notes[0]?.text || '').trim();
    const interventionsSummary = String(notes[1]?.text || '').trim();
    const recommendationsRaw = String(notes[2]?.text || '').trim();
    const alertsRaw = String(notes[3]?.text || '').trim();
    const legacy = this.parseLegacyNoteSections(String(notes[0]?.text || '').trim());

    const followUpRecommendations = recommendationsRaw
      ? recommendationsRaw.split(/\r?\n/).map((line) => line.trim()).filter((line) => !!line)
      : legacy.recommendations;

    const alerts = (alertsRaw
      ? alertsRaw.split(/\r?\n/).map((line) => line.trim()).filter((line) => !!line)
      : legacy.alerts
    ).map((line) => {
      const [left, ...rest] = line.split(':');
      const rationale = rest.join(':').trim();
      const [severityRaw, ...labelParts] = left.split('-');
      const severity = String(severityRaw || 'info').trim().toLowerCase();
      return {
        label: labelParts.join('-').trim() || 'Alerte',
        severity: (severity === 'critical' || severity === 'warning' ? severity : 'info') as 'info' | 'warning' | 'critical',
        rationale
      };
    });

    const confidence = this.extractConfidenceFromExtensions(resource?.extension);
    const levelRaw = String(
      prediction?.qualitativeRisk?.text
      || prediction?.qualitativeRisk?.coding?.[0]?.code
      || 'moderate'
    ).toLowerCase();
    const level = (levelRaw === 'low' || levelRaw === 'high' || levelRaw === 'critical')
      ? levelRaw
      : 'moderate';
    const riskScore = Math.round((Number(prediction?.probabilityDecimal || 0) || 0) * 100);

    return {
      title: 'Analyse patient',
      riskLevel: level as 'low' | 'moderate' | 'high' | 'critical',
      riskScore,
      clinicalSummary: clinicalSummary || legacy.clinicalSummary || 'Aucune synthese disponible.',
      interventionsSummary: interventionsSummary || String(prediction?.rationale || '').trim() || legacy.interventionsSummary,
      followUpRecommendations,
      alerts,
      nextActions: [],
      metadata: {
        confidence,
        generatedAt: String(resource?.occurrenceDateTime || resource?.meta?.lastUpdated || ''),
        model: 'RiskAssessment'
      },
      rawJson: JSON.stringify(resource || {})
    };
  }

  private parseLegacyNoteSections(noteText: string): {
    clinicalSummary: string;
    interventionsSummary: string;
    recommendations: string[];
    alerts: string[];
  } {
    const raw = String(noteText || '').trim();
    if (!raw) {
      return { clinicalSummary: '', interventionsSummary: '', recommendations: [], alerts: [] };
    }

    const blocks = raw.split(/\n\n+/);
    const sectionMap = new Map<string, string>();
    blocks.forEach((block) => {
      const idx = block.indexOf(':\n');
      if (idx > 0) {
        const key = block.slice(0, idx).trim().toLowerCase();
        const value = block.slice(idx + 2).trim();
        sectionMap.set(key, value);
      }
    });

    const recommendations = String(sectionMap.get('recommandations') || '')
      .split(/\r?\n/)
      .map((line) => line.replace(/^-\s*/, '').trim())
      .filter((line) => !!line);
    const alerts = String(sectionMap.get('alertes') || '')
      .split(/\r?\n/)
      .map((line) => line.replace(/^-\s*/, '').trim())
      .filter((line) => !!line);

    return {
      clinicalSummary: String(sectionMap.get('resume patient') || '').trim(),
      interventionsSummary: String(sectionMap.get('resume interventions') || '').trim(),
      recommendations,
      alerts
    };
  }

  private extractConfidenceFromExtensions(extensions: any[]): number {
    const list = Array.isArray(extensions) ? extensions : [];
    const entry = list.find((item: any) => String(item?.url || '').trim() === this.riskAssessmentConfidenceExtensionUrl);
    const value = Number(entry?.valueDecimal);
    return Number.isFinite(value) ? value : 0;
  }

  private extractIdFromReference(reference: string, resourceType: string): string {
    const normalized = String(reference || '').trim();
    if (!normalized) {
      return '';
    }

    const marker = `${resourceType}/`;
    const index = normalized.lastIndexOf(marker);
    if (index < 0) {
      return '';
    }

    return normalized.slice(index + marker.length).trim();
  }

  private resolveError(error: unknown, fallback: string): string {
    if (typeof error === 'string') {
      return error;
    }
    if (error instanceof Error) {
      return error.message || fallback;
    }
    if (error && typeof error === 'object' && 'message' in error) {
      return String((error as { message: unknown }).message || fallback);
    }
    return fallback;
  }

  private newSessionId(): string {
    if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
      return crypto.randomUUID();
    }
    return `${Date.now()}-${Math.random().toString(16).slice(2)}`;
  }
}
