import { Component, Input, OnChanges, SimpleChanges } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { TranslateModule } from '@ngx-translate/core';
import { BubbleCardComponent } from '../../../../../shared/components/bubble-card/bubble-card.component';
import { FhirPatientProcedureService } from '../services/fhir-patient-procedure.service';
import { ChatAssistantStateService } from '../../../../../core/services/chat-assistant-state.service';
import { ProcedureSummary, PROCEDURE_CATEGORIES, PROCEDURE_STATUSES } from '../models/patient-procedure.model';

@Component({
  selector: 'app-patient-procedures',
  standalone: true,
  imports: [CommonModule, FormsModule, TranslateModule, BubbleCardComponent],
  templateUrl: './patient-procedures.component.html',
  styleUrl: './patient-procedures.component.scss'
})
export class PatientProceduresComponent implements OnChanges {
  @Input() patientId?: string;

  loading = false;
  error = '';

  procedures: ProcedureSummary[] = [];
  filteredProcedures: ProcedureSummary[] = [];

  filterCategory = '';
  filterStatus = '';

  readonly categories = PROCEDURE_CATEGORIES;
  readonly statuses = PROCEDURE_STATUSES;

  constructor(
    private readonly procedureService: FhirPatientProcedureService,
    private readonly utilityDockState: ChatAssistantStateService
  ) {}

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['patientId']) {
      this.loadProcedures();
    }
  }

  openProcedure(proc: ProcedureSummary): void {
    if (!this.patientId || !proc.id) return;
    this.utilityDockState.startProcedureDraft(this.patientId, proc.id);
  }

  addProcedure(): void {
    if (!this.patientId) return;
    this.utilityDockState.startProcedureDraft(this.patientId);
  }

  applyFilters(): void {
    this.filteredProcedures = this.procedures.filter((p) => {
      const catMatch = !this.filterCategory || p.categoryCode === this.filterCategory;
      const statusMatch = !this.filterStatus || p.status === this.filterStatus;
      return catMatch && statusMatch;
    });
  }

  onFilterChange(): void {
    this.applyFilters();
  }

  statusDisplay(code: string): string {
    return this.statuses.find((s) => s.code === code)?.display ?? code;
  }

  private loadProcedures(): void {
    if (!this.patientId) {
      this.procedures = [];
      this.filteredProcedures = [];
      return;
    }

    this.loading = true;
    this.error = '';

    this.procedureService.searchProceduresByPatient(this.patientId).subscribe({
      next: (procedures) => {
        this.procedures = procedures;
        this.filteredProcedures = procedures;
        this.loading = false;
        this.applyFilters();
      },
      error: (err: unknown) => {
        this.error = err instanceof Error ? err.message : 'Erreur lors du chargement des actes.';
        this.loading = false;
      }
    });
  }
}
