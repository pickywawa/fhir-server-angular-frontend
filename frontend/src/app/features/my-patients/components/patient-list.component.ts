import { Component, OnDestroy, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, ReactiveFormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { ModuleShellComponent } from '../../../shared/components/module-shell/module-shell.component';
import { BubbleCardComponent } from '../../../shared/components/bubble-card/bubble-card.component';
import { TranslateModule } from '@ngx-translate/core';
import { FhirCarePlanWorklistService } from '../services/fhir-care-plan-worklist.service';
import { CarePlanWorklistItem } from '../models/care-plan-worklist.model';
import { Subject, takeUntil } from 'rxjs';

type WorklistSortField = 'patient' | 'category' | 'status' | 'title';
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
  sortField: WorklistSortField = 'patient';
  sortDirection: SortDirection = 'asc';
  loading = false;
  error: any = null;
  isSearchExpanded = true;

  private readonly destroy$ = new Subject<void>();

  constructor(
    private fb: FormBuilder,
    private carePlanWorklistService: FhirCarePlanWorklistService,
    private router: Router
  ) {
    this.searchForm = this.fb.group({
      family: [''],
      given: [''],
      birthDate: [''],
      status: [''],
      category: ['']
    });
  }

  ngOnInit(): void {
      // Mobile by default has search collapsed
      this.isSearchExpanded = window.innerWidth > 768;
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

  navigateToCreateCarePlan(): void {
    this.router.navigate(['/my-patients/careplan/new']);
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

  toggleSearchExpanded(): void {
    this.isSearchExpanded = !this.isSearchExpanded;
  }
}
