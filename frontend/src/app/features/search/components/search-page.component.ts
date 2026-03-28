import { CommonModule } from '@angular/common';
import { Component } from '@angular/core';
import { FormBuilder, ReactiveFormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { TranslateModule } from '@ngx-translate/core';
import { ModuleShellComponent } from '../../../shared/components/module-shell/module-shell.component';
import { BubbleCardComponent } from '../../../shared/components/bubble-card/bubble-card.component';
import { FhirSearchService } from '../services/fhir-search.service';
import { SearchResultItem } from '../models/search-result.model';

@Component({
  selector: 'app-search-page',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, TranslateModule, ModuleShellComponent, BubbleCardComponent],
  templateUrl: './search-page.component.html',
  styleUrls: ['./search-page.component.scss']
})
export class SearchPageComponent {
  readonly breadcrumbs = [{ label: 'search.title' }];
  readonly form;

  loading = false;
  error = '';
  hasSearched = false;
  results: SearchResultItem[] = [];

  constructor(
    private readonly fb: FormBuilder,
    private readonly router: Router,
    private readonly searchService: FhirSearchService
  ) {
    this.form = this.fb.group({
      query: ['']
    });
  }

  search(): void {
    const query = String(this.form.getRawValue().query || '').trim();
    this.hasSearched = true;
    this.error = '';

    if (!query) {
      this.results = [];
      return;
    }

    this.loading = true;
    this.searchService.search(query).subscribe({
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

  openResult(result: SearchResultItem): void {
    this.router.navigate(result.routeCommands, {
      queryParams: result.queryParams
    });
  }

  typeLabel(result: SearchResultItem): string {
    const labels: Record<SearchResultItem['type'], string> = {
      patient: 'Patient',
      practitioner: 'Professionnel',
      appointment: 'Rendez-vous',
      document: 'Document'
    };
    return labels[result.type];
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
    return 'search.error';
  }
}
