import { Component, OnDestroy, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, ReactiveFormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { ModuleShellComponent } from '../../../shared/components/module-shell/module-shell.component';
import { BubbleCardComponent } from '../../../shared/components/bubble-card/bubble-card.component';
import { TranslateModule } from '@ngx-translate/core';
import { FhirCarePlanWorklistService } from '../services/fhir-care-plan-worklist.service';
import { CarePlanWorklistItem } from '../models/care-plan-worklist.model';
import { Subject, debounceTime, distinctUntilChanged, takeUntil } from 'rxjs';

type WorklistSortField =
  | 'civilStatus'
  | 'ipp'
  | 'ins'
  | 'identityStatus'
  | 'birthDate'
  | 'gender'
  | 'practitioner'
  | 'pathwayStatus'
  | 'category'
  | 'lastChanged';
type SortDirection = 'asc' | 'desc';

@Component({
  selector: 'app-patient-list',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, ModuleShellComponent, BubbleCardComponent, TranslateModule],
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
  sortField: WorklistSortField = 'lastChanged';
  sortDirection: SortDirection = 'asc';
  loading = false;
  error: any = null;
  isSearchExpanded = false;

  private readonly destroy$ = new Subject<void>();

  constructor(
    private fb: FormBuilder,
    private carePlanWorklistService: FhirCarePlanWorklistService,
    private router: Router
  ) {
    this.searchForm = this.fb.group({
      quickSearch: [''],
      family: [''],
      given: [''],
      birthDate: [''],
      status: [''],
      category: ['']
    });
  }

  ngOnInit(): void {
    this.searchForm
      .get('quickSearch')
      ?.valueChanges.pipe(debounceTime(180), distinctUntilChanged(), takeUntil(this.destroy$))
      .subscribe(() => this.applySearch());

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
      quickSearch: this.searchForm.get('quickSearch')?.value || '',
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
    const carePlanContext = {
      source: 'careplan-worklist',
      patientId: item.patientId,
      carePlanId: item.carePlanId,
      createdAt: Date.now()
    };
    sessionStorage.setItem('chat-careplan-context', JSON.stringify(carePlanContext));

    this.router.navigate(['/my-patients', item.patientId], {
      state: { chatCarePlanContext: carePlanContext }
    });
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
      draft: 'Provisoire',
      active: 'Ouvert',
      'on-hold': 'En pause',
      revoked: 'Ferme',
      completed: 'Ferme',
      entered: 'Ouvert',
      unknown: 'Inconnu'
    };
    return labels[status] || status || '-';
  }

  statusClass(status: string): string {
    const tone: Record<string, string> = {
      draft: 'tag-violet',
      active: 'tag-blue',
      'on-hold': 'tag-red',
      revoked: 'tag-slate',
      completed: 'tag-slate',
      entered: 'tag-blue',
      unknown: 'tag-slate'
    };
    return tone[status] || 'tag-slate';
  }

  identityStatusLabel(status: CarePlanWorklistItem['identityStatus']): string {
    return status === 'validated' ? 'Validee' : 'Provisoire';
  }

  identityStatusClass(status: CarePlanWorklistItem['identityStatus']): string {
    return status === 'validated' ? 'tag-green' : 'tag-amber';
  }

  genderLabel(gender: string): string {
    const labels: Record<string, string> = {
      male: 'Homme',
      female: 'Femme',
      other: 'Autre',
      unknown: 'Inconnu'
    };
    return labels[gender] || labels['unknown'];
  }

  hasBirthName(item: CarePlanWorklistItem): boolean {
    return !!item.patientBirthName && item.patientBirthName.toLowerCase() !== item.patientLastName.toLowerCase();
  }

  civilIdentity(item: CarePlanWorklistItem): string {
    const family = (item.patientLastName || '').trim().toUpperCase();
    const birthName = this.hasBirthName(item) ? ` (${item.patientBirthName.trim().toUpperCase()})` : '';
    const given = (item.patientFirstName || '').trim();
    return `${family}${birthName} ${given}`.trim() || '-';
  }

  doctorDisplay(item: CarePlanWorklistItem): string {
    const display = (item.practitionerDisplay || '').trim();
    if (!display || display === '-') {
      return '-';
    }

    return display.toLowerCase().startsWith('dr.') ? display : `Dr. ${display}`;
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

  navigateToCreateCarePlan(): void {
    this.router.navigate(['/my-patients/careplan/new']);
  }

  private applySearch(): void {
    const raw = this.searchForm.value;
    const quickSearch = String(raw.quickSearch || '').trim().toLowerCase();
    const family = String(raw.family || '').trim().toLowerCase();
    const given = String(raw.given || '').trim().toLowerCase();
    const birthDate = String(raw.birthDate || '').trim();
    const status = String(raw.status || '').trim();
    const category = String(raw.category || '').trim();

    this.filteredWorklist = this.worklist.filter((item) => {
      const quickSearchHaystack = [
        item.patientLastName,
        item.patientFirstName,
        item.patientBirthName,
        item.patientIpp,
        item.patientIns,
        item.carePlanId,
        item.patientId
      ]
        .filter((value) => !!value)
        .join(' ')
        .toLowerCase();

      const matchQuickSearch = !quickSearch || quickSearchHaystack.includes(quickSearch);
      const matchFamily = !family || item.patientLastName.toLowerCase().includes(family);
      const matchGiven = !given || item.patientFirstName.toLowerCase().includes(given);
      const matchBirthDate = !birthDate || item.patientBirthDate === birthDate;
      const matchStatus = !status || item.status === status;
      const matchCategory = !category || item.categoryCode === category;
      return matchQuickSearch && matchFamily && matchGiven && matchBirthDate && matchStatus && matchCategory;
    });

    this.filteredWorklist.sort((a, b) => {
      const left = this.sortValue(a, this.sortField);
      const right = this.sortValue(b, this.sortField);
      const comparison = left.localeCompare(right);
      return this.sortDirection === 'asc' ? comparison : -comparison;
    });
  }

  private sortValue(item: CarePlanWorklistItem, field: WorklistSortField): string {
    if (field === 'civilStatus') {
      return this.civilIdentity(item).toLowerCase();
    }
    if (field === 'ipp') {
      return (item.patientIpp || '').toLowerCase();
    }
    if (field === 'ins') {
      return (item.patientIns || '').toLowerCase();
    }
    if (field === 'identityStatus') {
      return this.identityStatusLabel(item.identityStatus).toLowerCase();
    }
    if (field === 'birthDate') {
      return (item.patientBirthDate || '').toLowerCase();
    }
    if (field === 'gender') {
      return this.genderLabel(item.patientGender).toLowerCase();
    }
    if (field === 'practitioner') {
      return this.doctorDisplay(item).toLowerCase();
    }
    if (field === 'pathwayStatus') {
      return (this.statusLabel(item.status) || '').toLowerCase();
    }
    if (field === 'category') {
      return (item.categoryLabel || item.categoryCode || '').toLowerCase();
    }
    return (item.lastChanged || item.created || '').toLowerCase();
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

  openAdvancedSearch(): void {
    this.isSearchExpanded = true;
  }

  closeAdvancedSearch(): void {
    this.isSearchExpanded = false;
  }
}
