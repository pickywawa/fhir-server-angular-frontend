import { Component, Input, OnChanges, SimpleChanges } from '@angular/core';
import { CommonModule } from '@angular/common';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { Router } from '@angular/router';
import { BubbleCardComponent } from '../../../../../shared/components/bubble-card/bubble-card.component';
import { FhirQuestionnaireService } from '../../../../questionnaires/services/fhir-questionnaire.service';
import {
  QuestionnaireResponseSummary
} from '../models/patient-questionnaire.model';
import { FhirPatientQuestionnaireService } from '../services/fhir-patient-questionnaire.service';

@Component({
  selector: 'app-patient-questionnaires',
  standalone: true,
  imports: [CommonModule, TranslateModule, BubbleCardComponent],
  templateUrl: './patient-questionnaires.component.html',
  styleUrl: './patient-questionnaires.component.scss'
})
export class PatientQuestionnairesComponent implements OnChanges {
  @Input() patientId?: string;

  loading = false;
  error = '';

  responses: QuestionnaireResponseSummary[] = [];
  questionnaireTitles: Record<string, string> = {};

  constructor(
    private readonly patientQuestionnaireService: FhirPatientQuestionnaireService,
    private readonly questionnaireService: FhirQuestionnaireService,
    private readonly translateService: TranslateService,
    private readonly router: Router
  ) {}

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['patientId']) {
      this.loadResponses();
    }
  }

  openResponse(response: QuestionnaireResponseSummary): void {
    if (!response.id || !response.questionnaireId) {
      return;
    }

    if (!this.patientId) {
      return;
    }

    this.router.navigate(['/my-patients', this.patientId, 'questionnaires', 'response', response.id]);
  }

  openModelPicker(): void {
    if (!this.patientId) {
      return;
    }

    this.router.navigate(['/my-patients', this.patientId, 'questionnaires', 'new']);
  }

  private loadResponses(): void {
    if (!this.patientId) {
      this.responses = [];
      return;
    }

    this.loading = true;
    this.error = '';

    this.patientQuestionnaireService.searchResponsesByPatient(this.patientId).subscribe({
      next: (responses) => {
        this.responses = this.mergeResponseLists(this.responses, responses);
        this.loading = false;

        const questionnaireIds = Array.from(new Set(
          responses.map((response) => response.questionnaireId).filter((id) => id.length > 0)
        ));

        questionnaireIds.forEach((questionnaireId) => {
          if (this.questionnaireTitles[questionnaireId]) {
            return;
          }

          this.questionnaireService.getQuestionnaire(questionnaireId).subscribe({
            next: (questionnaire) => {
              this.questionnaireTitles[questionnaireId] = questionnaire.title || questionnaireId;
            }
          });
        });
      },
      error: (error: unknown) => {
        this.error = this.formatError(error);
        this.loading = false;
      }
    });
  }

  private mergeResponseLists(
    localItems: QuestionnaireResponseSummary[],
    serverItems: QuestionnaireResponseSummary[]
  ): QuestionnaireResponseSummary[] {
    const byId = new Map<string, QuestionnaireResponseSummary>();

    localItems.forEach((item) => {
      if (item.id) {
        byId.set(item.id, item);
      }
    });

    serverItems.forEach((item) => {
      if (item.id) {
        byId.set(item.id, item);
      }
    });

    return Array.from(byId.values()).sort((a, b) => {
      const aTime = a.authored ? new Date(a.authored).getTime() : 0;
      const bTime = b.authored ? new Date(b.authored).getTime() : 0;
      return bTime - aTime;
    });
  }

  getResponseLabel(response: QuestionnaireResponseSummary): string {
    return this.questionnaireTitles[response.questionnaireId]
      || response.questionnaireReference
      || response.id;
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
