import { Component, EventEmitter, Inject, OnInit, OnDestroy, Output, inject } from '@angular/core';

import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { catchError, debounceTime, distinctUntilChanged, forkJoin, of, Subject, takeUntil } from 'rxjs';
import { ButtonPrimaryComponent } from '../../../core/components/button/button-primary.component';
import { FhirPractitionerService } from '../../../features/practitioners/services/fhir-practitioner.service';
import { CareTeamMemberInput, PARTICIPANT_ROLES, PractitionerOption } from './add-care-team-member-dialog.model';

@Component({
  selector: 'app-add-care-team-member-dialog',
  standalone: true,
  imports: [ReactiveFormsModule, ButtonPrimaryComponent],
  templateUrl: './add-care-team-member-dialog.component.html',
  styleUrl: './add-care-team-member-dialog.component.scss'
})
export class AddCareTeamMemberDialogComponent implements OnInit, OnDestroy {
  @Output() save = new EventEmitter<CareTeamMemberInput>();
  @Output() cancel = new EventEmitter<void>();

  private readonly fb = inject(FormBuilder);
  private readonly practitionerService = inject(FhirPractitionerService);
  private readonly destroy$ = new Subject<void>();
  private readonly searchTrigger$ = new Subject<string>();

  form: FormGroup;
  participantRoles = PARTICIPANT_ROLES;
  practitioners: PractitionerOption[] = [];
  filteredPractitioners: PractitionerOption[] = [];
  searchLoading = false;
  searchError = '';
  showDropdown = false;
  selectedPractitioner: PractitionerOption | null = null;
  private selectingFromDropdown = false;

  constructor() {
    this.form = this.fb.group({
      search: ['', Validators.required],
      role: ['doctor', Validators.required]
    });
  }

  ngOnInit(): void {
    this.searchTrigger$
      .pipe(
        debounceTime(300),
        distinctUntilChanged(),
        takeUntil(this.destroy$)
      )
      .subscribe((search) => {
        this.performSearch(search);
      });

    this.form.get('search')?.valueChanges
      .pipe(takeUntil(this.destroy$))
      .subscribe((value) => {
        if (this.selectingFromDropdown) {
          return;
        }

        if (this.selectedPractitioner && value !== this.selectedPractitioner.displayName) {
          this.selectedPractitioner = null;
        }

        if (value && value.trim().length >= 2) {
          this.searchTrigger$.next(value.trim());
        } else {
          this.filteredPractitioners = [];
          this.showDropdown = false;
        }
      });
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  private performSearch(search: string): void {
    this.searchLoading = true;
    this.searchError = '';

    const parts = search.trim().split(/\s+/).filter((p) => p.length > 0);
    const first = parts[0] || '';
    const last = parts[parts.length - 1] || '';

    const requests = [
      this.practitionerService.searchPractitioners({ family: first, limit: 20 }),
      this.practitionerService.searchPractitioners({ given: first, limit: 20 })
    ];

    if (parts.length >= 2) {
      requests.push(this.practitionerService.searchPractitioners({ given: first, family: last, limit: 20 }));
      requests.push(this.practitionerService.searchPractitioners({ given: last, family: first, limit: 20 }));
    }

    forkJoin(requests.map((request) => request.pipe(catchError(() => of([])))))
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (resultSets) => {
          const merged = resultSets.flat();
          const byId = new Map<string, PractitionerOption>();

          merged
            .filter((p) => p?.id)
            .forEach((p) => {
              const id = p.id || '';
              if (!id || byId.has(id)) {
                return;
              }

              const displayName = `${p.firstName || ''} ${p.lastName || ''}`.trim() || id;
              byId.set(id, {
                id,
                firstName: p.firstName || '',
                lastName: p.lastName || '',
                displayName
              });
            });

          this.filteredPractitioners = Array.from(byId.values());
          this.showDropdown = this.filteredPractitioners.length > 0;
          this.searchLoading = false;
        },
        error: () => {
          this.searchError = 'Erreur lors de la recherche des intervenants';
          this.searchLoading = false;
        }
      });
  }

  selectPractitioner(practitioner: PractitionerOption): void {
    this.selectingFromDropdown = true;
    this.selectedPractitioner = practitioner;
    this.form.patchValue(
      {
        search: practitioner.displayName
      },
      { emitEvent: false }
    );
    this.showDropdown = false;
    setTimeout(() => {
      this.selectingFromDropdown = false;
    }, 0);
  }

  getSelectedRoleDisplay(): string {
    const roleCode = this.form.get('role')?.value || 'doctor';
    return PARTICIPANT_ROLES.find((r) => r.code === roleCode)?.display || roleCode;
  }

  get showNoPractitionerFound(): boolean {
    const searchValue = String(this.form.get('search')?.value ?? '').trim();
    return !this.searchLoading
      && !this.searchError
      && !this.selectedPractitioner
      && searchValue.length >= 2
      && this.filteredPractitioners.length === 0;
  }

  submit(): void {
    if (this.form.invalid || !this.selectedPractitioner) {
      return;
    }

    const roleCode = this.form.get('role')?.value || 'doctor';
    const roleOption = PARTICIPANT_ROLES.find((r) => r.code === roleCode);

    const result: CareTeamMemberInput = {
      practitionerId: this.selectedPractitioner.id,
      practitionerName: this.selectedPractitioner.displayName,
      role: roleCode,
      roleDisplay: roleOption?.display || roleCode
    };

    this.save.emit(result);
  }

  cancelDialog(): void {
    this.cancel.emit();
  }
}
