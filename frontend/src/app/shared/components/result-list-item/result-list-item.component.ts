import { CommonModule } from '@angular/common';
import { Component, EventEmitter, Input, Output } from '@angular/core';

@Component({
  selector: 'app-result-list-item',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './result-list-item.component.html',
  styleUrl: './result-list-item.component.scss'
})
export class ResultListItemComponent {
  @Input() clickable = true;
  @Input() active = false;
  @Input() disabled = false;

  @Output() rowClick = new EventEmitter<MouseEvent>();

  onClick(event: MouseEvent): void {
    if (this.disabled) {
      event.preventDefault();
      return;
    }
    this.rowClick.emit(event);
  }
}
