import { CommonModule } from '@angular/common';
import { Component } from '@angular/core';
import { TranslateModule } from '@ngx-translate/core';
import { ModuleShellComponent } from '../../../shared/components/module-shell/module-shell.component';
import { PatientDiscussionsComponent } from '../../my-patients/features/discussions/components/patient-discussions.component';

@Component({
  selector: 'app-discussions-page',
  standalone: true,
  imports: [CommonModule, TranslateModule, ModuleShellComponent, PatientDiscussionsComponent],
  templateUrl: './discussions-page.component.html',
  styleUrl: './discussions-page.component.scss'
})
export class DiscussionsPageComponent {
  readonly breadcrumbs = [{ label: 'myPatients.discussions.title' }];
}
