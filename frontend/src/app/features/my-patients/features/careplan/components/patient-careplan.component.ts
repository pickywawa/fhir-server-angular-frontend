import { Component, Input, OnChanges, SimpleChanges } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { BubbleCardComponent } from '../../../../../shared/components/bubble-card/bubble-card.component';
import { FormControlFieldComponent } from '../../../../../shared/components/form-control-field/form-control-field.component';
import { FhirCarePlanService } from '../services/fhir-care-plan.service';
import {
  CarePlanCategoryOption,
  CarePlanOption,
  PatientCarePlanFormValue
} from '../models/patient-care-plan.model';

@Component({
  selector: 'app-patient-careplan',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, BubbleCardComponent, FormControlFieldComponent],
  templateUrl: './patient-careplan.component.html',
  styleUrl: './patient-careplan.component.scss'
})
export class PatientCarePlanComponent implements OnChanges {
  @Input() patientId?: string;

  readonly statusOptions = [
    { value: 'draft', label: 'Brouillon' },
    { value: 'active', label: 'Actif' },
    { value: 'on-hold', label: 'En pause' },
    { value: 'revoked', label: 'Révoqué' },
    { value: 'completed', label: 'Terminé' },
    { value: 'entered-in-error', label: 'Saisi en erreur' },
    { value: 'unknown', label: 'Inconnu' }
  ];

  readonly intentOptions = [
    { value: 'proposal', label: 'Proposition' },
    { value: 'plan', label: 'Plan' },
    { value: 'order', label: 'Ordre' },
    { value: 'option', label: 'Option' },
    { value: 'directive', label: 'Directive' }
  ];

  carePlanOptions: CarePlanOption[] = [];
  categoryOptions: CarePlanCategoryOption[] = [];

  loading = false;
  saving = false;
  error = '';

  form: FormGroup;

  private carePlansById = new Map<string, PatientCarePlanFormValue>();

  get carePlanSelectOptions(): { value: string; label: string }[] {
    return this.carePlanOptions.map((option) => ({
      value: option.id,
      label: `${option.title} (${option.id})`
    }));
  }

  get categorySelectOptions(): { value: string; label: string }[] {
    return this.categoryOptions.map((option) => ({
      value: option.code,
      label: option.label
    }));
  }

  constructor(
    private readonly fb: FormBuilder,
    private readonly carePlanService: FhirCarePlanService
  ) {
    this.form = this.fb.group({
      carePlanId: [''],
      status: ['draft', Validators.required],
      intent: ['plan', Validators.required],
      categoryCode: ['', Validators.required],
      title: ['', Validators.required],
      description: [''],
      note: ['']
    });
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['patientId']) {
      this.loadCarePlans();
    }
  }

  onCarePlanChange(): void {
    const selectedId = String(this.form.value.carePlanId || '');
    this.patchFormFromSelection(selectedId);
  }

  save(): void {
    if (!this.patientId || !this.form.valid) {
      this.form.markAllAsTouched();
      return;
    }

    const selectedId = String(this.form.value.carePlanId || '');
    if (!selectedId) {
      this.error = 'Aucun CarePlan à modifier.';
      return;
    }

    const value: PatientCarePlanFormValue = {
      id: selectedId,
      status: String(this.form.value.status || 'draft').trim(),
      intent: String(this.form.value.intent || 'plan').trim(),
      categoryCode: String(this.form.value.categoryCode || '').trim(),
      title: String(this.form.value.title || '').trim(),
      description: String(this.form.value.description || '').trim(),
      note: String(this.form.value.note || '').trim()
    };

    this.saving = true;
    this.error = '';

    this.carePlanService.updateCarePlan(value, this.patientId).subscribe({
      next: (updated) => {
        this.carePlansById.set(updated.id, updated);
        this.patchFormFromSelection(updated.id);
        this.saving = false;
      },
      error: (err) => {
        this.error = this.formatError(err);
        this.saving = false;
      }
    });
  }

  private loadCarePlans(): void {
    if (!this.patientId) {
      this.resetState();
      return;
    }

    this.loading = true;
    this.error = '';

    this.carePlanService.getCarePlansForPatient(this.patientId).subscribe({
      next: ({ carePlans, categories }) => {
        this.categoryOptions = categories;
        this.carePlansById.clear();
        for (const plan of carePlans) {
          this.carePlansById.set(plan.id, plan);
        }

        this.carePlanOptions = carePlans.map((plan) => ({
          id: plan.id,
          title: plan.title || `CarePlan ${plan.id}`,
          created: ''
        }));

        const firstId = this.carePlanOptions[0]?.id || '';
        this.form.patchValue({ carePlanId: firstId });
        this.patchFormFromSelection(firstId);

        this.loading = false;
      },
      error: (err) => {
        this.error = this.formatError(err);
        this.loading = false;
      }
    });
  }

  private patchFormFromSelection(carePlanId: string): void {
    const selected = this.carePlansById.get(carePlanId);
    if (!selected) {
      this.form.patchValue({
        status: 'draft',
        intent: 'plan',
        categoryCode: this.categoryOptions[0]?.code || '',
        title: '',
        description: '',
        note: ''
      });
      return;
    }

    this.form.patchValue({
      status: selected.status || 'draft',
      intent: selected.intent || 'plan',
      categoryCode: selected.categoryCode || this.categoryOptions[0]?.code || '',
      title: selected.title || '',
      description: selected.description || '',
      note: selected.note || ''
    });
  }

  private resetState(): void {
    this.carePlanOptions = [];
    this.categoryOptions = [];
    this.carePlansById.clear();
    this.error = '';
    this.loading = false;
    this.saving = false;
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
    return 'Erreur lors du chargement du CarePlan.';
  }
}
