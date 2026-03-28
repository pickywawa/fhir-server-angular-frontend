import { CommonModule } from '@angular/common';
import { Component, OnInit } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { ModuleShellComponent, ModuleBreadcrumb } from '../../../../../shared/components/module-shell/module-shell.component';
import { BubbleCardComponent } from '../../../../../shared/components/bubble-card/bubble-card.component';
import { QuestionnaireRendererComponent } from '../../../../questionnaires/components/questionnaire-renderer.component';
import { QuestionnaireProfile, QuestionnaireSummary } from '../../../../questionnaires/models/questionnaire.model';
import { FhirQuestionnaireService } from '../../../../questionnaires/services/fhir-questionnaire.service';
import {
  QuestionnaireAnswerMap,
  QuestionnaireResponsePayload
} from '../models/patient-questionnaire.model';
import { FhirPatientQuestionnaireService } from '../services/fhir-patient-questionnaire.service';
import { ToastService } from '../../../../../core/services/toast.service';

@Component({
  selector: 'app-patient-questionnaire-page',
  standalone: true,
  imports: [
    CommonModule,
    TranslateModule,
    ModuleShellComponent,
    BubbleCardComponent,
    QuestionnaireRendererComponent
  ],
  templateUrl: './patient-questionnaire-page.component.html',
  styleUrl: './patient-questionnaire-page.component.scss'
})
export class PatientQuestionnairePageComponent implements OnInit {
  patientId = '';
  responseId = '';
  createMode = true;

  loading = false;
  saving = false;
  error = '';

  modelLoading = false;
  modelError = '';
  modelList: QuestionnaireSummary[] = [];

  selectedQuestionnaire: QuestionnaireProfile | null = null;
  answerSeed: QuestionnaireAnswerMap = {};

  breadcrumbs: ModuleBreadcrumb[] = [
    { label: 'menu.myPatients', route: '/my-patients' },
    { label: 'myPatients.detail.tabs.questionnaires' }
  ];

  constructor(
    private readonly route: ActivatedRoute,
    private readonly router: Router,
    private readonly questionnaireService: FhirQuestionnaireService,
    private readonly patientQuestionnaireService: FhirPatientQuestionnaireService,
    private readonly toastService: ToastService,
    private readonly translateService: TranslateService
  ) {}

  ngOnInit(): void {
    this.route.paramMap.subscribe((params) => {
      this.patientId = String(params.get('id') || '');
      this.responseId = String(params.get('responseId') || '');
      this.createMode = !this.responseId;
      this.selectedQuestionnaire = null;
      this.answerSeed = {};
      this.error = '';

      this.breadcrumbs = [
        { label: 'menu.myPatients', route: '/my-patients' },
        { label: 'myPatients.detail.tabs.questionnaires', route: `/my-patients/${this.patientId}` },
        {
          label: this.createMode
            ? 'myPatients.questionnaires.add'
            : 'myPatients.questionnaires.title'
        }
      ];

      if (!this.patientId) {
        this.error = this.translateService.instant('myPatients.questionnaires.errors.patientNotFound');
        return;
      }

      if (this.createMode) {
        this.loadModels();
      } else {
        this.loadExistingResponse();
      }
    });
  }

  goBack(): void {
    this.router.navigate(['/my-patients', this.patientId], {
      queryParams: { tab: 'questionnaires' }
    });
  }

  chooseModel(model: QuestionnaireSummary): void {
    this.loading = true;
    this.error = '';

    this.questionnaireService.getQuestionnaire(model.id).subscribe({
      next: (questionnaire) => {
        this.selectedQuestionnaire = questionnaire;
        this.answerSeed = {};
        this.loading = false;
      },
      error: (error: unknown) => {
        this.error = this.formatError(error);
        this.loading = false;
      }
    });
  }

  save(renderer: QuestionnaireRendererComponent): void {
    if (!this.patientId || !this.selectedQuestionnaire) {
      return;
    }

    const questionnaireId = String(this.selectedQuestionnaire.id || '');
    if (!questionnaireId) {
      this.error = this.translateService.instant('myPatients.questionnaires.errors.missingQuestionnaireId');
      return;
    }

    const payload: QuestionnaireResponsePayload = {
      patientId: this.patientId,
      questionnaireId,
      status: 'completed',
      answers: renderer.getAnswerSnapshot(),
      questionnaireItems: this.selectedQuestionnaire.items
    };

    this.saving = true;
    this.error = '';

    const operation$ = this.responseId
      ? this.patientQuestionnaireService.updateResponse(this.responseId, payload)
      : this.patientQuestionnaireService.createResponse(payload);

    operation$.subscribe({
      next: (savedResponse) => {
        this.saving = false;
        this.responseId = savedResponse.id;
        this.createMode = false;
        this.toastService.success(this.translateService.instant('myPatients.questionnaires.saved'));
        this.router.navigate(['/my-patients', this.patientId, 'questionnaires', 'response', savedResponse.id]);
      },
      error: (error: unknown) => {
        this.saving = false;
        this.error = this.formatError(error);
      }
    });
  }

  get pageTitle(): string {
    if (this.selectedQuestionnaire?.title?.trim()) {
      return this.selectedQuestionnaire.title;
    }
    return this.translateService.instant('myPatients.questionnaires.title');
  }

  private loadModels(): void {
    this.modelLoading = true;
    this.modelError = '';
    this.modelList = [];

    this.questionnaireService.searchQuestionnaires({ limit: 100 }).subscribe({
      next: (models) => {
        this.modelList = models;
        this.modelLoading = false;
      },
      error: (error: unknown) => {
        this.modelError = this.formatError(error);
        this.modelLoading = false;
      }
    });
  }

  private loadExistingResponse(): void {
    if (!this.responseId) {
      return;
    }

    this.loading = true;
    this.error = '';

    this.patientQuestionnaireService.getResponse(this.responseId).subscribe({
      next: (response) => {
        this.questionnaireService.getQuestionnaire(response.questionnaireId).subscribe({
          next: (questionnaire) => {
            this.selectedQuestionnaire = questionnaire;
            this.answerSeed = this.patientQuestionnaireService.extractAnswerMap(response);
            this.loading = false;
          },
          error: (error: unknown) => {
            this.error = this.formatError(error);
            this.loading = false;
          }
        });
      },
      error: (error: unknown) => {
        this.error = this.formatError(error);
        this.loading = false;
      }
    });
  }

  private formatError(error: unknown): string {
    if (error instanceof Error) {
      return error.message;
    }
    if (typeof error === 'string') {
      return error;
    }
    if (error && typeof error === 'object' && 'message' in error) {
      return String((error as { message: unknown }).message);
    }
    return this.translateService.instant('common.unknownError');
  }
}
