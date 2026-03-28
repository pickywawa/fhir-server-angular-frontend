import { Component, OnDestroy, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, ReactiveFormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { ModuleShellComponent } from '../../../shared/components/module-shell/module-shell.component';
import { BubbleCardComponent } from '../../../shared/components/bubble-card/bubble-card.component';
import { TranslateModule } from '@ngx-translate/core';
import { FhirCarePlanWorklistService } from '../services/fhir-care-plan-worklist.service';
import { CarePlanWorklistItem } from '../models/care-plan-worklist.model';
import { ModalComponent } from '../../../core/components/modal/modal.component';
import { FhirAppointmentService } from '../../agenda/services/fhir-appointment.service';
import { ResourceOption } from '../../agenda/models/agenda-appointment.model';
import { Subject, debounceTime, distinctUntilChanged, switchMap, takeUntil } from 'rxjs';
import { FhirCarePlanService } from '../features/careplan/services/fhir-care-plan.service';

type WorklistSortField = 'patient' | 'category' | 'status' | 'title';
type SortDirection = 'asc' | 'desc';

@Component({
  selector: 'app-patient-list',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, ModuleShellComponent, BubbleCardComponent, TranslateModule, ModalComponent],
  templateUrl: './patient-list.component.html',
  styleUrls: ['./patient-list.component.scss']
})
export class PatientListComponent implements OnInit, OnDestroy {
  readonly breadcrumbs = [{ label: 'menu.myPatients' }];
  searchForm: FormGroup;
  worklist: CarePlanWorklistItem[] = [];
  filteredWorklist: CarePlanWorklistItem[] = [];
  statusFilterOptions: Array<{ value: string; label: string }> = [];
  categoryFilterOptions: Array<{ value: string; label: string }> = [];
  sortField: WorklistSortField = 'patient';
  sortDirection: SortDirection = 'asc';
  loading = false;
  error: any = null;
  showCreateCarePlanModal = false;
  creatingCarePlan = false;
  createCarePlanError = '';

  createCarePlanForm: FormGroup;
  createStatusOptions: Array<{ value: string; label: string }> = [];
  createIntentOptions: Array<{ value: string; label: string }> = [];
  createCategoryOptions: Array<{ value: string; label: string }> = [];
  patientQuery = '';
  patientSearchResults: ResourceOption[] = [];
  selectedPatient: ResourceOption | null = null;

  private readonly destroy$ = new Subject<void>();
  private readonly patientSearch$ = new Subject<string>();

  constructor(
    private fb: FormBuilder,
    private carePlanWorklistService: FhirCarePlanWorklistService,
    private carePlanService: FhirCarePlanService,
    private appointmentService: FhirAppointmentService,
    private router: Router
  ) {
    this.searchForm = this.fb.group({
      family: [''],
      given: [''],
      birthDate: [''],
      status: [''],
      category: ['']
    });

    this.createCarePlanForm = this.fb.group({
      categoryCode: [''],
      status: ['draft'],
      intent: ['plan'],
      title: [''],
      description: [''],
      note: ['']
    });

    this.createStatusOptions = [
      { value: 'draft', label: this.statusLabel('draft') },
      { value: 'active', label: this.statusLabel('active') },
      { value: 'on-hold', label: this.statusLabel('on-hold') },
      { value: 'revoked', label: this.statusLabel('revoked') },
      { value: 'completed', label: this.statusLabel('completed') },
      { value: 'entered-in-error', label: 'Saisi en erreur' },
      { value: 'unknown', label: this.statusLabel('unknown') }
    ];

    this.createIntentOptions = [
      { value: 'plan', label: this.intentLabel('plan') },
      { value: 'proposal', label: this.intentLabel('proposal') },
      { value: 'order', label: this.intentLabel('order') },
      { value: 'option', label: this.intentLabel('option') },
      { value: 'directive', label: this.intentLabel('directive') }
    ];

  }

  ngOnInit(): void {
    this.initializePatientSearch();
    this.loadPatients();
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  onSearch(): void {
    this.applySearch();
  }

  onResetSearch(): void {
    this.searchForm.reset({
      family: '',
      given: '',
      birthDate: '',
      status: '',
      category: ''
    });
    this.applySearch();
  }

  openPatient(item: CarePlanWorklistItem): void {
    if (!item.patientId) {
      return;
    }
    this.router.navigate(['/my-patients', item.patientId]);
  }

  private loadPatients(): void {
    this.loading = true;
    this.error = null;

    this.carePlanWorklistService.getCarePlanWorklist(200).subscribe({
      next: (items) => {
        this.worklist = items;
        this.buildFilterOptions(items);
        this.applySearch();
        this.loading = false;
      },
      error: (err) => {
        this.error = err;
        this.loading = false;
      }
    });
  }

  statusLabel(status: string): string {
    const labels: Record<string, string> = {
      draft: 'Brouillon',
      active: 'Actif',
      'on-hold': 'En pause',
      revoked: 'Révoqué',
      completed: 'Terminé',
      entered: 'Saisi',
      unknown: 'Inconnu'
    };
    return labels[status] || status || '-';
  }

  intentLabel(intent: string): string {
    const labels: Record<string, string> = {
      proposal: 'Proposition',
      plan: 'Plan',
      order: 'Ordre',
      option: 'Option',
      directive: 'Directive'
    };
    return labels[intent] || intent || '-';
  }

  statusClass(status: string): string {
    const tone: Record<string, string> = {
      draft: 'tag-slate',
      active: 'tag-green',
      'on-hold': 'tag-amber',
      revoked: 'tag-red',
      completed: 'tag-blue',
      entered: 'tag-slate',
      unknown: 'tag-slate'
    };
    return tone[status] || 'tag-slate';
  }

  intentClass(intent: string): string {
    const tone: Record<string, string> = {
      proposal: 'tag-violet',
      plan: 'tag-cyan',
      order: 'tag-indigo',
      option: 'tag-zinc',
      directive: 'tag-violet'
    };
    return tone[intent] || 'tag-zinc';
  }

  toggleSort(field: WorklistSortField): void {
    if (this.sortField === field) {
      this.sortDirection = this.sortDirection === 'asc' ? 'desc' : 'asc';
    } else {
      this.sortField = field;
      this.sortDirection = 'asc';
    }
    this.applySearch();
  }

  sortIndicator(field: WorklistSortField): string {
    if (this.sortField !== field) {
      return '↕';
    }
    return this.sortDirection === 'asc' ? '↑' : '↓';
  }

  openCreateCarePlanModal(): void {
    this.showCreateCarePlanModal = true;
    this.createCarePlanError = '';
    this.creatingCarePlan = false;
    this.patientQuery = '';
    this.patientSearchResults = [];
    this.selectedPatient = null;
    this.createCarePlanForm.reset({
      categoryCode: this.createCategoryOptions[0]?.value || '',
      status: 'draft',
      intent: 'plan',
      title: '',
      description: '',
      note: ''
    });

    this.carePlanService.getCarePlanCategories().subscribe({
      next: (categories) => {
        this.createCategoryOptions = categories.map((item) => ({ value: item.code, label: item.label }));
        this.createCarePlanForm.patchValue({
          categoryCode: this.createCategoryOptions[0]?.value || ''
        });
      },
      error: () => {
        this.createCarePlanError = 'Impossible de charger les catégories de CarePlan.';
      }
    });
  }

  closeCreateCarePlanModal(): void {
    this.showCreateCarePlanModal = false;
  }

  onCreatePatientQueryChanged(value: string): void {
    this.patientQuery = value;
    if (this.selectedPatient && value.trim() !== this.selectedPatient.label) {
      this.selectedPatient = null;
    }
    if (!value.trim()) {
      this.patientSearchResults = [];
      return;
    }
    this.patientSearch$.next(value);
  }

  selectCreatePatient(option: ResourceOption): void {
    this.selectedPatient = option;
    this.patientQuery = option.label;
    this.patientSearchResults = [];
  }

  clearSelectedCreatePatient(): void {
    this.selectedPatient = null;
    this.patientQuery = '';
    this.patientSearchResults = [];
  }

  submitCreateCarePlan(): void {
    if (this.creatingCarePlan) {
      return;
    }
    if (!this.selectedPatient?.reference) {
      this.createCarePlanError = 'Veuillez sélectionner un patient.';
      return;
    }

    const raw = this.createCarePlanForm.value;
    const categoryCode = String(raw.categoryCode || '').trim();
    const title = String(raw.title || '').trim();
    if (!categoryCode || !title) {
      this.createCarePlanError = 'Veuillez renseigner la catégorie et le titre.';
      return;
    }

    this.creatingCarePlan = true;
    this.createCarePlanError = '';

    this.carePlanService.createCarePlan({
      patientReference: this.selectedPatient.reference,
      categoryCode,
      status: String(raw.status || 'draft').trim(),
      intent: String(raw.intent || 'plan').trim(),
      title,
      description: String(raw.description || '').trim(),
      note: String(raw.note || '').trim()
    }).subscribe({
      next: ({ patientId }) => {
        this.creatingCarePlan = false;
        this.showCreateCarePlanModal = false;
        this.loadPatients();
        if (patientId) {
          this.router.navigate(['/my-patients', patientId]);
        }
      },
      error: (err) => {
        this.creatingCarePlan = false;
        this.createCarePlanError = err?.message || 'Impossible de créer le CarePlan.';
      }
    });
  }

  private applySearch(): void {
    const raw = this.searchForm.value;
    const family = String(raw.family || '').trim().toLowerCase();
    const given = String(raw.given || '').trim().toLowerCase();
    const birthDate = String(raw.birthDate || '').trim();
    const status = String(raw.status || '').trim();
    const category = String(raw.category || '').trim();

    this.filteredWorklist = this.worklist.filter((item) => {
      const matchFamily = !family || item.patientLastName.toLowerCase().includes(family);
      const matchGiven = !given || item.patientFirstName.toLowerCase().includes(given);
      const matchBirthDate = !birthDate || item.patientBirthDate === birthDate;
      const matchStatus = !status || item.status === status;
      const matchCategory = !category || item.categoryCode === category;
      return matchFamily && matchGiven && matchBirthDate && matchStatus && matchCategory;
    });

    this.filteredWorklist.sort((a, b) => {
      const left = this.sortValue(a, this.sortField);
      const right = this.sortValue(b, this.sortField);
      const comparison = left.localeCompare(right);
      return this.sortDirection === 'asc' ? comparison : -comparison;
    });
  }

  private sortValue(item: CarePlanWorklistItem, field: WorklistSortField): string {
    if (field === 'patient') {
      return `${item.patientLastName} ${item.patientFirstName}`.trim().toLowerCase();
    }
    if (field === 'category') {
      return (item.categoryLabel || item.categoryCode || '').toLowerCase();
    }
    if (field === 'status') {
      return (this.statusLabel(item.status) || '').toLowerCase();
    }
    return (item.title || '').toLowerCase();
  }

  private buildFilterOptions(items: CarePlanWorklistItem[]): void {
    const statusValues = Array.from(new Set(items.map((item) => item.status).filter((value) => !!value)));
    statusValues.sort((a, b) => this.statusLabel(a).localeCompare(this.statusLabel(b)));
    this.statusFilterOptions = statusValues.map((value) => ({
      value,
      label: this.statusLabel(value)
    }));

    const categoryMap = new Map<string, string>();
    for (const item of items) {
      if (!item.categoryCode) {
        continue;
      }
      categoryMap.set(item.categoryCode, item.categoryLabel || item.categoryCode);
    }

    this.categoryFilterOptions = Array.from(categoryMap.entries())
      .map(([value, label]) => ({ value, label }))
      .sort((a, b) => a.label.localeCompare(b.label));
  }

  private initializePatientSearch(): void {
    this.patientSearch$
      .pipe(
        debounceTime(250),
        distinctUntilChanged(),
        switchMap((query) => this.appointmentService.searchPatients(query, 10)),
        takeUntil(this.destroy$)
      )
      .subscribe((results) => {
        this.patientSearchResults = results;
      });
  }
}
