import { CommonModule } from '@angular/common';
import { Component, Input, forwardRef } from '@angular/core';
import { ControlValueAccessor, NG_VALUE_ACCESSOR } from '@angular/forms';

export interface FormControlFieldOption {
  value: string;
  label: string;
}

@Component({
  selector: 'app-form-control-field',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './form-control-field.component.html',
  styleUrl: './form-control-field.component.scss',
  providers: [
    {
      provide: NG_VALUE_ACCESSOR,
      useExisting: forwardRef(() => FormControlFieldComponent),
      multi: true
    }
  ]
})
export class FormControlFieldComponent implements ControlValueAccessor {
  @Input() label = '';
  @Input() forId = '';
  @Input() kind: 'input' | 'select' | 'textarea' = 'input';
  @Input() type = 'text';
  @Input() placeholder = '';
  @Input() rows = 3;
  @Input() options: FormControlFieldOption[] = [];
  @Input() uiDisabled = false;

  value: string = '';
  controlDisabled = false;

  private onChange: (value: string) => void = () => {};
  private onTouched: () => void = () => {};

  get isDisabled(): boolean {
    return this.uiDisabled || this.controlDisabled;
  }

  writeValue(value: unknown): void {
    this.value = value == null ? '' : String(value);
  }

  registerOnChange(fn: (value: string) => void): void {
    this.onChange = fn;
  }

  registerOnTouched(fn: () => void): void {
    this.onTouched = fn;
  }

  setDisabledState(isDisabled: boolean): void {
    this.controlDisabled = isDisabled;
  }

  onValueChange(value: string): void {
    this.value = value;
    this.onChange(value);
  }

  markTouched(): void {
    this.onTouched();
  }
}
