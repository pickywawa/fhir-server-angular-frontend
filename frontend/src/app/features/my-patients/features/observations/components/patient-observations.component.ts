import { Component, Input, OnChanges, SimpleChanges, effect } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { TranslateModule } from '@ngx-translate/core';
import { BubbleCardComponent } from '../../../../../shared/components/bubble-card/bubble-card.component';
import { FhirPatientObservationService } from '../services/fhir-patient-observation.service';
import { ChatAssistantStateService } from '../../../../../core/services/chat-assistant-state.service';
import {
  ObservationSummary,
  OBSERVATION_CATEGORIES
} from '../models/patient-observation.model';

@Component({
  selector: 'app-patient-observations',
  standalone: true,
  imports: [CommonModule, FormsModule, TranslateModule, BubbleCardComponent],
  templateUrl: './patient-observations.component.html',
  styleUrl: './patient-observations.component.scss'
})
export class PatientObservationsComponent implements OnChanges {
  @Input() patientId?: string;
  @Input() startDate?: string | null;
  @Input() endDate?: string | null;
  @Input() showAddButton = true;
  @Input() refreshToken = 0;
  @Input() dockReturnView: 'close' | 'procedure' = 'close';

  loading = false;
  error = '';

  observations: ObservationSummary[] = [];
  filteredObservations: ObservationSummary[] = [];

  filterCategory = '';
  filterCode = '';

  readonly categories = OBSERVATION_CATEGORIES;

  constructor(
    private readonly observationService: FhirPatientObservationService,
    private readonly dockState: ChatAssistantStateService
  ) {}

  private readonly refreshEffect = effect(() => {
    this.dockState.observationRefreshToken();
    if (this.patientId) {
      this.loadObservations();
    }
  });

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['patientId']) {
      this.loadObservations();
      return;
    }

    if (changes['refreshToken']) {
      this.loadObservations();
      return;
    }

    if (changes['startDate'] || changes['endDate']) {
      this.applyFilters();
    }
  }

  openObservation(obs: ObservationSummary): void {
    if (!this.patientId || !obs.id) return;
    this.dockState.startObservationDraft(this.patientId, obs.id, this.dockReturnView);
  }

  addObservation(): void {
    if (!this.patientId) return;
    this.dockState.startObservationDraft(this.patientId, undefined, this.dockReturnView);
  }

  applyFilters(): void {
    const startTs = this.toTimestamp(this.startDate);
    const endTs = this.toTimestamp(this.endDate);

    this.filteredObservations = this.observations.filter((obs) => {
      const catMatch = !this.filterCategory || obs.categoryCode === this.filterCategory;
      const codeMatch = !this.filterCode
        || obs.codeCode.toLowerCase().includes(this.filterCode.toLowerCase())
        || obs.codeDisplay.toLowerCase().includes(this.filterCode.toLowerCase());
      const effectiveTs = this.toTimestamp(obs.effectiveDateTime);
      const startMatch = startTs === null || (effectiveTs !== null && effectiveTs >= startTs);
      const endMatch = endTs === null || (effectiveTs !== null && effectiveTs <= endTs);

      return catMatch && codeMatch && startMatch && endMatch;
    });
  }

  onFilterChange(): void {
    this.applyFilters();
  }

  formatValue(obs: ObservationSummary): string {
    switch (obs.valueType) {
      case 'string': return obs.valueString ?? '—';
      case 'boolean': return obs.valueBoolean === true ? 'Oui' : obs.valueBoolean === false ? 'Non' : '—';
      case 'integer': return obs.valueInteger !== undefined ? String(obs.valueInteger) : '—';
      case 'date': return obs.valueDate ? obs.valueDate.substring(0, 10) : '—';
      default: return '—';
    }
  }

  private loadObservations(): void {
    if (!this.patientId) {
      this.observations = [];
      this.filteredObservations = [];
      return;
    }

    this.loading = true;
    this.error = '';

    this.observationService.searchObservationsByPatient(this.patientId).subscribe({
      next: (observations) => {
        this.observations = observations;
        this.filteredObservations = observations;
        this.applyPendingSavedObservation();
        this.loading = false;
        this.applyFilters();
      },
      error: (err: unknown) => {
        this.error = err instanceof Error ? err.message : 'Erreur lors du chargement des observations.';
        this.loading = false;
      }
    });
  }

  private toTimestamp(value: string | null | undefined): number | null {
    if (!value) {
      return null;
    }

    const normalized = value.length === 16 ? `${value}:00` : value;
    const ts = new Date(normalized).getTime();
    return Number.isFinite(ts) ? ts : null;
  }

  private applyPendingSavedObservation(): void {
    const saved = this.dockState.lastSavedObservation();
    if (!saved || saved.patientId !== this.patientId || !saved.observation?.id) {
      return;
    }

    const index = this.observations.findIndex((obs) => obs.id === saved.observation.id);
    if (index >= 0) {
      this.observations[index] = saved.observation;
    } else {
      this.observations = [saved.observation, ...this.observations];
    }

    this.filteredObservations = [...this.observations];
  }
}
