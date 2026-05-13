import { Component, EventEmitter, Input, Output } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Patient } from '../../../../../core/models/patient.model';
import { CareTeamComponent } from '../../care-team/components/care-team.component';
import { PatientCarePlanComponent } from '../../careplan/components/patient-careplan.component';
import { RelatedPersonComponent } from '../../related-person/components/related-person.component';
import { PatientTimelineComponent } from '../../timeline/components/patient-timeline.component';

@Component({
  selector: 'app-patient-overview',
  standalone: true,
  imports: [CommonModule, CareTeamComponent, RelatedPersonComponent, PatientCarePlanComponent, PatientTimelineComponent],
  templateUrl: './patient-overview.component.html',
  styleUrl: './patient-overview.component.scss'
})
export class PatientOverviewComponent {
  @Input({ required: true }) patient!: Patient;
  @Input() loading = false;

  @Output() saveIdentity = new EventEmitter<Patient>();

  onSaveIdentity(updatedPatient: Patient): void {
    this.saveIdentity.emit(updatedPatient);
  }
}
