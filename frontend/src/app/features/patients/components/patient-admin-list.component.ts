import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, ReactiveFormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { FhirPatientAdminService } from '../services/fhir-patient-admin.service';
import { PatientProfile, PatientSearchCriteria } from '../models/patient-admin.model';
import { ModuleShellComponent } from '../../../shared/components/module-shell/module-shell.component';
import { BubbleCardComponent } from '../../../shared/components/bubble-card/bubble-card.component';
import { ResultListItemComponent } from '../../../shared/components/result-list-item/result-list-item.component';
import { TranslateModule } from '@ngx-translate/core';

@Component({
  selector: 'app-patient-admin-list',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, ModuleShellComponent, BubbleCardComponent, ResultListItemComponent, TranslateModule],
  templateUrl: './patient-admin-list.component.html',
  styleUrl: './patient-admin-list.component.scss'
})
export class PatientAdminListComponent {
  readonly breadcrumbs = [{ label: 'menu.patients' }];

  readonly searchForm: FormGroup;

  hasSearched = false;
  loading = false;
  error = '';
  results: PatientProfile[] = [];

  private readonly fb = inject(FormBuilder);
  private readonly patientService = inject(FhirPatientAdminService);
  private readonly router = inject(Router);

  constructor() {
    this.searchForm = this.fb.group({
      family: [''],
      given: [''],
      birthDate: ['']
    });
  }

  search(): void {
    const value = this.searchForm.getRawValue();

    this.loading = true;
    this.error = '';
    this.hasSearched = true;

    const criteria: PatientSearchCriteria = {
      family: value.family || '',
      given: value.given || '',
      birthDate: value.birthDate || ''
    };

    this.patientService.searchPatients(criteria).subscribe({
      next: (results) => {
        this.results = results;
        this.loading = false;
      },
      error: (error: unknown) => {
        this.error = this.formatError(error);
        this.loading = false;
      }
    });
  }

  resetSearch(): void {
    this.searchForm.reset({ family: '', given: '', birthDate: '' });
    this.hasSearched = false;
    this.results = [];
    this.error = '';
  }

  addPatient(): void {
    this.router.navigate(['/patients/new']);
  }

  openPatient(patient: PatientProfile): void {
    if (!patient.id) {
      return;
    }
    this.router.navigate(['/patients', patient.id]);
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
    return 'Erreur inconnue';
  }
}

