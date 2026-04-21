import { CommonModule } from '@angular/common';
import { Component, OnInit } from '@angular/core';
import { FormArray, FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { BubbleCardComponent } from '../../../shared/components/bubble-card/bubble-card.component';
import { FormControlFieldComponent } from '../../../shared/components/form-control-field/form-control-field.component';
import { ModuleShellComponent } from '../../../shared/components/module-shell/module-shell.component';
import {
  CARE_ACTION_PARTICIPANT_ROLE_OPTIONS,
  CARE_ACTION_PARTICIPANT_TYPE_OPTIONS,
  CARE_ACTION_STATUS_OPTIONS,
  CARE_ACTION_TIMING_OPTIONS,
  CARE_DEFINITION_OPTIONS,
  CARE_PRIORITY_OPTIONS,
  CareActionDetail,
  LinkedReferenceOption
} from '../models/care-plan-admin.model';
import { FhirCarePlansAdminService } from '../services/fhir-care-plans-admin.service';

@Component({
  selector: 'app-care-plan-action-detail-page',
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    TranslateModule,
    ModuleShellComponent,
    BubbleCardComponent,
    FormControlFieldComponent
  ],
  templateUrl: './care-plan-action-detail-page.component.html',
  styleUrl: './care-plan-action-detail-page.component.scss'
})
export class CarePlanActionDetailPageComponent implements OnInit {
  readonly form;
  readonly statusOptions = CARE_ACTION_STATUS_OPTIONS.map((value) => ({ value, label: value }));
  readonly priorityOptions = CARE_PRIORITY_OPTIONS.map((value) => ({ value, label: value }));
  readonly definitionOptions = CARE_DEFINITION_OPTIONS.map((value) => ({ value, label: value }));
  readonly baseTimingOptions = CARE_ACTION_TIMING_OPTIONS.map((value) => ({ value, label: value }));
  readonly baseParticipantTypeOptions = CARE_ACTION_PARTICIPANT_TYPE_OPTIONS.map((value) => ({ value, label: value }));
  readonly baseParticipantRoleOptions = CARE_ACTION_PARTICIPANT_ROLE_OPTIONS.map((value) => ({ value, label: value }));

  loading = true;
  saving = false;
  error = '';
  isCreate = false;
  editMode = false;
  actionId = '';

  goalQuery = '';
  relatedActionQuery = '';
  goalResults: LinkedReferenceOption[] = [];
  relatedActionResults: LinkedReferenceOption[] = [];
  allGoalOptions: LinkedReferenceOption[] = [];
  allActionOptions: LinkedReferenceOption[] = [];
  selectedGoals: LinkedReferenceOption[] = [];
  selectedRelatedActions: LinkedReferenceOption[] = [];

  breadcrumbs = [
    { label: 'menu.carePlans', link: '/care-plans' },
    { label: 'carePlans.tabs.actions' }
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
      code: [''],
      timing: [''],
      participantType: [''],
      participantRole: [''],
      definition: ['task'],
      priority: ['routine'],
      status: ['draft'],
      required: [false],
      conditions: this.fb.array([])
    });
  }

  ngOnInit(): void {
    this.actionId = String(this.route.snapshot.paramMap.get('id') || '').trim();
    this.isCreate = this.actionId === 'new';

    if (this.isCreate) {
      this.editMode = true;
      this.loading = false;
      this.addCondition();
      this.loadReferenceOptions();
      this.breadcrumbs = [
        { label: 'menu.carePlans', link: '/care-plans' },
        { label: 'carePlans.tabs.actions', link: '/care-plans?tab=actions' },
        { label: 'carePlans.detail.newAction' }
      ];
      return;
    }

    if (!this.actionId) {
      this.router.navigate(['/care-plans'], { queryParams: { tab: 'actions' } });
      return;
    }

    this.loadReferenceOptions();
    this.service.getAction(this.actionId).subscribe({
      next: (action) => {
        this.patchForm(action);
        this.loading = false;
      },
      error: (error: unknown) => {
        this.error = this.formatError(error);
        this.loading = false;
      }
    });
  }

  get timingOptions(): Array<{ value: string; label: string }> {
    return this.withCurrentValue(this.baseTimingOptions, this.form.get('timing')?.value);
  }

  get participantTypeOptions(): Array<{ value: string; label: string }> {
    return this.withCurrentValue(this.baseParticipantTypeOptions, this.form.get('participantType')?.value);
  }

  get participantRoleOptions(): Array<{ value: string; label: string }> {
    return this.withCurrentValue(this.baseParticipantRoleOptions, this.form.get('participantRole')?.value);
  }

  get conditionsArray(): FormArray {
    return this.form.get('conditions') as FormArray;
  }

  addCondition(): void {
    this.conditionsArray.push(this.fb.control(''));
  }

  removeCondition(index: number): void {
    this.conditionsArray.removeAt(index);
  }

  enableEdit(): void {
    this.editMode = true;
  }

  cancelEdit(): void {
    if (this.isCreate) {
      this.router.navigate(['/care-plans'], { queryParams: { tab: 'actions' } });
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

  searchRelatedActions(value: string): void {
    this.relatedActionQuery = value;
    const query = value.trim().toLowerCase();
    if (!query) {
      this.relatedActionResults = [];
      return;
    }

    const selected = new Set(this.selectedRelatedActions.map((item) => item.reference));
    this.relatedActionResults = this.allActionOptions
      .filter((item) => !selected.has(item.reference))
      .filter((item) => item.reference !== `Task/${this.actionId}`)
      .filter((item) => item.label.toLowerCase().includes(query));
  }

  addGoal(option: LinkedReferenceOption): void {
    this.selectedGoals = [...this.selectedGoals, option];
    this.goalQuery = '';
    this.goalResults = [];
  }

  addRelatedAction(option: LinkedReferenceOption): void {
    this.selectedRelatedActions = [...this.selectedRelatedActions, option];
    this.relatedActionQuery = '';
    this.relatedActionResults = [];
  }

  removeGoal(index: number): void {
    this.selectedGoals = this.selectedGoals.filter((_, idx) => idx !== index);
  }

  removeRelatedAction(index: number): void {
    this.selectedRelatedActions = this.selectedRelatedActions.filter((_, idx) => idx !== index);
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

  moveRelatedAction(index: number, direction: -1 | 1): void {
    const nextIndex = index + direction;
    if (nextIndex < 0 || nextIndex >= this.selectedRelatedActions.length) {
      return;
    }
    const copy = [...this.selectedRelatedActions];
    const [item] = copy.splice(index, 1);
    copy.splice(nextIndex, 0, item);
    this.selectedRelatedActions = copy;
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
      code: String(raw.code || '').trim(),
      timing: String(raw.timing || '').trim(),
      participantType: String(raw.participantType || '').trim(),
      participantRole: String(raw.participantRole || '').trim(),
      definition: String(raw.definition || '').trim(),
      priority: String(raw.priority || '').trim(),
      status: String(raw.status || '').trim(),
      required: Boolean(raw.required),
      conditions: this.conditionsArray.controls
        .map((control) => String(control.value || '').trim())
        .filter((value) => value.length > 0),
      goalRefs: this.selectedGoals.map((item) => item.reference),
      relatedActionRefs: this.selectedRelatedActions.map((item) => item.reference)
    };

    const request$ = this.isCreate
      ? this.service.createAction(payload)
      : this.service.updateAction(this.actionId, payload);

    request$.subscribe({
      next: (saved) => {
        this.saving = false;
        this.patchForm(saved);
        this.editMode = false;

        if (this.isCreate) {
          this.router.navigate(['/care-plans/actions', saved.id]);
        }
      },
      error: (error: unknown) => {
        this.saving = false;
        this.error = this.formatError(error);
      }
    });
  }

  private patchForm(action: CareActionDetail): void {
    while (this.conditionsArray.length) {
      this.conditionsArray.removeAt(0);
    }

    const conditions = action.conditions.length > 0 ? action.conditions : [''];
    for (const condition of conditions) {
      this.conditionsArray.push(this.fb.control(condition));
    }

    this.form.patchValue({
      title: action.title,
      description: action.description,
      code: action.code,
      timing: action.timing,
      participantType: action.participantType,
      participantRole: action.participantRole,
      definition: action.definition || 'task',
      priority: action.priority || 'routine',
      status: action.status || 'draft',
      required: action.required
    });

    this.selectedGoals = this.mapReferencesToOptions(action.goalRefs, this.allGoalOptions, 'Goal');
    this.selectedRelatedActions = this.mapReferencesToOptions(action.relatedActionRefs, this.allActionOptions, 'Task');
  }

  private loadReferenceOptions(): void {
    this.service.getGoalOptions().subscribe({
      next: (items) => {
        this.allGoalOptions = items;
      }
    });

    this.service.getActionOptions().subscribe({
      next: (items) => {
        this.allActionOptions = items;
      }
    });
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

  private withCurrentValue(
    options: Array<{ value: string; label: string }>,
    currentRaw: unknown
  ): Array<{ value: string; label: string }> {
    const current = String(currentRaw || '').trim();
    if (!current) {
      return options;
    }

    const exists = options.some((option) => option.value === current);
    if (exists) {
      return options;
    }

    return [{ value: current, label: current }, ...options];
  }
}
