import { CommonModule } from '@angular/common';
import { Component, OnInit, inject } from '@angular/core';
import { TranslateModule } from '@ngx-translate/core';
import { take } from 'rxjs/operators';
import { ModuleShellComponent } from '../../../shared/components/module-shell/module-shell.component';
import { PatientDiscussionsComponent } from '../../my-patients/features/discussions/components/patient-discussions.component';
import { AuthService } from '../../../core/services/auth.service';
import { ConnectedPractitionerResolverService } from '../../../core/services/connected-practitioner-resolver.service';
import { NotificationService } from '../../../core/services/notification.service';

@Component({
  selector: 'app-discussions-page',
  standalone: true,
  imports: [CommonModule, TranslateModule, ModuleShellComponent, PatientDiscussionsComponent],
  templateUrl: './discussions-page.component.html',
  styleUrl: './discussions-page.component.scss'
})
export class DiscussionsPageComponent implements OnInit {
  private readonly authService = inject(AuthService);
  private readonly practitionerResolver = inject(ConnectedPractitionerResolverService);
  private readonly notificationService = inject(NotificationService);

  readonly breadcrumbs = [{ label: 'myPatients.discussions.title' }];

  ngOnInit(): void {
    const directUserId = String(this.authService.getConnectedPractitionerId() || '').trim();
    if (directUserId) {
      this.acknowledgeDiscussionNotifications(directUserId);
      return;
    }

    this.practitionerResolver.resolveReference()
      .pipe(take(1))
      .subscribe((reference) => {
        const resolvedUserId = this.extractPractitionerId(reference);
        if (resolvedUserId) {
          this.acknowledgeDiscussionNotifications(resolvedUserId);
        }
      });
  }

  private acknowledgeDiscussionNotifications(userId: string): void {
    this.notificationService.acknowledgeUnreadDiscussions(userId)
      .pipe(take(1))
      .subscribe({
        next: () => {
          this.notificationService.loadNotifications();
        },
        error: () => {
          // Best effort on page entry.
        }
      });
  }

  private extractPractitionerId(reference: string): string {
    const value = String(reference || '').trim();
    if (!value) {
      return '';
    }

    const prefix = 'Practitioner/';
    return value.startsWith(prefix) ? value.slice(prefix.length).trim() : value;
  }
}
