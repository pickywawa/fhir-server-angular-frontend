import { CommonModule } from '@angular/common';
import { Component, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { BubbleCardComponent } from '../../../shared/components/bubble-card/bubble-card.component';
import { ModuleShellComponent } from '../../../shared/components/module-shell/module-shell.component';
import { CodeSystemSummary } from '../models/code-system.model';
import { FhirCodeSystemService } from '../services/fhir-code-system.service';

@Component({
  selector: 'app-code-system-list',
  standalone: true,
  imports: [CommonModule, TranslateModule, ModuleShellComponent, BubbleCardComponent],
  templateUrl: './code-system-list.component.html',
  styleUrl: './code-system-list.component.scss'
})
export class CodeSystemListComponent implements OnInit {
  readonly breadcrumbs = [{ label: 'menu.codeSystems' }];

  loading = false;
  error = '';
  items: CodeSystemSummary[] = [];

  constructor(
    private readonly router: Router,
    private readonly codeSystemService: FhirCodeSystemService,
    private readonly translateService: TranslateService
  ) {}

  ngOnInit(): void {
    this.loadCodeSystems();
  }

  goToCreatePage(): void {
    this.router.navigate(['/code-systems/new']);
  }

  goToDetailPage(item: CodeSystemSummary): void {
    this.router.navigate(['/code-systems', item.id]);
  }

  goToDetailPageFromKeyboard(event: KeyboardEvent, item: CodeSystemSummary): void {
    if (event.key !== 'Enter' && event.key !== ' ') {
      return;
    }
    event.preventDefault();
    this.goToDetailPage(item);
  }

  private loadCodeSystems(): void {
    this.loading = true;
    this.error = '';

    this.codeSystemService.listCodeSystems().subscribe({
      next: (items) => {
        this.items = items;
        this.loading = false;
      },
      error: (error: unknown) => {
        this.error = this.formatError(error);
        this.loading = false;
      }
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
