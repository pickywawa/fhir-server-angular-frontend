import { CommonModule } from '@angular/common';
import { Component, OnInit } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { BubbleCardComponent } from '../../../shared/components/bubble-card/bubble-card.component';
import { ModuleShellComponent } from '../../../shared/components/module-shell/module-shell.component';
import {
  CareActionSummary,
  CareGoalSummary,
  CarePlanSummary,
  CarePlansTab
} from '../models/care-plan-admin.model';
import { FhirCarePlansAdminService } from '../services/fhir-care-plans-admin.service';

@Component({
  selector: 'app-care-plans-page',
  standalone: true,
  imports: [CommonModule, ModuleShellComponent, BubbleCardComponent, TranslateModule],
  templateUrl: './care-plans-page.component.html',
  styleUrl: './care-plans-page.component.scss'
})
export class CarePlansPageComponent implements OnInit {
  readonly breadcrumbs = [{ label: 'menu.carePlans' }];

  readonly tabs: Array<{ key: CarePlansTab; labelKey: string }> = [
    { key: 'plans', labelKey: 'carePlans.tabs.plans' },
    { key: 'actions', labelKey: 'carePlans.tabs.actions' },
    { key: 'objectives', labelKey: 'carePlans.tabs.objectives' }
  ];

  activeTab: CarePlansTab = 'plans';
  loading = false;
  error = '';

  plans: CarePlanSummary[] = [];
  actions: CareActionSummary[] = [];
  goals: CareGoalSummary[] = [];

  constructor(
    private readonly route: ActivatedRoute,
    private readonly router: Router,
    private readonly service: FhirCarePlansAdminService,
    private readonly translateService: TranslateService
  ) {}

  ngOnInit(): void {
    this.route.queryParamMap.subscribe((params) => {
      const rawTab = String(params.get('tab') || '').trim();
      this.activeTab = this.isValidTab(rawTab) ? rawTab : 'plans';
      this.loadCurrentTab();
    });
  }

  setTab(tab: CarePlansTab): void {
    if (tab === this.activeTab) {
      return;
    }

    this.router.navigate(['/care-plans'], {
      queryParams: { tab },
      queryParamsHandling: 'merge'
    });
  }

  addCurrent(): void {
    if (this.activeTab === 'plans') {
      this.router.navigate(['/care-plans/plans/new']);
      return;
    }

    if (this.activeTab === 'actions') {
      this.router.navigate(['/care-plans/actions/new']);
      return;
    }

    this.router.navigate(['/care-plans/goals/new']);
  }

  openPlan(plan: CarePlanSummary): void {
    this.router.navigate(['/care-plans/plans', plan.id]);
  }

  openAction(action: CareActionSummary): void {
    this.router.navigate(['/care-plans/actions', action.id]);
  }

  openGoal(goal: CareGoalSummary): void {
    this.router.navigate(['/care-plans/goals', goal.id]);
  }

  private loadCurrentTab(): void {
    this.loading = true;
    this.error = '';

    if (this.activeTab === 'plans') {
      this.service.listPlans().subscribe({
        next: (plans) => {
          this.plans = plans;
          this.loading = false;
        },
        error: (error: unknown) => {
          this.error = this.formatError(error);
          this.loading = false;
        }
      });
      return;
    }

    if (this.activeTab === 'actions') {
      this.service.listActions().subscribe({
        next: (actions) => {
          this.actions = actions;
          this.loading = false;
        },
        error: (error: unknown) => {
          this.error = this.formatError(error);
          this.loading = false;
        }
      });
      return;
    }

    this.service.listGoals().subscribe({
      next: (goals) => {
        this.goals = goals;
        this.loading = false;
      },
      error: (error: unknown) => {
        this.error = this.formatError(error);
        this.loading = false;
      }
    });
  }

  private isValidTab(value: string): value is CarePlansTab {
    return value === 'plans' || value === 'actions' || value === 'objectives';
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
