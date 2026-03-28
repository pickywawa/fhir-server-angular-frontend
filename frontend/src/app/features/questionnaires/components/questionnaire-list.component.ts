import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, ReactiveFormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { ModuleShellComponent } from '../../../shared/components/module-shell/module-shell.component';
import { BubbleCardComponent } from '../../../shared/components/bubble-card/bubble-card.component';
import { ResultListItemComponent } from '../../../shared/components/result-list-item/result-list-item.component';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { FhirQuestionnaireService } from '../services/fhir-questionnaire.service';
import { QuestionnaireSearchCriteria, QuestionnaireSummary } from '../models/questionnaire.model';

@Component({
  selector: 'app-questionnaire-list',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, ModuleShellComponent, BubbleCardComponent, ResultListItemComponent, TranslateModule],
  templateUrl: './questionnaire-list.component.html',
  styleUrl: './questionnaire-list.component.scss'
})
export class QuestionnaireListComponent implements OnInit {
  readonly breadcrumbs = [{ label: 'menu.questionnaires' }];

  readonly searchForm;

  loading = false;
  error = '';
  hasSearched = false;
  commonQuestionnaires: QuestionnaireSummary[] = [];
  results: QuestionnaireSummary[] = [];

  constructor(
    private readonly fb: FormBuilder,
    private readonly questionnaireService: FhirQuestionnaireService,
    private readonly router: Router,
    private readonly translateService: TranslateService
  ) {
    this.searchForm = this.fb.group({
      title: [''],
      status: ['']
    });
  }

  ngOnInit(): void {
    this.loadCommonQuestionnaires();
  }

  search(): void {
    const value = this.searchForm.getRawValue();
    const criteria: QuestionnaireSearchCriteria = {
      title: value.title || '',
      limit: 50
    };

    if (typeof value.status === 'string' && value.status.trim().length > 0) {
      criteria.status = value.status as QuestionnaireSearchCriteria['status'];
    }

    this.loading = true;
    this.error = '';
    this.hasSearched = true;

    this.questionnaireService.searchQuestionnaires(criteria).subscribe({
      next: (result) => {
        this.results = result;
        this.loading = false;
      },
      error: (error: unknown) => {
        this.error = this.formatError(error);
        this.loading = false;
      }
    });
  }

  resetSearch(): void {
    this.searchForm.reset({ title: '', status: '' });
    this.hasSearched = false;
    this.results = [];
    this.error = '';
  }

  addQuestionnaire(): void {
    this.router.navigate(['/questionnaires/new']);
  }

  openQuestionnaire(item: QuestionnaireSummary): void {
    this.router.navigate(['/questionnaires', item.id]);
  }

  private loadCommonQuestionnaires(): void {
    this.loading = true;
    this.error = '';

    this.questionnaireService.searchQuestionnaires({ limit: 50 }).subscribe({
      next: (result) => {
        this.commonQuestionnaires = result;
        this.loading = false;
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
