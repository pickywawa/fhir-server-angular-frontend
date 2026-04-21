import { CommonModule } from '@angular/common';
import { Component, OnInit } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { BubbleCardComponent } from '../../../shared/components/bubble-card/bubble-card.component';
import { FormControlFieldComponent } from '../../../shared/components/form-control-field/form-control-field.component';
import { ModuleShellComponent } from '../../../shared/components/module-shell/module-shell.component';
import {
  CARE_PLAN_STEP_TYPE_OPTIONS,
  CARE_PRIORITY_OPTIONS,
  CARE_PLAN_STATUS_OPTIONS,
  CarePlanDetail,
  CarePlanStep,
  CarePlanStepType,
  LinkedReferenceOption
} from '../models/care-plan-admin.model';
import { FhirCarePlansAdminService } from '../services/fhir-care-plans-admin.service';

@Component({
  selector: 'app-care-plan-detail-page',
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    TranslateModule,
    ModuleShellComponent,
    BubbleCardComponent,
    FormControlFieldComponent
  ],
  templateUrl: './care-plan-detail-page.component.html',
  styleUrl: './care-plan-detail-page.component.scss'
})
export class CarePlanDetailPageComponent implements OnInit {
  readonly form;
  readonly statusOptions = CARE_PLAN_STATUS_OPTIONS.map((value) => ({ value, label: value }));
  readonly stepTypeOptions = CARE_PLAN_STEP_TYPE_OPTIONS;
  readonly priorityOptions = CARE_PRIORITY_OPTIONS.map((value) => ({ value, label: value }));

  loading = true;
  saving = false;
  error = '';
  isCreate = false;
  editMode = false;
  planId = '';

  goalQuery = '';
  goalResults: LinkedReferenceOption[] = [];
  allGoalOptions: LinkedReferenceOption[] = [];
  taskOptions: LinkedReferenceOption[] = [];
  questionnaireOptions: LinkedReferenceOption[] = [];
  activityDefinitionOptions: LinkedReferenceOption[] = [];
  selectedGoals: LinkedReferenceOption[] = [];
  steps: CarePlanStep[] = [];

  breadcrumbs = [
    { label: 'menu.carePlans', link: '/care-plans' },
    { label: 'carePlans.tabs.plans' }
  ];

  constructor(
    private readonly fb: FormBuilder,
    private readonly route: ActivatedRoute,
    private readonly router: Router,
    private readonly service: FhirCarePlansAdminService,
    private readonly translateService: TranslateService
  ) {
    this.form = this.fb.group({
      title: ['', [Validators.required, Validators.maxLength(160)]],
      description: [''],
      status: ['draft', Validators.required],
      version: ['']
    });
  }

  ngOnInit(): void {
    this.planId = String(this.route.snapshot.paramMap.get('id') || '').trim();
    this.isCreate = this.planId === 'new';

    if (this.isCreate) {
      this.editMode = true;
      this.loading = false;
      this.loadReferenceOptions();
      this.breadcrumbs = [
        { label: 'menu.carePlans', link: '/care-plans' },
        { label: 'carePlans.tabs.plans', link: '/care-plans?tab=plans' },
        { label: 'carePlans.detail.newPlan' }
      ];
      return;
    }

    if (!this.planId) {
      this.router.navigate(['/care-plans'], { queryParams: { tab: 'plans' } });
      return;
    }

    this.loadReferenceOptions();
    this.service.getPlan(this.planId).subscribe({
      next: (plan) => {
        this.patchForm(plan);
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
      this.router.navigate(['/care-plans'], { queryParams: { tab: 'plans' } });
      return;
    }
    this.editMode = false;
  }

  searchGoals(value: string): void {
    this.goalQuery = value;
    const query = value.trim().toLowerCase();
    if (!query) {
      this.goalResults = [];
      return;
    }
    const selected = new Set(this.selectedGoals.map((item) => item.reference));
    this.goalResults = this.allGoalOptions
      .filter((item) => !selected.has(item.reference))
      .filter((item) => item.label.toLowerCase().includes(query));
  }

  addGoal(option: LinkedReferenceOption): void {
    this.selectedGoals = [...this.selectedGoals, option];
    this.goalQuery = '';
    this.goalResults = [];
  }

  removeGoal(index: number): void {
    this.selectedGoals = this.selectedGoals.filter((_, idx) => idx !== index);
  }

  moveGoal(index: number, direction: -1 | 1): void {
    const nextIndex = index + direction;
    if (nextIndex < 0 || nextIndex >= this.selectedGoals.length) {
      return;
    }
    const copy = [...this.selectedGoals];
    const [item] = copy.splice(index, 1);
    copy.splice(nextIndex, 0, item);
    this.selectedGoals = copy;
  }

  addStep(type: CarePlanStepType = 'questionnaire'): void {
    this.steps = [...this.steps, this.createEmptyStep(type)];
  }

  removeStep(index: number): void {
    this.steps = this.steps.filter((_, idx) => idx !== index);
  }

  moveStep(index: number, direction: -1 | 1): void {
    const nextIndex = index + direction;
    if (nextIndex < 0 || nextIndex >= this.steps.length) {
      return;
    }
    const copy = [...this.steps];
    const [item] = copy.splice(index, 1);
    copy.splice(nextIndex, 0, item);
    this.steps = copy;
  }

  updateStepField(index: number, field: keyof CarePlanStep, value: string): void {
    const copy = [...this.steps];
    const current = copy[index];
    if (!current) {
      return;
    }
    copy[index] = { ...current, [field]: value };
    this.steps = copy;
  }

  onStepTypeChange(index: number, value: string): void {
    const type = value as CarePlanStepType;
    const copy = [...this.steps];
    const current = copy[index];
    if (!current) {
      return;
    }

    copy[index] = {
      ...current,
      type,
      questionnaireRef: '',
      activityDefinitionRef: '',
      communicationMessage: '',
      taskRef: ''
    };
    this.steps = copy;
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
      status: String(raw.status || 'draft').trim(),
      version: String(raw.version || '').trim(),
      goalRefs: this.selectedGoals.map((item) => item.reference),
      actionRefs: this.steps
        .filter((step) => step.type === 'task')
        .map((step) => step.taskRef)
        .filter((ref) => String(ref || '').trim().length > 0),
      steps: this.steps.map((step) => ({
        ...step,
        title: String(step.title || '').trim(),
        description: String(step.description || '').trim(),
        priority: String(step.priority || 'routine').trim(),
        questionnaireRef: String(step.questionnaireRef || '').trim(),
        activityDefinitionRef: String(step.activityDefinitionRef || '').trim(),
        communicationMessage: String(step.communicationMessage || '').trim(),
        taskRef: String(step.taskRef || '').trim()
      }))
    };

    const request$ = this.isCreate
      ? this.service.createPlan(payload)
      : this.service.updatePlan(this.planId, payload);

    request$.subscribe({
      next: (saved) => {
        this.saving = false;
        this.patchForm(saved);
        this.editMode = false;

        if (this.isCreate) {
          this.router.navigate(['/care-plans/plans', saved.id]);
        }
      },
      error: (error: unknown) => {
        this.saving = false;
        this.error = this.formatError(error);
      }
    });
  }

  private loadReferenceOptions(): void {
    this.service.getGoalOptions().subscribe({
      next: (items) => {
        this.allGoalOptions = items;
      }
    });

    this.service.getActionOptions().subscribe({
      next: (items) => {
        this.taskOptions = items;
      }
    });

    this.service.getQuestionnaireOptions().subscribe({
      next: (items) => {
        this.questionnaireOptions = items;
      }
    });

    this.service.getActivityDefinitionOptions().subscribe({
      next: (items) => {
        this.activityDefinitionOptions = items;
      }
    });
  }

  private patchForm(plan: CarePlanDetail): void {
    this.form.patchValue({
      title: plan.title,
      description: plan.description,
      status: plan.status || 'draft',
      version: plan.version
    });

    this.selectedGoals = this.mapReferencesToOptions(plan.goalRefs, this.allGoalOptions, 'Goal');
    this.steps = plan.steps.map((step) => ({ ...step, uid: step.uid || this.createUid() }));
  }

  private mapReferencesToOptions(
    refs: string[],
    options: LinkedReferenceOption[],
    resourceType: 'Goal' | 'Task'
  ): LinkedReferenceOption[] {
    const byReference = new Map(options.map((item) => [item.reference, item]));
    return refs.map((reference) => {
      const normalized = reference.startsWith(`${resourceType}/`) ? reference : `${resourceType}/${reference}`;
      const existing = byReference.get(normalized);
      if (existing) {
        return existing;
      }

      const id = normalized.startsWith(`${resourceType}/`) ? normalized.slice(`${resourceType}/`.length) : normalized;
      return {
        id,
        reference: normalized,
        label: `${resourceType} ${id}`
      };
    });
  }

  private createEmptyStep(type: CarePlanStepType): CarePlanStep {
    return {
      uid: this.createUid(),
      type,
      title: '',
      description: '',
      priority: 'routine',
      questionnaireRef: '',
      activityDefinitionRef: '',
      communicationMessage: '',
      taskRef: ''
    };
  }

  private createUid(): string {
    return `step-${Math.random().toString(36).slice(2, 10)}`;
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
