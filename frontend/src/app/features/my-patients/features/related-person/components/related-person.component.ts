import { Component, Input, OnChanges, OnDestroy, SimpleChanges } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Subject, catchError, debounceTime, distinctUntilChanged, of, switchMap, takeUntil } from 'rxjs';
import { BubbleCardComponent } from '../../../../../shared/components/bubble-card/bubble-card.component';
import { ButtonPrimaryComponent } from '../../../../../core/components/button/button-primary.component';
import { ModalComponent } from '../../../../../core/components/modal/modal.component';
import { FormControlFieldOption, FormControlFieldComponent } from '../../../../../shared/components/form-control-field/form-control-field.component';
import { BanAddressService, BanAddressSuggestion } from '../../../../../core/services/ban-address.service';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { CreateRelatedPersonInput, RELATED_PERSON_RELATIONSHIP_OPTIONS, RelatedPersonProfile } from '../../../models/related-person.model';
import { FhirRelatedPersonService } from '../services/fhir-related-person.service';

@Component({
  selector: 'app-related-persons',
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    TranslateModule,
    BubbleCardComponent,
    ButtonPrimaryComponent,
    ModalComponent,
    FormControlFieldComponent
  ],
  templateUrl: './related-person.component.html',
  styleUrl: './related-person.component.scss'
})
export class RelatedPersonComponent implements OnChanges, OnDestroy {
  @Input() patientId?: string;

  readonly relationshipOptions: FormControlFieldOption[] = RELATED_PERSON_RELATIONSHIP_OPTIONS.map((item) => ({
    value: item.code,
    label: item.display
  }));

  readonly genderOptions: FormControlFieldOption[] = [
    { value: 'female', label: 'Femme' },
    { value: 'male', label: 'Homme' },
    { value: 'other', label: 'Autre' },
    { value: 'unknown', label: 'Inconnu' }
  ];

  readonly form;

  members: RelatedPersonProfile[] = [];
  loading = false;
  saving = false;
  deleting = false;
  error = '';
  showFormDialog = false;
  showDeleteDialog = false;
  selectedMember: RelatedPersonProfile | null = null;
  activeMemberId: string | null = null;
  createMode = true;
  editMode = true;

  addressSuggestions: BanAddressSuggestion[] = [];

  private selectedAddressMeta: { city?: string; postcode?: string } | null = null;
  private readonly addressSearch$ = new Subject<string>();
  private readonly destroy$ = new Subject<void>();

  constructor(
    private readonly fb: FormBuilder,
    private readonly relatedPersonService: FhirRelatedPersonService,
    private readonly banAddressService: BanAddressService,
    private readonly translateService: TranslateService
  ) {
    this.form = this.fb.group({
      name: ['', Validators.required],
      roleCode: [this.relationshipOptions[0]?.value || '', Validators.required],
      phone: [''],
      email: ['', Validators.email],
      gender: ['', Validators.required],
      birthDate: ['', Validators.required],
      address: ['', Validators.required],
      language: ['']
    });

    this.addressSearch$
      .pipe(
        debounceTime(250),
        distinctUntilChanged(),
        switchMap((query) => {
          const normalizedQuery = query.trim();
          if (normalizedQuery.length < 3) {
            return of([] as BanAddressSuggestion[]);
          }
          return this.banAddressService.searchAddresses(normalizedQuery).pipe(
            catchError(() => of([] as BanAddressSuggestion[]))
          );
        }),
        takeUntil(this.destroy$)
      )
      .subscribe((results) => {
        this.addressSuggestions = results;
      });
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['patientId']) {
      this.loadRelatedPersons();
    }
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  openAddDialog(): void {
    this.showFormDialog = true;
    this.createMode = true;
    this.editMode = true;
    this.activeMemberId = null;
    this.error = '';
    this.resetForm();
  }

  openMemberDialog(member: RelatedPersonProfile): void {
    this.showFormDialog = true;
    this.createMode = false;
    this.editMode = false;
    this.activeMemberId = member.id;
    this.error = '';
    this.patchForm(member);
  }

  enableEditMode(): void {
    this.editMode = true;
    this.error = '';
  }

  closeFormDialog(): void {
    this.showFormDialog = false;
    this.saving = false;
    this.addressSuggestions = [];
    this.selectedAddressMeta = null;
    this.activeMemberId = null;
    this.createMode = true;
    this.editMode = true;
    this.resetForm();
  }

  cancelForm(): void {
    if (this.createMode) {
      this.closeFormDialog();
      return;
    }

    if (this.editMode) {
      const current = this.members.find((item) => item.id === this.activeMemberId);
      if (current) {
        this.patchForm(current);
      }
      this.editMode = false;
      this.error = '';
      return;
    }

    this.closeFormDialog();
  }

  onAddressChange(value: string): void {
    this.selectedAddressMeta = null;
    this.addressSearch$.next(value);
  }

  selectAddress(suggestion: BanAddressSuggestion): void {
    this.form.patchValue({ address: suggestion.label });
    this.selectedAddressMeta = {
      city: suggestion.city,
      postcode: suggestion.postcode
    };
    this.addressSuggestions = [];
  }

  submit(): void {
    if (!this.patientId) {
      this.error = this.translateService.instant('myPatients.relatedPerson.errors.patientNotFound');
      return;
    }

    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    const rawValue = this.form.getRawValue();
    const roleCode = String(rawValue.roleCode || '');
    const roleOption = RELATED_PERSON_RELATIONSHIP_OPTIONS.find((item) => item.code === roleCode);

    if (!roleOption) {
      this.error = this.translateService.instant('myPatients.relatedPerson.errors.roleInvalid');
      return;
    }

    const payload: CreateRelatedPersonInput = {
      name: String(rawValue.name || '').trim(),
      roleCode,
      roleDisplay: roleOption.display,
      phone: String(rawValue.phone || '').trim() || undefined,
      email: String(rawValue.email || '').trim() || undefined,
      gender: String(rawValue.gender || '').trim(),
      birthDate: String(rawValue.birthDate || '').trim(),
      address: String(rawValue.address || '').trim(),
      city: this.selectedAddressMeta?.city,
      postalCode: this.selectedAddressMeta?.postcode,
      language: String(rawValue.language || '').trim() || undefined
    };

    this.saving = true;
    this.error = '';

    if (this.createMode) {
      this.relatedPersonService.createRelatedPerson(this.patientId, payload).subscribe({
        next: (created) => {
          this.members = [created, ...this.members];
          this.closeFormDialog();
        },
        error: (error: unknown) => {
          this.error = this.formatError(error);
          this.saving = false;
        }
      });
      return;
    }

    if (!this.activeMemberId) {
      this.error = this.translateService.instant('myPatients.relatedPerson.errors.memberNotFound');
      this.saving = false;
      return;
    }

    this.relatedPersonService.updateRelatedPerson(this.activeMemberId, this.patientId, payload).subscribe({
      next: (updated) => {
        this.members = this.members.map((item) => item.id === updated.id ? updated : item);
        this.closeFormDialog();
      },
      error: (error: unknown) => {
        this.error = this.formatError(error);
        this.saving = false;
      }
    });
  }

  confirmDelete(member: RelatedPersonProfile): void {
    this.selectedMember = member;
    this.showDeleteDialog = true;
  }

  closeDeleteDialog(): void {
    this.showDeleteDialog = false;
    this.deleting = false;
    this.selectedMember = null;
  }

  removeMember(): void {
    if (!this.selectedMember) {
      return;
    }

    this.deleting = true;
    this.error = '';

    this.relatedPersonService.deleteRelatedPerson(this.selectedMember.id).subscribe({
      next: () => {
        const removedId = this.selectedMember?.id;
        this.members = this.members.filter((item) => item.id !== removedId);
        this.closeDeleteDialog();
      },
      error: (error: unknown) => {
        this.error = this.formatError(error);
        this.deleting = false;
      }
    });
  }

  private loadRelatedPersons(): void {
    if (!this.patientId) {
      this.members = [];
      return;
    }

    this.loading = true;
    this.error = '';

    this.relatedPersonService.listByPatient(this.patientId).subscribe({
      next: (items) => {
        this.members = items;
        this.loading = false;
      },
      error: (error: unknown) => {
        this.error = this.formatError(error);
        this.loading = false;
      }
    });
  }

  private resetForm(): void {
    this.form.reset({
      name: '',
      roleCode: this.relationshipOptions[0]?.value || '',
      phone: '',
      email: '',
      gender: '',
      birthDate: '',
      address: '',
      language: ''
    });
  }

  private patchForm(member: RelatedPersonProfile): void {
    this.form.reset({
      name: member.name || '',
      roleCode: member.roleCode || this.relationshipOptions[0]?.value || '',
      phone: member.phone || '',
      email: member.email || '',
      gender: member.gender || '',
      birthDate: member.birthDate || '',
      address: member.address || '',
      language: member.language || ''
    });
    this.selectedAddressMeta = null;
    this.addressSuggestions = [];
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
    return this.translateService.instant('myPatients.relatedPerson.errors.load');
  }
}
