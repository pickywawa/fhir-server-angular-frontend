import { Component, Input } from '@angular/core';


@Component({
  selector: 'app-bubble-card',
  standalone: true,
  imports: [],
  templateUrl: './bubble-card.component.html',
  styleUrl: './bubble-card.component.scss'
})
export class BubbleCardComponent {
  @Input() title = '';
}
