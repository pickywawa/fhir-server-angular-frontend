import { Component, EventEmitter, Input, OnChanges, OnDestroy, Output, SimpleChanges } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormArray, FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { TranslateModule } from '@ngx-translate/core';
import { Subject, debounceTime, distinctUntilChanged, map, of, switchMap, takeUntil } from 'rxjs';
import { FhirOrganizationService } from '../services/fhir-organization.service';
import { FormControlFieldComponent } from '../../../shared/components/form-control-field/form-control-field.component';
import { OrganizationOption, OrganizationProfile, OrganizationTypeOption } from '../models/organization.model';

interface OrganizationFormValue {
  name: string;
  identifier: string;
  active: boolean;
  typeCode: string;
  typeDisplay: string;
  description: string;
  alias: string;
  phone: string;
  email: string;
  line1: string;
  line2: string;
  postalCode: string;
  city: string;
  country: string;
}

@Component({
  selector: 'app-organization-form',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, TranslateModule, FormControlFieldComponent],
  templateUrl: './organization-form.component.html',
  styleUrl: './organization-form.component.scss'
})
export class OrganizationFormComponent implements OnChanges, OnDestroy {
  @Input() profile: OrganizationProfile | null = null;
  @Input() typeOptions: OrganizationTypeOption[] = [];
  @Input() editable = false;
  @Input() isCreate = false;

  @Output() save = new EventEmitter<OrganizationProfile>();
  @Output() cancel = new EventEmitter<void>();

  readonly form: FormGroup;
  parentQuery = '';
  parentSearchResults: OrganizationOption[] = [];
  selectedParent: OrganizationOption | null = null;

  private readonly parentSearch$ = new Subject<string>();
  private readonly destroy$ = new Subject<void>();

  constructor(
    private readonly fb: FormBuilder,
    private readonly organizationService: FhirOrganizationService
  ) {
    this.form = this.fb.group({
      active: [true],
      name: ['', [Validators.required, Validators.maxLength(200)]],
      identifier: [''],
      typeCode: [''],
      typeDisplay: [''],
      description: [''],
      aliases: this.fb.array([]),
      phone: [''],
      email: [''],
      line1: [''],
      line2: [''],
      postalCode: [''],
      city: [''],
      country: ['FR']
    });

    this.form.get('typeCode')?.valueChanges
      .pipe(takeUntil(this.destroy$))
      .subscribe(() => this.onTypeChange());

    this.parentSearch$
      .pipe(
        debounceTime(250),
        distinctUntilChanged(),
        map((query) => query.trim()),
        switchMap((query) => query.length >= 2 ? this.organizationService.searchOrganizationOptions(query, 12) : of([])),
        takeUntil(this.destroy$)
      )
      .subscribe((results) => {
        this.parentSearchResults = results
          .filter((option) => option.reference !== `Organization/${this.profile?.id || ''}`)
          .filter((option) => option.reference !== this.selectedParent?.reference);
      });
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['profile'] || changes['isCreate']) {
      this.patchFormFromProfile();
    }

    if (changes['editable'] || changes['isCreate']) {
      if (this.editable || this.isCreate) {
        this.form.enable({ emitEvent: false });
      } else {
        this.form.disable({ emitEvent: false });
      }
    }
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  get aliasesArray(): FormArray {
    return this.form.get('aliases') as FormArray;
  }

  addAlias(): void {
    this.aliasesArray.push(this.fb.control(''));
  }

  removeAlias(index: number): void {
    this.aliasesArray.removeAt(index);
  }

  onParentQueryChanged(value: string): void {
    this.parentQuery = value;
    this.parentSearch$.next(value);
  }

  selectParent(option: OrganizationOption): void {
    this.selectedParent = option;
    this.parentQuery = '';
    this.parentSearchResults = [];
  }

  clearParent(): void {
    this.selectedParent = null;
    this.parentQuery = '';
    this.parentSearchResults = [];
  }

  onTypeChange(): void {
    const selectedCode = String(this.form.get('typeCode')?.value || '');
    if (!selectedCode) {
      this.form.patchValue({ typeDisplay: '' }, { emitEvent: false });
      return;
    }

    const selected = this.typeOptions.find((option) => option.code === selectedCode);
    if (selected) {
      this.form.patchValue({ typeDisplay: selected.display }, { emitEvent: false });
    }
  }

  submit(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    const baseProfile = this.profile || this.createEmptyProfile();
    const value = this.form.getRawValue() as OrganizationFormValue;

    const nextProfile: OrganizationProfile = {
      ...baseProfile,
      active: value.active,
      name: value.name,
      identifier: value.identifier || '',
      typeCode: value.typeCode || '',
      typeDisplay: value.typeDisplay || '',
      description: value.description || '',
      aliases: this.aliasesArray.controls
        .map((control) => String(control.value || '').trim())
        .filter((alias) => alias.length > 0),
      contacts: [
        {
          system: 'phone' as const,
          value: value.phone || ''
        },
        {
          system: 'email' as const,
          value: value.email || ''
        }
      ].filter((contact) => contact.value.trim().length > 0),
      address: {
        lines: [value.line1, value.line2].filter((line) => String(line || '').trim().length > 0),
        postalCode: value.postalCode || undefined,
        city: value.city || undefined,
        country: value.country || undefined
      },
      parentReference: this.selectedParent?.reference,
      parentDisplay: this.selectedParent?.label
    };

    this.save.emit(nextProfile);
  }

  private patchFormFromProfile(): void {
    const source = this.profile || this.createEmptyProfile();

    while (this.aliasesArray.length) {
      this.aliasesArray.removeAt(0);
    }

    (source.aliases || []).forEach((alias: string) => this.aliasesArray.push(this.fb.control(alias)));
    if (this.aliasesArray.length === 0 && this.isCreate) {
      this.aliasesArray.push(this.fb.control(''));
    }

    const phone = source.contacts?.find((contact) => contact.system === 'phone')?.value || '';
    const email = source.contacts?.find((contact) => contact.system === 'email')?.value || '';

    this.selectedParent = source.parentReference
      ? {
        id: this.extractIdFromReference(source.parentReference),
        reference: source.parentReference,
        label: source.parentDisplay || source.parentReference
      }
      : null;
    this.parentQuery = '';
    this.parentSearchResults = [];

    this.form.patchValue({
      active: source.active,
      name: source.name,
      identifier: source.identifier || '',
      typeCode: source.typeCode || '',
      typeDisplay: source.typeDisplay || '',
      description: source.description || '',
      phone,
      email,
      line1: source.address?.lines?.[0] || '',
      line2: source.address?.lines?.[1] || '',
      postalCode: source.address?.postalCode || '',
      city: source.address?.city || '',
      country: source.address?.country || 'FR'
    }, { emitEvent: false });
  }

  private extractIdFromReference(reference: string): string {
    const value = String(reference || '').trim();
    return value.startsWith('Organization/') ? value.slice('Organization/'.length) : value;
  }

  private createEmptyProfile(): OrganizationProfile {
    return {
      id: '',
      identifier: '',
      active: true,
      typeCode: '',
      typeDisplay: '',
      name: '',
      description: '',
      aliases: [],
      contacts: [],
      address: {
        lines: [],
        country: 'FR'
      }
    };
  }
}
