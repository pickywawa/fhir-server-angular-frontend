import { Component, EventEmitter, Input, OnChanges, Output, SimpleChanges } from '@angular/core';
import { CommonModule } from '@angular/common';

import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { BubbleCardComponent } from '../../../../../shared/components/bubble-card/bubble-card.component';
import { FormControlFieldComponent } from '../../../../../shared/components/form-control-field/form-control-field.component';
import { PatientProfile } from '../../../models/patient-admin.model';
import { TranslateModule } from '@ngx-translate/core';

@Component({
  selector: 'app-patient-details-form',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, BubbleCardComponent, FormControlFieldComponent, TranslateModule],
  templateUrl: './patient-details-form.component.html',
  styleUrl: './patient-details-form.component.scss'
})
export class PatientDetailsFormComponent implements OnChanges {
  @Input() patient: PatientProfile | null = null;
  @Input() loading = false;
  @Input() createMode = false;
  @Input() titleKey = 'patients.form.title';

  @Output() save = new EventEmitter<PatientProfile>();

  editMode = false;
  readonly form: FormGroup;

  constructor(private readonly fb: FormBuilder) {
    this.form = this.fb.group({
      firstName: ['', Validators.required],
      lastName: ['', Validators.required],
      birthDate: [''],
      gender: ['unknown'],
      email: [''],
      phoneNumber: [''],
      address: [''],
      city: [''],
      postalCode: [''],
      country: ['']
    });
  }

  ngOnChanges(changes: SimpleChanges): void {
    if ((changes['patient'] && this.patient) || changes['createMode']) {
      this.patchForm();
    }

    if (changes['createMode']) {
      this.editMode = this.createMode;
    }

    if (changes['patient'] || changes['createMode']) {
      this.syncFormInteractivity();
    }
  }

  private patchForm(): void {
    if (this.patient) {
      this.form.patchValue({
        firstName: this.patient.firstName || '',
        lastName: this.patient.lastName || '',
        birthDate: this.patient.birthDate || '',
        gender: this.patient.gender || 'unknown',
        email: this.patient.email || '',
        phoneNumber: this.patient.phoneNumber || '',
        address: this.patient.address || '',
        city: this.patient.city || '',
        postalCode: this.patient.postalCode || '',
        country: this.patient.country || ''
      });
    } else {
      this.form.reset({
        gender: 'unknown'
      });
    }
  }

  toggleEdit(): void {
    this.editMode = !this.editMode;
    this.syncFormInteractivity();
  }

  cancelEdit(): void {
    this.editMode = false;
    this.patchForm();
    this.syncFormInteractivity();
  }

  submit(): void {
    if ((!this.editMode && !this.createMode) || this.form.invalid || !this.patient) {
      return;
    }

    const patient: PatientProfile = {
      id: this.patient.id || '',
      ...this.form.getRawValue()
    };
    this.save.emit(patient);
  }

  private syncFormInteractivity(): void {
    if (this.editMode || this.createMode) {
      this.form.enable({ emitEvent: false });
      return;
    }

    this.form.disable({ emitEvent: false });
  }
}
