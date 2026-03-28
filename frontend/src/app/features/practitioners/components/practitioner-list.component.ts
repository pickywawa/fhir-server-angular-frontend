import { Component } from '@angular/core';

import { FormBuilder, ReactiveFormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { ModuleShellComponent } from '../../../shared/components/module-shell/module-shell.component';
import { BubbleCardComponent } from '../../../shared/components/bubble-card/bubble-card.component';
import { ResultListItemComponent } from '../../../shared/components/result-list-item/result-list-item.component';
import { FhirPractitionerService } from '../services/fhir-practitioner.service';
import { PractitionerProfile } from '../models/practitioner.model';
import { TranslateModule, TranslateService } from '@ngx-translate/core';

@Component({
  selector: 'app-practitioner-list',
  standalone: true,
  imports: [ReactiveFormsModule, ModuleShellComponent, BubbleCardComponent, ResultListItemComponent, TranslateModule],
  templateUrl: './practitioner-list.component.html',
  styleUrl: './practitioner-list.component.scss'
})
export class PractitionerListComponent {
  readonly breadcrumbs = [{ label: 'menu.professionals' }];

  readonly searchForm;

  hasSearched = false;
  loading = false;
  error = '';
  results: PractitionerProfile[] = [];

  constructor(
    private readonly fb: FormBuilder,
    private readonly practitionerService: FhirPractitionerService,
    private readonly router: Router,
    private readonly translateService: TranslateService
  ) {
    this.searchForm = this.fb.group({
      family: [''],
      given: [''],
      identifier: ['']
    });
  }

  search(): void {
    const value = this.searchForm.getRawValue();

    this.loading = true;
    this.error = '';
    this.hasSearched = true;

    this.practitionerService.searchPractitioners({
      family: value.family || '',
      given: value.given || '',
      identifier: value.identifier || '',
      limit: 50
    }).subscribe({
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
    this.searchForm.reset({ family: '', given: '', identifier: '' });
    this.hasSearched = false;
    this.results = [];
    this.error = '';
  }

  addPractitioner(): void {
    this.router.navigate(['/practitioners/new']);
  }

  openPractitioner(practitioner: PractitionerProfile): void {
    if (!practitioner.id) {
      return;
    }
    this.router.navigate(['/practitioners', practitioner.id]);
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
