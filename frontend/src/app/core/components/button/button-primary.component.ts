import { Component, Input, Output, EventEmitter } from '@angular/core';

@Component({
  selector: 'app-button-primary',
  standalone: true,
  template: `
    <button
      [type]="type"
      class="btn btn-primary"
      [disabled]="disabled"
      (click)="onClick($event)"
    >
      <ng-content></ng-content>
    </button>
  `,
  styles: [`
    .btn.btn-primary {
      display: flex;
      align-items: center;
      gap: 0.5rem;
      padding: 0.5rem 0.75rem;
      background: var(--btn-primary-bg, #0f172a);
      color: var(--btn-primary-text, #ffffff);
      border: 1px solid var(--btn-primary-bg, #0f172a);
      border-radius: 6px;
      font-size: 0.85rem;
      font-weight: 600;
      cursor: pointer;
      transition: all 0.2s ease;
      white-space: nowrap;
      font-family: inherit;

      &:hover:not(:disabled) {
        background: var(--btn-primary-bg-hover, #1e293b);
        border-color: var(--btn-primary-bg-hover, #1e293b);
        transform: translateY(-1px);
        box-shadow: 0 4px 12px rgba(15, 23, 42, 0.22);
      }

      &:active:not(:disabled) {
        transform: translateY(0);
      }

      &:disabled {
        opacity: 0.6;
        cursor: not-allowed;
      }

      svg {
        width: 18px;
        height: 18px;
      }
    }
  `]
})
export class ButtonPrimaryComponent {
  @Input() type: 'button' | 'submit' | 'reset' = 'button';
  @Input() disabled = false;
  @Output() click = new EventEmitter<void>();

  onClick(event: MouseEvent): void {
    event.stopPropagation();
    this.click.emit();
  }
}
