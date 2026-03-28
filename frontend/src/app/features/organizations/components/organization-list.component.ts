import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, ReactiveFormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { ModuleShellComponent } from '../../../shared/components/module-shell/module-shell.component';
import { BubbleCardComponent } from '../../../shared/components/bubble-card/bubble-card.component';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { FhirOrganizationService } from '../services/fhir-organization.service';
import { OrganizationSearchCriteria, OrganizationSummary, OrganizationTypeOption } from '../models/organization.model';

interface OrganizationTreeNode {
  item: OrganizationSummary;
  children: OrganizationTreeNode[];
}

@Component({
  selector: 'app-organization-list',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, ModuleShellComponent, BubbleCardComponent, TranslateModule],
  templateUrl: './organization-list.component.html',
  styleUrl: './organization-list.component.scss'
})
export class OrganizationListComponent implements OnInit {
  readonly breadcrumbs = [{ label: 'menu.organizations' }];

  readonly searchForm;

  loading = false;
  error = '';
  hasSearched = false;
  defaultItems: OrganizationSummary[] = [];
  results: OrganizationSummary[] = [];
  typeOptions: OrganizationTypeOption[] = [];
  treeItems: OrganizationTreeNode[] = [];

  constructor(
    private readonly fb: FormBuilder,
    private readonly organizationService: FhirOrganizationService,
    private readonly router: Router,
    private readonly translateService: TranslateService
  ) {
    this.searchForm = this.fb.group({
      identifier: [''],
      name: [''],
      active: [''],
      typeCode: ['']
    });
  }

  ngOnInit(): void {
    this.loadTypeOptions();
    this.organizationService.ensureBourgogneFrancheComteSeed().subscribe({
      next: () => this.loadDefaultOrganizations(),
      error: () => this.loadDefaultOrganizations()
    });
  }

  search(): void {
    const value = this.searchForm.getRawValue();
    const criteria: OrganizationSearchCriteria = {
      identifier: String(value.identifier || ''),
      name: String(value.name || ''),
      active: (value.active === 'true' || value.active === 'false') ? value.active : '',
      typeCode: String(value.typeCode || ''),
      limit: 100
    };

    this.loading = true;
    this.error = '';
    this.hasSearched = true;

    this.organizationService.searchOrganizations(criteria).subscribe({
      next: (result) => {
        this.results = result;
        this.treeItems = this.buildTree(result);
        this.loading = false;
      },
      error: (error: unknown) => {
        this.error = this.formatError(error);
        this.loading = false;
      }
    });
  }

  resetSearch(): void {
    this.searchForm.reset({ identifier: '', name: '', active: '', typeCode: '' });
    this.hasSearched = false;
    this.results = [];
    this.treeItems = this.buildTree(this.defaultItems);
    this.error = '';
  }

  addOrganization(): void {
    this.router.navigate(['/organizations/new']);
  }

  openOrganization(item: OrganizationSummary): void {
    this.router.navigate(['/organizations', item.id]);
  }

  private loadDefaultOrganizations(): void {
    this.loading = true;
    this.error = '';

    this.organizationService.searchOrganizations({ limit: 100 }).subscribe({
      next: (result) => {
        this.defaultItems = result;
        this.treeItems = this.buildTree(result);
        this.loading = false;
      },
      error: (error: unknown) => {
        this.error = this.formatError(error);
        this.loading = false;
      }
    });
  }

  private loadTypeOptions(): void {
    this.organizationService.getOrganizationTypeOptions().subscribe({
      next: (options) => {
        this.typeOptions = options;
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

  private buildTree(items: OrganizationSummary[]): OrganizationTreeNode[] {
    const nodesById = new Map<string, OrganizationTreeNode>();

    items.forEach((item) => {
      nodesById.set(item.id, { item, children: [] });
    });

    const roots: OrganizationTreeNode[] = [];

    nodesById.forEach((node) => {
      const parentId = node.item.parentId || '';
      const parent = parentId ? nodesById.get(parentId) : undefined;
      if (parent && parent.item.id !== node.item.id) {
        parent.children.push(node);
      } else {
        roots.push(node);
      }
    });

    const sortTree = (nodes: OrganizationTreeNode[]): void => {
      nodes.sort((a, b) => a.item.name.localeCompare(b.item.name, 'fr', { sensitivity: 'base' }));
      nodes.forEach((node) => sortTree(node.children));
    };

    sortTree(roots);
    return roots;
  }
}
