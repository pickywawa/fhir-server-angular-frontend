import { CommonModule } from '@angular/common';
import { Component, OnDestroy, OnInit } from '@angular/core';
import { FormArray, FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { Subject, takeUntil } from 'rxjs';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { BubbleCardComponent } from '../../../shared/components/bubble-card/bubble-card.component';
import { ModuleBreadcrumb, ModuleShellComponent } from '../../../shared/components/module-shell/module-shell.component';
import { ToastService } from '../../../core/services/toast.service';
import { CodeSystemDetail } from '../models/code-system.model';
import { FhirCodeSystemService } from '../services/fhir-code-system.service';

@Component({
  selector: 'app-code-system-detail-page',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, TranslateModule, ModuleShellComponent, BubbleCardComponent],
  templateUrl: './code-system-detail-page.component.html',
  styleUrl: './code-system-detail-page.component.scss'
})
export class CodeSystemDetailPageComponent implements OnInit, OnDestroy {
  breadcrumbs: ModuleBreadcrumb[] = [
    { label: 'menu.codeSystems', route: '/code-systems' },
    { label: 'codeSystems.form.title' }
  ];

  readonly form;

  loading = false;
  saving = false;
  error = '';
  createMode = false;

  private codeSystemId = '';
  private readonly destroy$ = new Subject<void>();

  constructor(
    private readonly fb: FormBuilder,
    private readonly route: ActivatedRoute,
    private readonly router: Router,
    private readonly codeSystemService: FhirCodeSystemService,
    private readonly toastService: ToastService,
    private readonly translateService: TranslateService
  ) {
    this.form = this.fb.group({
      url: ['', [Validators.required, Validators.minLength(8)]],
      values: this.fb.array([])
    });
    this.addValue();
  }

  ngOnInit(): void {
    this.route.paramMap
      .pipe(takeUntil(this.destroy$))
      .subscribe((params) => {
        const id = params.get('id');
        if (!id) {
          return;
        }

        this.codeSystemId = id;
        this.createMode = id === 'new';

        if (this.createMode) {
          this.resetForm();
          this.breadcrumbs = [
            { label: 'menu.codeSystems', route: '/code-systems' },
            { label: 'codeSystems.form.title' }
          ];
          return;
        }

        this.loadCodeSystem(id);
      });
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  get values(): FormArray {
    return this.form.get('values') as FormArray;
  }

  get submitLabelKey(): string {
    return this.createMode ? 'common.create' : 'common.save';
  }

  addValue(): void {
    this.values.push(this.fb.group({
      code: ['', Validators.required],
      display: ['', Validators.required]
    }));
  }

  removeValue(index: number): void {
    if (this.values.length <= 1) {
      return;
    }
    this.values.removeAt(index);
  }

  onCancel(): void {
    this.router.navigate(['/code-systems']);
  }

  onSubmit(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    const rawValue = this.form.getRawValue();
    const concepts = ((rawValue.values || []) as Array<{ code?: string; display?: string }>)
      .map((item) => ({
        code: String(item?.code || '').trim(),
        display: String(item?.display || '').trim()
      }))
      .filter((item) => item.code.length > 0 && item.display.length > 0);

    if (concepts.length === 0) {
      this.error = this.translateService.instant('codeSystems.form.errors.noValues');
      return;
    }

    this.saving = true;
    this.error = '';

    const payload = {
      url: String(rawValue.url || '').trim(),
      concepts
    };

    const operation$ = this.createMode
      ? this.codeSystemService.createCodeSystem(payload)
      : this.codeSystemService.updateCodeSystem(this.codeSystemId, payload);

    operation$.subscribe({
      next: (saved) => {
        this.saving = false;
        this.toastService.success(
          this.translateService.instant(this.createMode ? 'codeSystems.form.createdSuccess' : 'codeSystems.form.updatedSuccess')
        );

        if (this.createMode && saved.id) {
          this.router.navigate(['/code-systems', saved.id]);
          return;
        }

        this.breadcrumbs = [
          { label: 'menu.codeSystems', route: '/code-systems' },
          { label: saved.title || 'codeSystems.form.editTitle' }
        ];
      },
      error: (error: unknown) => {
        this.error = this.formatError(error);
        this.saving = false;
      }
    });
  }

  private loadCodeSystem(id: string): void {
    this.loading = true;
    this.error = '';

    this.codeSystemService.getCodeSystem(id).subscribe({
      next: (detail) => {
        this.loading = false;
        this.resetForm(detail);
        this.breadcrumbs = [
          { label: 'menu.codeSystems', route: '/code-systems' },
          { label: detail.title || 'codeSystems.form.editTitle' }
        ];
      },
      error: (error: unknown) => {
        this.loading = false;
        this.error = this.formatError(error);
      }
    });
  }

  private resetForm(detail?: CodeSystemDetail): void {
    this.form.reset({ url: detail?.url || '' });

    while (this.values.length > 0) {
      this.values.removeAt(0);
    }

    if (detail?.concepts?.length) {
      for (const concept of detail.concepts) {
        this.values.push(this.fb.group({
          code: [concept.code || '', Validators.required],
          display: [concept.display || '', Validators.required]
        }));
      }
      return;
    }

    this.addValue();
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
