import {
  Component,
  Input,
  inject,
  OnChanges,
  SimpleChanges
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { TranslateModule } from '@ngx-translate/core';
import { environment } from '../../../../../../environments/environment';
import { VisioFloatingService } from '../../../../../core/services/visio-floating.service';

@Component({
  selector: 'app-patient-visio',
  standalone: true,
  imports: [CommonModule, TranslateModule],
  templateUrl: './patient-visio.component.html',
  styleUrl: './patient-visio.component.scss'
})
export class PatientVisioComponent implements OnChanges {
  @Input() patientId?: string;

  readonly jitsiDomain = environment.jitsiDomain;

  get jitsiBaseUrl(): string {
    return `https://${this.jitsiDomain}`;
  }

  error = '';

  private readonly floatingVisio = inject(VisioFloatingService);

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['patientId'] && !changes['patientId'].currentValue) {
      this.error = '';
    }
  }

  get roomName(): string {
    const sanitized = String(this.patientId || 'unknown').replace(/[^a-zA-Z0-9]/g, '');
    return `patient-${sanitized}`;
  }

  joinCall(): void {
    if (!this.patientId) {
      return;
    }
    this.error = '';
    this.floatingVisio.open(this.roomName);
  }

  get hasFloatingSession(): boolean {
    return this.floatingVisio.isOpen() && this.floatingVisio.roomName() === this.roomName;
  }
}
