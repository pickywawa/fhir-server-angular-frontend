import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router } from '@angular/router';
import { BubbleCardComponent } from '../../../shared/components/bubble-card/bubble-card.component';
import { ModuleShellComponent } from '../../../shared/components/module-shell/module-shell.component';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { FhirOrganizationService } from '../services/fhir-organization.service';
import { OrganizationFormComponent } from './organization-form.component';
import { OrganizationProfile, OrganizationTypeOption } from '../models/organization.model';

@Component({
  selector: 'app-organization-detail-page',
  standalone: true,
  imports: [CommonModule, ModuleShellComponent, BubbleCardComponent, OrganizationFormComponent, TranslateModule],
  templateUrl: './organization-detail-page.component.html',
  styleUrl: './organization-detail-page.component.scss'
})
export class OrganizationDetailPageComponent implements OnInit {
  profile: OrganizationProfile | null = null;
  typeOptions: OrganizationTypeOption[] = [];
  loading = true;
  saving = false;
  error = '';
  editMode = false;
  isCreate = false;

  breadcrumbs = [{ label: 'menu.organizations', link: '/organizations' }, { label: 'organizations.detail.title' }];

  constructor(
    private readonly route: ActivatedRoute,
    private readonly router: Router,
    private readonly organizationService: FhirOrganizationService,
    private readonly translateService: TranslateService
  ) {}

  ngOnInit(): void {
    const id = this.route.snapshot.paramMap.get('id');
    this.isCreate = id === 'new';

    this.organizationService.getOrganizationTypeOptions().subscribe({
      next: (options) => (this.typeOptions = options)
    });

    if (this.isCreate) {
      this.profile = {
        id: '',
        identifier: '',
        active: true,
        typeCode: '',
        typeDisplay: '',
        name: '',
        description: '',
        aliases: [],
        contacts: [],
        address: {
          lines: [],
          country: 'FR'
        }
      };
      this.loading = false;
      this.editMode = true;
      this.breadcrumbs = [{ label: 'menu.organizations', link: '/organizations' }, { label: 'organizations.detail.new' }];
      return;
    }

    if (!id) {
      this.router.navigate(['/organizations']);
      return;
    }

    this.organizationService.getOrganization(id).subscribe({
      next: (profile) => {
        this.profile = profile;
        if (profile.parentReference && !profile.parentDisplay) {
          this.organizationService.resolveOrganizationReferenceDisplay(profile.parentReference).subscribe({
            next: (label) => {
              if (!this.profile) {
                return;
              }
              this.profile.parentDisplay = label || this.profile.parentReference;
            }
          });
        }
        this.loading = false;
      },
      error: (error: unknown) => {
        this.error = this.formatError(error);
        this.loading = false;
      }
    });
  }

  enableEdit(): void {
    this.editMode = true;
  }

  cancelEdit(): void {
    if (this.isCreate) {
      this.router.navigate(['/organizations']);
      return;
    }
    this.editMode = false;
  }

  save(profile: OrganizationProfile): void {
    this.saving = true;
    this.error = '';

    const request$ = this.isCreate
      ? this.organizationService.createOrganization(profile)
      : this.organizationService.updateOrganization(profile.id || '', profile);

    request$.subscribe({
      next: (saved) => {
        this.profile = saved;
        this.saving = false;
        this.editMode = false;
        if (this.isCreate && saved.id) {
          this.router.navigate(['/organizations', saved.id]);
          return;
        }
      },
      error: (error: unknown) => {
        this.error = this.formatError(error);
        this.saving = false;
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
    return this.translateService.instant('common.unknownError');
  }
}
