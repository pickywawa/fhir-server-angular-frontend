import { Component, OnDestroy, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router } from '@angular/router';
import { Observable, Subject, concatMap, debounceTime, defaultIfEmpty, distinctUntilChanged, forkJoin, from, map, of, switchMap, takeUntil, toArray } from 'rxjs';
import { ModuleShellComponent, ModuleBreadcrumb } from '../../../../../shared/components/module-shell/module-shell.component';
import { FormControlFieldComponent } from '../../../../../shared/components/form-control-field/form-control-field.component';
import { FhirCarePlanService } from '../services/fhir-care-plan.service';
import { FhirAppointmentService } from '../../../../agenda/services/fhir-appointment.service';
import { ResourceOption } from '../../../../agenda/models/agenda-appointment.model';
import { CarePlanCategoryOption } from '../models/patient-care-plan.model';
import { FhirCarePlansAdminService } from '../../../../care-plans/services/fhir-care-plans-admin.service';
import { CarePlanStep, CarePlanSummary, LinkedReferenceOption } from '../../../../care-plans/models/care-plan-admin.model';
import { AddCareTeamMemberDialogComponent } from '../../../../../shared/components/add-care-team-member-dialog/add-care-team-member-dialog.component';
import { CareTeamMemberInput } from '../../../../../shared/components/add-care-team-member-dialog/add-care-team-member-dialog.model';
import { FhirCareTeamService } from '../../care-team/services/fhir-care-team.service';
import { AuthService } from '../../../../../core/services/auth.service';

@Component({
  selector: 'app-create-careplan-page',
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    ModuleShellComponent,
    FormControlFieldComponent,
    AddCareTeamMemberDialogComponent,
  ],
  templateUrl: './create-careplan-page.component.html',
  styleUrl: './create-careplan-page.component.scss'
})
export class CreateCarePlanPageComponent implements OnInit, OnDestroy {
  readonly breadcrumbs: ModuleBreadcrumb[] = [
    { label: 'menu.myPatients', route: '/my-patients' },
    { label: 'carePlans.create.title' }
  ];

  readonly steps = [
    { key: 1, label: 'Informations' },
    { key: 2, label: 'Intervenants' },
    { key: 3, label: 'Objectifs' },
    { key: 4, label: 'Etapes' }
  ];

  readonly statusOptions = [
    { value: 'draft', label: 'Brouillon' },
    { value: 'active', label: 'Actif' },
    { value: 'on-hold', label: 'En pause' },
    { value: 'revoked', label: 'Révoqué' },
    { value: 'completed', label: 'Terminé' },
    { value: 'entered-in-error', label: 'Saisi en erreur' },
    { value: 'unknown', label: 'Inconnu' }
  ];

  readonly intentOptions = [
    { value: 'plan', label: 'Plan' },
    { value: 'proposal', label: 'Proposition' },
    { value: 'order', label: 'Ordre' },
    { value: 'option', label: 'Option' },
    { value: 'directive', label: 'Directive' }
  ];

  currentStep = 1;
  loading = true;
  saving = false;
  error = '';

  form: FormGroup;
  categoryOptions: CarePlanCategoryOption[] = [];

  patientQuery = '';
  patientSearchResults: ResourceOption[] = [];
  selectedPatient: ResourceOption | null = null;

  planDefinitions: CarePlanSummary[] = [];
  selectedPlanDefId = '';

  allGoalOptions: LinkedReferenceOption[] = [];
  goalQuery = '';
  goalResults: LinkedReferenceOption[] = [];
  selectedGoals: LinkedReferenceOption[] = [];

  selectedPlanSteps: CarePlanStep[] = [];
  expandedStepIndex: number | null = null;

  showAddMemberDialog = false;
  pendingMembers: CareTeamMemberInput[] = [];

  get categorySelectOptions(): { value: string; label: string }[] {
    return this.categoryOptions.map(o => ({ value: o.code, label: o.label }));
  }

  private readonly destroy$ = new Subject<void>();
  private readonly patientSearch$ = new Subject<string>();

  constructor(
    private readonly fb: FormBuilder,
    private readonly carePlanService: FhirCarePlanService,
    private readonly appointmentService: FhirAppointmentService,
    private readonly adminService: FhirCarePlansAdminService,
    private readonly careTeamService: FhirCareTeamService,
    private readonly authService: AuthService,
    private readonly router: Router
  ) {
    this.form = this.fb.group({
      categoryCode: ['', Validators.required],
      status: ['draft', Validators.required],
      intent: ['plan', Validators.required],
      title: ['', Validators.required],
      description: [''],
      note: ['']
    });
  }

  ngOnInit(): void {
    this.resetPendingMembersToDefault();

    forkJoin({
      categories: this.carePlanService.getCarePlanCategories(),
      plans: this.adminService.listPlans(),
      goals: this.adminService.getGoalOptions()
    }).subscribe({
      next: ({ categories, plans, goals }) => {
        this.categoryOptions = categories;
        this.form.patchValue({ categoryCode: categories[0]?.code || '' });
        this.planDefinitions = plans;
        this.allGoalOptions = goals;
        this.loading = false;
      },
      error: () => {
        this.loading = false;
      }
    });

    this.patientSearch$
      .pipe(
        debounceTime(250),
        distinctUntilChanged(),
        switchMap((query) => this.appointmentService.searchPatients(query)),
        takeUntil(this.destroy$)
      )
      .subscribe((results) => {
        this.patientSearchResults = results;
      });
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  onPatientQueryChanged(value: string): void {
    this.patientQuery = value;
    if (this.selectedPatient && value.trim() !== this.selectedPatient.label) {
      this.selectedPatient = null;
    }
    if (!value.trim()) {
      this.patientSearchResults = [];
      return;
    }
    this.patientSearch$.next(value);
  }

  selectPatient(option: ResourceOption): void {
    if (this.selectedPatient?.reference && this.selectedPatient.reference !== option.reference) {
      this.pendingMembers = [];
    }
    this.selectedPatient = option;
    this.patientQuery = option.label;
    this.patientSearchResults = [];
  }

  clearSelectedPatient(): void {
    this.selectedPatient = null;
    this.patientQuery = '';
    this.patientSearchResults = [];
    this.resetPendingMembersToDefault();
  }

  openAddMemberDialog(): void {
    this.showAddMemberDialog = true;
  }

  closeAddMemberDialog(): void {
    this.showAddMemberDialog = false;
  }

  onAddMember(member: CareTeamMemberInput): void {
    const nextMembers = [...this.pendingMembers];
    const exists = nextMembers.some((item) => item.practitionerId === member.practitionerId && item.role === member.role);
    if (!exists) {
      nextMembers.push(member);
    }

    this.pendingMembers = nextMembers;
    this.showAddMemberDialog = false;
  }

  removePendingMember(index: number): void {
    this.pendingMembers = this.pendingMembers.filter((_, idx) => idx !== index);
  }

  onPlanDefChange(id: string): void {
    this.selectedPlanDefId = id;
    if (!id) {
      return;
    }
    const plan = this.planDefinitions.find(p => p.id === id);
    if (plan) {
      this.selectedGoals = plan.goalRefs
        .map(ref => this.allGoalOptions.find(g => g.reference === ref))
        .filter((g): g is LinkedReferenceOption => !!g);
      this.selectedPlanSteps = (plan.steps || []).map((step) => ({ ...step }));
      this.expandedStepIndex = null;
    }
  }

  searchGoals(value: string): void {
    this.goalQuery = value;
    const q = value.trim().toLowerCase();
    if (!q) {
      this.goalResults = [];
      return;
    }
    const selected = new Set(this.selectedGoals.map(g => g.reference));
    this.goalResults = this.allGoalOptions.filter(g => !selected.has(g.reference) && g.label.toLowerCase().includes(q));
  }

  addGoal(option: LinkedReferenceOption): void {
    this.selectedGoals = [...this.selectedGoals, option];
    this.goalQuery = '';
    this.goalResults = [];
  }

  removeGoal(index: number): void {
    this.selectedGoals = this.selectedGoals.filter((_, i) => i !== index);
  }

  moveGoal(index: number, dir: -1 | 1): void {
    const next = index + dir;
    if (next < 0 || next >= this.selectedGoals.length) return;
    const copy = [...this.selectedGoals];
    const [item] = copy.splice(index, 1);
    copy.splice(next, 0, item);
    this.selectedGoals = copy;
  }

  removeAction(index: number): void {
    this.selectedPlanSteps = this.selectedPlanSteps.filter((_, i) => i !== index);
    if (this.expandedStepIndex === index) {
      this.expandedStepIndex = null;
    }
  }

  toggleStepExpansion(index: number): void {
    this.expandedStepIndex = this.expandedStepIndex === index ? null : index;
  }

  getStepTypeLabel(type: string): string {
    const normalized = String(type || '').trim();
    if (normalized === 'questionnaire') return 'Questionnaire';
    if (normalized === 'task') return 'Task';
    if (normalized === 'appointment') return 'RDV';
    if (normalized === 'communication') return 'Communication';
    return normalized || 'Etape';
  }

  nextStep(): void {
    if (this.currentStep === 1) {
      if (!this.selectedPatient?.reference) {
        this.error = 'Veuillez sélectionner un patient.';
        return;
      }
      if (!this.form.valid) {
        this.form.markAllAsTouched();
        return;
      }
    }
    this.error = '';
    if (this.currentStep < 4) {
      this.currentStep++;
    }
  }

  prevStep(): void {
    this.error = '';
    if (this.currentStep > 1) {
      this.currentStep--;
    }
  }

  cancel(): void {
    this.router.navigate(['/my-patients']);
  }

  submit(): void {
    if (this.saving) return;
    if (!this.selectedPatient?.reference) {
      this.error = 'Veuillez sélectionner un patient.';
      return;
    }

    const raw = this.form.value;
    this.saving = true;
    this.error = '';

    this.carePlanService.createCarePlan({
      patientReference: this.selectedPatient.reference,
      categoryCode: String(raw.categoryCode || '').trim(),
      status: String(raw.status || 'draft').trim(),
      intent: String(raw.intent || 'plan').trim(),
      title: String(raw.title || '').trim(),
      description: String(raw.description || '').trim(),
      note: String(raw.note || '').trim(),
      goalRefs: this.selectedGoals.map(g => g.reference)
    }).subscribe({
      next: ({ id: carePlanId, patientId }) => {
        const resolvedPatientId = patientId || this.extractPatientId(this.selectedPatient?.reference || '');

        // Create CareTeam members first, then tasks with owner CareTeam, then bind tasks to CarePlan.activity.
        this.createPendingMembers(resolvedPatientId).subscribe({
          next: () => {
            this.careTeamService.getOrCreateCareTeamReference(resolvedPatientId).subscribe({
              next: (careTeamReference) => {
                const patientRef = this.selectedPatient?.reference || '';
                this.createActivitiesFromSteps(patientRef, careTeamReference).subscribe({
                  next: (activityReferences) => {
                    this.carePlanService.updateCarePlanWithActivities(carePlanId, activityReferences).subscribe({
                      next: () => {
                        this.saving = false;
                        if (resolvedPatientId) {
                          this.router.navigate(['/my-patients', resolvedPatientId]);
                        } else {
                          this.router.navigate(['/my-patients']);
                        }
                      },
                      error: (err) => {
                        this.saving = false;
                        this.error = err?.message || 'CarePlan et tâches créés mais impossible de lier les activités.';
                      }
                    });
                  },
                  error: (err) => {
                    this.saving = false;
                    this.error = err?.message || 'CarePlan créé mais impossible de créer les activités.';
                  }
                });
              },
              error: (err) => {
                this.saving = false;
                this.error = err?.message || 'CarePlan créé mais impossible de résoudre la CareTeam.';
              }
            });
          },
          error: (err) => {
            this.saving = false;
            this.error = err?.message || 'CarePlan et tâches créés mais impossible d\'ajouter les intervenants.';
          }
        });
      },
      error: (err) => {
        this.saving = false;
        this.error = err?.message || 'Impossible de créer le CarePlan.';
      }
    });
  }

  private createPendingMembers(patientId: string): Observable<void> {
    if (!patientId || this.pendingMembers.length === 0) {
      return of(void 0);
    }

    return from(this.pendingMembers).pipe(
      concatMap((member) => this.careTeamService.addMemberToPatientCareTeam(
        patientId,
        member.practitionerId,
        member.practitionerName,
        member.role,
        member.roleDisplay
      )),
      toArray(),
      map(() => void 0)
    );
  }

  private createActivitiesFromSteps(patientReference: string, ownerReference: string): Observable<string[]> {
    if (!patientReference || this.selectedPlanSteps.length === 0) {
      return of([]);
    }

    const requesterPractitionerId = this.authService.getConnectedPractitionerId();

    return from(this.selectedPlanSteps).pipe(
      concatMap((step, index) => this.createActivityFromStep(step, patientReference, ownerReference, requesterPractitionerId, index)),
      map((reference) => String(reference || '').trim()),
      toArray(),
      map((refs) => refs.filter((ref) => ref.length > 0))
    );
  }

  private createActivityFromStep(
    step: CarePlanStep,
    patientReference: string,
    ownerReference: string,
    requesterPractitionerId: string,
    index: number
  ): Observable<string> {
    const type = String(step.type || '').trim();
    const title = String(step.title || '').trim();
    const description = String(step.description || '').trim();
    const priority = String(step.priority || 'routine').trim();

    if (type === 'questionnaire') {
      const questionnaireRef = String(step.questionnaireRef || '').trim();
      // Questionnaire cannot be referenced directly in CarePlan.activity.reference in this profile.
      // We represent questionnaire fulfillment as a dedicated Task instance linked to the questionnaire model.
      return this.carePlanService.createTaskForCarePlan(
        {
          basedOnReference: questionnaireRef || undefined,
          title: title || 'Questionnaire',
          description,
          priority,
          status: index === 0 ? 'in-progress' : 'ready',
          requesterPractitionerId,
          ownerReference
        },
        patientReference
      ).pipe(map((created) => created.id ? `Task/${created.id}` : ''));
    }

    if (type === 'task') {
      const basedOnReference = String(step.taskRef || '').trim();
      return this.carePlanService.createTaskForCarePlan(
        {
          basedOnReference: basedOnReference || undefined,
          title,
          description,
          priority,
          status: index === 0 ? 'in-progress' : 'ready',
          requesterPractitionerId,
          ownerReference
        },
        patientReference
      ).pipe(map((created) => created.id ? `Task/${created.id}` : ''));
    }

    if (type === 'appointment') {
      const activityDefinitionRef = String(step.activityDefinitionRef || '').trim();
      if (activityDefinitionRef) {
        return of(activityDefinitionRef);
      }
      return this.carePlanService.createAppointmentForCarePlan(patientReference, title, description)
        .pipe(map((created) => created.id ? `Appointment/${created.id}` : ''));
    }

    if (type === 'communication') {
      const message = [title, description, String(step.communicationMessage || '').trim()].filter(Boolean).join(' - ');
      return this.carePlanService.createCommunicationRequestForCarePlan(
        patientReference,
        message,
        priority,
        requesterPractitionerId
      ).pipe(map((created) => created.id ? `CommunicationRequest/${created.id}` : ''));
    }

    return of('');
  }

  private extractPatientId(reference: string): string {
    const normalized = String(reference || '').trim();
    if (!normalized) {
      return '';
    }
    const parts = normalized.split('/');
    if (parts.length >= 2 && parts[0] === 'Patient') {
      return parts[1] || '';
    }
    return '';
  }

  private hasPendingPractitioner(items: CareTeamMemberInput[], practitionerId: string): boolean {
    return items.some((item) => item.practitionerId === practitionerId);
  }

  private resetPendingMembersToDefault(): void {
    const connectedMember = this.buildConnectedMember();
    this.pendingMembers = connectedMember ? [connectedMember] : [];
  }

  private buildConnectedMember(): CareTeamMemberInput | null {
    const practitionerId = this.authService.getConnectedPractitionerId().trim();
    if (!practitionerId) {
      return null;
    }

    const user = this.authService.getUserInfo();
    const practitionerName = user.fullName?.trim() || this.authService.getUsername().trim() || `Practitioner ${practitionerId}`;

    return {
      practitionerId,
      practitionerName,
      role: 'doctor',
      roleDisplay: 'Docteur / Médecin'
    };
  }
}
