import { Component, ElementRef, OnDestroy, OnInit, ViewChild } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router } from '@angular/router';
import { Subject, takeUntil } from 'rxjs';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { ModuleBreadcrumb, ModuleShellComponent } from '../../../shared/components/module-shell/module-shell.component';
import { BubbleCardComponent } from '../../../shared/components/bubble-card/bubble-card.component';
import { ToastService } from '../../../core/services/toast.service';
import { QuestionnaireProfile } from '../models/questionnaire.model';
import { FhirQuestionnaireService } from '../services/fhir-questionnaire.service';
import { QuestionnaireFormComponent } from './questionnaire-form.component';
import { QuestionnaireRendererComponent } from './questionnaire-renderer.component';

@Component({
  selector: 'app-questionnaire-detail-page',
  standalone: true,
  imports: [CommonModule, ModuleShellComponent, BubbleCardComponent, QuestionnaireFormComponent, QuestionnaireRendererComponent, TranslateModule],
  templateUrl: './questionnaire-detail-page.component.html',
  styleUrl: './questionnaire-detail-page.component.scss'
})
export class QuestionnaireDetailPageComponent implements OnInit, OnDestroy {
  @ViewChild('editorLayout') editorLayout?: ElementRef<HTMLDivElement>;

  breadcrumbs: ModuleBreadcrumb[] = [
    { label: 'menu.questionnaires', route: '/questionnaires' },
    { label: 'questionnaires.detail.titleSingle' }
  ];

  loading = false;
  error = '';
  createMode = false;
  questionnaire: QuestionnaireProfile | null = null;
  previewQuestionnaire: QuestionnaireProfile | null = null;
  rightPanelWidthPercent = 42;
  resizing = false;

  private questionnaireId = '';
  private readonly destroy$ = new Subject<void>();

  constructor(
    private readonly route: ActivatedRoute,
    private readonly router: Router,
    private readonly questionnaireService: FhirQuestionnaireService,
    private readonly toastService: ToastService,
    private readonly translateService: TranslateService
  ) {}

  ngOnInit(): void {
    this.route.paramMap
      .pipe(takeUntil(this.destroy$))
      .subscribe((params) => {
        const id = params.get('id');
        if (!id) {
          return;
        }

        this.questionnaireId = id;
        this.createMode = id === 'new';

        if (this.createMode) {
          this.questionnaire = {
            title: '',
            description: '',
            status: 'draft',
            items: []
          };
          this.previewQuestionnaire = this.questionnaire;
          this.breadcrumbs = [
            { label: 'menu.questionnaires', route: '/questionnaires' },
            { label: 'questionnaires.detail.new' }
          ];
          return;
        }

        this.loadQuestionnaire(id);
      });
  }

  ngOnDestroy(): void {
    this.stopResize();
    this.destroy$.next();
    this.destroy$.complete();
  }

  onSave(questionnaire: QuestionnaireProfile): void {
    this.loading = true;
    this.error = '';

    const operation$ = this.createMode
      ? this.questionnaireService.createQuestionnaire(questionnaire)
      : this.questionnaireService.updateQuestionnaire(this.questionnaireId, questionnaire);

    operation$.subscribe({
      next: (saved) => {
        this.loading = false;
        this.questionnaire = saved;
        this.previewQuestionnaire = saved;

        this.toastService.success(
          this.translateService.instant(
            this.createMode ? 'questionnaires.detail.createdSuccess' : 'questionnaires.detail.updatedSuccess'
          )
        );

        if (this.createMode && saved.id) {
          this.router.navigate(['/questionnaires', saved.id]);
          return;
        }

        this.breadcrumbs = [
          { label: 'menu.questionnaires', route: '/questionnaires' },
          { label: saved.title || 'questionnaires.detail.titleSingle' }
        ];
      },
      error: (error: unknown) => {
        this.loading = false;
        this.error = this.formatError(error);
      }
    });
  }

  private loadQuestionnaire(id: string): void {
    this.loading = true;
    this.error = '';

    this.questionnaireService.getQuestionnaire(id).subscribe({
      next: (questionnaire) => {
        this.questionnaire = questionnaire;
        this.previewQuestionnaire = questionnaire;
        this.loading = false;
        this.breadcrumbs = [
          { label: 'menu.questionnaires', route: '/questionnaires' },
          { label: questionnaire.title || 'questionnaires.detail.titleSingle' }
        ];
      },
      error: (error: unknown) => {
        this.loading = false;
        this.error = this.formatError(error);
      }
    });
  }

  onQuestionnaireChange(questionnaire: QuestionnaireProfile): void {
    this.previewQuestionnaire = questionnaire;
  }

  get editorLayoutColumns(): string | null {
    if (typeof window !== 'undefined' && window.innerWidth <= 1100) {
      return null;
    }

    const right = `${this.rightPanelWidthPercent}%`;
    const left = `${100 - this.rightPanelWidthPercent}%`;
    return `minmax(0, ${left}) 10px minmax(320px, ${right})`;
  }

  startResize(event: PointerEvent): void {
    if (typeof window !== 'undefined' && window.innerWidth <= 1100) {
      return;
    }

    this.resizing = true;
    window.addEventListener('pointermove', this.onPointerMove);
    window.addEventListener('pointerup', this.stopResize);
    event.preventDefault();
  }

  private readonly onPointerMove = (event: PointerEvent): void => {
    if (!this.resizing || !this.editorLayout) {
      return;
    }

    const bounds = this.editorLayout.nativeElement.getBoundingClientRect();
    if (!bounds.width) {
      return;
    }

    const pointerOffset = event.clientX - bounds.left;
    const nextRightPercent = ((bounds.width - pointerOffset) / bounds.width) * 100;
    this.rightPanelWidthPercent = Math.min(62, Math.max(28, nextRightPercent));
  };

  private readonly stopResize = (): void => {
    this.resizing = false;
    window.removeEventListener('pointermove', this.onPointerMove);
    window.removeEventListener('pointerup', this.stopResize);
  };

  resetPanelSize(): void {
    this.rightPanelWidthPercent = 42;
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
