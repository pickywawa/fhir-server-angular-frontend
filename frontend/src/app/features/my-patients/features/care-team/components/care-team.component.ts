import { Component, Input, OnChanges, SimpleChanges, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { BubbleCardComponent } from '../../../../../shared/components/bubble-card/bubble-card.component';
import { ButtonPrimaryComponent } from '../../../../../core/components/button/button-primary.component';
import { CareTeamMember } from '../../../models/care-team.model';
import { FhirCareTeamService } from '../services/fhir-care-team.service';
import { AddCareTeamMemberDialogComponent } from '../../../../../shared/components/add-care-team-member-dialog/add-care-team-member-dialog.component';
import { ToastService } from '../../../../../core/services/toast.service';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { ModalComponent } from '../../../../../core/components/modal/modal.component';

@Component({
  selector: 'app-care-team',
  standalone: true,
  imports: [CommonModule, BubbleCardComponent, ButtonPrimaryComponent, AddCareTeamMemberDialogComponent, TranslateModule, ModalComponent],
  templateUrl: './care-team.component.html',
  styleUrl: './care-team.component.scss'
})
export class CareTeamComponent implements OnChanges {
  @Input() patientId?: string;

  private readonly careTeamService = inject(FhirCareTeamService);
  private readonly toastService = inject(ToastService);
  private readonly translateService = inject(TranslateService);

  members: CareTeamMember[] = [];
  loading = false;
  error = '';
  showAddDialog = false;
  showDeleteDialog = false;
  deleting = false;
  selectedMember: CareTeamMember | null = null;

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['patientId']) {
      this.loadMembers();
    }
  }

  openAddDialog(): void {
    this.showAddDialog = true;
  }

  closeAddDialog(): void {
    this.showAddDialog = false;
  }

  confirmRemoveMember(member: CareTeamMember): void {
    this.selectedMember = member;
    this.showDeleteDialog = true;
  }

  closeDeleteDialog(): void {
    this.showDeleteDialog = false;
    this.deleting = false;
    this.selectedMember = null;
  }

  removeMember(): void {
    if (!this.selectedMember) {
      return;
    }

    this.deleting = true;
    this.error = '';

    this.careTeamService.removeMemberFromCareTeam(this.selectedMember.id).subscribe({
      next: () => {
        const removedMemberName = this.selectedMember?.name ?? '';
        const removedId = this.selectedMember?.id;
        this.members = this.members.filter((member) => member.id !== removedId);
        this.closeDeleteDialog();
        this.toastService.success(
          this.translateService.instant('myPatients.careTeam.deleteSuccess', { name: removedMemberName })
        );
      },
      error: (error: unknown) => {
        this.error = this.formatError(error);
        this.deleting = false;
      }
    });
  }

  onAddMember(data: any): void {
    if (!this.patientId) return;

    this.careTeamService
      .addMemberToPatientCareTeam(
        this.patientId,
        data.practitionerId,
        data.practitionerName,
        data.role,
        data.roleDisplay
      )
      .subscribe({
        next: (newMember) => {
          this.members = [...this.members, newMember];
          this.showAddDialog = false;
        },
        error: (error: unknown) => {
          this.error = this.formatError(error);
        }
      });
  }

  private loadMembers(): void {
    if (!this.patientId) {
      this.members = [];
      return;
    }

    this.loading = true;
    this.error = '';

    this.careTeamService.getMembersByPatient(this.patientId).subscribe({
      next: (members) => {
        this.members = members;
        this.loading = false;
      },
      error: (error: unknown) => {
        this.error = this.formatError(error);
        this.loading = false;
      }
    });
  }

  private formatError(error: unknown): string {
    if (error instanceof Error) {
      return error.message;
    }
    if (typeof error === 'string') {
      return error;
    }
    if (error && typeof error === 'object' && 'message' in error) {
      return String((error as { message: unknown }).message);
    }
    return this.translateService.instant('myPatients.careTeam.loadError');
  }
}
