import { CommonModule } from '@angular/common';
import { Component, OnInit } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { BubbleCardComponent } from '../../../shared/components/bubble-card/bubble-card.component';
import { FormControlFieldComponent } from '../../../shared/components/form-control-field/form-control-field.component';
import { ModuleShellComponent } from '../../../shared/components/module-shell/module-shell.component';
import {
  CARE_GOAL_ACHIEVEMENT_OPTIONS,
  CARE_GOAL_LIFECYCLE_OPTIONS,
  CARE_PRIORITY_OPTIONS,
  CareGoalDetail
} from '../models/care-plan-admin.model';
import { FhirCarePlansAdminService } from '../services/fhir-care-plans-admin.service';

@Component({
  selector: 'app-care-plan-goal-detail-page',
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    TranslateModule,
    ModuleShellComponent,
    BubbleCardComponent,
    FormControlFieldComponent
  ],
  templateUrl: './care-plan-goal-detail-page.component.html',
  styleUrl: './care-plan-goal-detail-page.component.scss'
})
export class CarePlanGoalDetailPageComponent implements OnInit {
  readonly form;
  readonly lifecycleOptions = CARE_GOAL_LIFECYCLE_OPTIONS.map((value) => ({ value, label: value }));
  readonly achievementOptions = CARE_GOAL_ACHIEVEMENT_OPTIONS.map((value) => ({ value, label: value }));
  readonly priorityOptions = CARE_PRIORITY_OPTIONS.map((value) => ({ value, label: value }));

  loading = true;
  saving = false;
  error = '';
  isCreate = false;
  editMode = false;
  goalId = '';

  breadcrumbs = [
    { label: 'menu.carePlans', link: '/care-plans' },
    { label: 'carePlans.tabs.objectives' }
  ];

  constructor(
    private readonly fb: FormBuilder,
    private readonly route: ActivatedRoute,
    private readonly router: Router,
    private readonly service: FhirCarePlansAdminService,
    private readonly translateService: TranslateService
  ) {
    this.form = this.fb.group({
      title: ['', [Validators.required, Validators.maxLength(180)]],
      description: [''],
      lifecycleStatus: ['proposed', Validators.required],
      achievementStatus: [''],
      priority: ['routine'],
      dueDate: ['']
    });
  }

  ngOnInit(): void {
    this.goalId = String(this.route.snapshot.paramMap.get('id') || '').trim();
    this.isCreate = this.goalId === 'new';

    if (this.isCreate) {
      this.editMode = true;
      this.loading = false;
      this.breadcrumbs = [
        { label: 'menu.carePlans', link: '/care-plans' },
        { label: 'carePlans.tabs.objectives', link: '/care-plans?tab=objectives' },
        { label: 'carePlans.detail.newObjective' }
      ];
      return;
    }

    if (!this.goalId) {
      this.router.navigate(['/care-plans'], { queryParams: { tab: 'objectives' } });
      return;
    }

    this.service.getGoal(this.goalId).subscribe({
      next: (goal) => {
        this.patchForm(goal);
        this.loading = false;
      },
      error: (error: unknown) => {
        this.error = this.formatError(error);
        this.loading = false;
      }
    });
  }

  enableEdit(): void {
    this.editMode = true;
  }

  cancelEdit(): void {
    if (this.isCreate) {
      this.router.navigate(['/care-plans'], { queryParams: { tab: 'objectives' } });
      return;
    }
    this.editMode = false;
  }

  submit(): void {
    if (!(this.editMode || this.isCreate)) {
      return;
    }

    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    const raw = this.form.getRawValue();
    this.saving = true;
    this.error = '';

    const payload = {
      title: String(raw.title || '').trim(),
      description: String(raw.description || '').trim(),
      lifecycleStatus: String(raw.lifecycleStatus || '').trim(),
      achievementStatus: String(raw.achievementStatus || '').trim(),
      priority: String(raw.priority || '').trim(),
      dueDate: String(raw.dueDate || '').trim()
    };

    const request$ = this.isCreate
      ? this.service.createGoal(payload)
      : this.service.updateGoal(this.goalId, payload);

    request$.subscribe({
      next: (saved) => {
        this.saving = false;
        this.patchForm(saved);
        this.editMode = false;

        if (this.isCreate) {
          this.router.navigate(['/care-plans/goals', saved.id]);
        }
      },
      error: (error: unknown) => {
        this.saving = false;
        this.error = this.formatError(error);
      }
    });
  }

  private patchForm(goal: CareGoalDetail): void {
    this.form.patchValue({
      title: goal.title,
      description: goal.description,
      lifecycleStatus: goal.lifecycleStatus || 'proposed',
      achievementStatus: goal.achievementStatus,
      priority: goal.priority || 'routine',
      dueDate: goal.dueDate
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
