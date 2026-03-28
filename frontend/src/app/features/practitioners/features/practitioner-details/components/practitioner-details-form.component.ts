import { Component, EventEmitter, Input, OnChanges, OnDestroy, Output, SimpleChanges } from '@angular/core';

import { FormArray, FormBuilder, FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { Subject, catchError, debounceTime, distinctUntilChanged, map, of, switchMap, takeUntil } from 'rxjs';
import { BubbleCardComponent } from '../../../../../shared/components/bubble-card/bubble-card.component';
import { FormControlFieldComponent } from '../../../../../shared/components/form-control-field/form-control-field.component';
import { BanAddressService, BanAddressSuggestion } from '../../../../../core/services/ban-address.service';
import { PractitionerProfile } from '../../../models/practitioner.model';
import { TranslateModule } from '@ngx-translate/core';

@Component({
  selector: 'app-practitioner-details-form',
  standalone: true,
  imports: [ReactiveFormsModule, BubbleCardComponent, FormControlFieldComponent, TranslateModule],
  templateUrl: './practitioner-details-form.component.html',
  styleUrl: './practitioner-details-form.component.scss'
})
export class PractitionerDetailsFormComponent implements OnChanges, OnDestroy {
  @Input() practitioner: PractitionerProfile | null = null;
  @Input() loading = false;
  @Input() createMode = false;

  @Output() save = new EventEmitter<PractitionerProfile>();

  editMode = false;
  readonly form: FormGroup;
  private readonly phonePattern = /^[+]?[(]?[0-9]{1,4}[)]?[-\s\./0-9]*$/;
  private readonly contactPattern = /^[^:\s]+\s*:\s*.+$/;
  private readonly destroy$ = new Subject<void>();
  private readonly addressSearch$ = new Subject<{ index: number; query: string }>();
  addressSuggestions: Record<number, BanAddressSuggestion[]> = {};
  addressLoadingIndex: number | null = null;

  constructor(
    private readonly fb: FormBuilder,
    private readonly banAddressService: BanAddressService
  ) {
    this.form = this.fb.group({
      mainIdentifier: ['', [Validators.required, Validators.maxLength(64)]],
      firstName: ['', [Validators.required, Validators.maxLength(100)]],
      lastName: ['', [Validators.required, Validators.maxLength(100)]],
      prefix: ['', Validators.maxLength(20)],
      profession: ['', Validators.maxLength(120)],
      specialty: ['', Validators.maxLength(120)],
      specialization: ['', Validators.maxLength(120)],
      emails: this.fb.array([]),
      phones: this.fb.array([]),
      addresses: this.fb.array([]),
      contacts: this.fb.array([])
    });

    this.addressSearch$
      .pipe(
        debounceTime(250),
        distinctUntilChanged((a, b) => a.index === b.index && a.query === b.query),
        switchMap(({ index, query }) => {
          const normalizedQuery = query.trim();
          if (normalizedQuery.length < 3) {
            return of({ index, results: [] as BanAddressSuggestion[] });
          }

          this.addressLoadingIndex = index;
          return this.banAddressService.searchAddresses(normalizedQuery).pipe(
            map((results) => ({ index, results })),
            catchError(() => of({ index, results: [] as BanAddressSuggestion[] }))
          );
        }),
        takeUntil(this.destroy$)
      )
      .subscribe(({ index, results }) => {
        this.addressSuggestions[index] = results;
        this.addressLoadingIndex = null;
      });
  }

  ngOnChanges(changes: SimpleChanges): void {
    if ((changes['practitioner'] && this.practitioner) || changes['createMode']) {
      const source = this.practitioner;
      if (source) {
        this.patchForm(source);
      }
      this.editMode = this.createMode;
      this.applyFormState();
    }
  }

  get emails(): FormArray { return this.form.get('emails') as FormArray; }
  get phones(): FormArray { return this.form.get('phones') as FormArray; }
  get addresses(): FormArray { return this.form.get('addresses') as FormArray; }
  get contacts(): FormArray { return this.form.get('contacts') as FormArray; }

  toggleEdit(): void {
    if (this.createMode) {
      return;
    }
    this.editMode = true;
    this.applyFormState();
  }

  cancelEdit(): void {
    if (this.practitioner) {
      this.patchForm(this.practitioner);
    }
    this.editMode = this.createMode;
    this.applyFormState();
  }

  submit(): void {
    if (!this.editMode || this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    const value = this.form.value;
    const payload: PractitionerProfile = {
      id: this.practitioner?.id,
      mainIdentifier: value.mainIdentifier || '',
      firstName: value.firstName || '',
      lastName: value.lastName || '',
      prefix: value.prefix || '',
      profession: value.profession || '',
      specialty: value.specialty || '',
      specialization: value.specialization || '',
      emails: (value.emails || []).map((entry: string) => entry?.trim()).filter(Boolean),
      phones: (value.phones || []).map((entry: string) => entry?.trim()).filter(Boolean),
      addresses: (value.addresses || []).map((entry: string) => entry?.trim()).filter(Boolean),
      contacts: (value.contacts || []).map((entry: string) => entry?.trim()).filter(Boolean)
    };

    this.save.emit(payload);
  }

  addField(array: FormArray): void {
    if (array === this.emails) {
      array.push(this.createEmailControl(''));
      return;
    }
    if (array === this.phones) {
      array.push(this.createPhoneControl(''));
      return;
    }
    if (array === this.contacts) {
      array.push(this.createContactControl(''));
      return;
    }
    array.push(this.createAddressControl(''));
  }

  removeField(array: FormArray, index: number): void {
    array.removeAt(index);

    if (array === this.addresses) {
      const remapped: Record<number, BanAddressSuggestion[]> = {};
      Object.keys(this.addressSuggestions).forEach((key) => {
        const keyNumber = Number(key);
        if (keyNumber < index) {
          remapped[keyNumber] = this.addressSuggestions[keyNumber];
        } else if (keyNumber > index) {
          remapped[keyNumber - 1] = this.addressSuggestions[keyNumber];
        }
      });
      this.addressSuggestions = remapped;
    }
  }

  onAddressInput(index: number): void {
    const query = String(this.addresses.at(index)?.value ?? '');
    this.addressSearch$.next({ index, query });
  }

  selectAddress(index: number, suggestion: BanAddressSuggestion): void {
    this.addresses.at(index).setValue(suggestion.label);
    this.addressSuggestions[index] = [];
  }

  private patchForm(practitioner: PractitionerProfile): void {
    this.form.patchValue({
      mainIdentifier: practitioner.mainIdentifier,
      firstName: practitioner.firstName,
      lastName: practitioner.lastName,
      prefix: practitioner.prefix,
      profession: practitioner.profession,
      specialty: practitioner.specialty,
      specialization: practitioner.specialization
    });

    this.resetArray(this.emails, practitioner.emails);
    this.resetArray(this.phones, practitioner.phones);
    this.resetArray(this.addresses, practitioner.addresses);
    this.resetArray(this.contacts, practitioner.contacts);
  }

  private resetArray(array: FormArray, values: string[]): void {
    while (array.length) {
      array.removeAt(0);
    }
    const entries = values.length ? values : [''];

    entries.forEach((value) => {
      if (array === this.emails) {
        array.push(this.createEmailControl(value));
        return;
      }
      if (array === this.phones) {
        array.push(this.createPhoneControl(value));
        return;
      }
      if (array === this.contacts) {
        array.push(this.createContactControl(value));
        return;
      }
      array.push(this.createAddressControl(value));
    });

    if (array === this.addresses) {
      this.addressSuggestions = {};
    }
  }

  private createEmailControl(value: string): FormControl {
    return this.fb.control(value, [Validators.email, Validators.maxLength(254)]);
  }

  private createPhoneControl(value: string): FormControl {
    return this.fb.control(value, [Validators.pattern(this.phonePattern), Validators.maxLength(25)]);
  }

  private createAddressControl(value: string): FormControl {
    return this.fb.control(value, Validators.maxLength(255));
  }

  private createContactControl(value: string): FormControl {
    return this.fb.control(value, [Validators.pattern(this.contactPattern), Validators.maxLength(120)]);
  }

  private applyFormState(): void {
    if (this.editMode) {
      this.form.enable({ emitEvent: false });
    } else {
      this.form.disable({ emitEvent: false });
    }
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }
}
