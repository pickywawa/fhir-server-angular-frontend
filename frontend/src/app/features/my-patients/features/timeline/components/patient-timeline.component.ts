import { CommonModule } from '@angular/common';
import { Component, Input, OnChanges, SimpleChanges } from '@angular/core';
import { Router } from '@angular/router';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { BubbleCardComponent } from '../../../../../shared/components/bubble-card/bubble-card.component';
import { PatientTimelineCategory, PatientTimelineEvent } from '../models/patient-timeline.model';
import { FhirPatientTimelineService } from '../services/fhir-patient-timeline.service';

@Component({
  selector: 'app-patient-timeline',
  standalone: true,
  imports: [CommonModule, TranslateModule, BubbleCardComponent],
  templateUrl: './patient-timeline.component.html',
  styleUrls: ['./patient-timeline.component.scss']
})
export class PatientTimelineComponent implements OnChanges {
  @Input() patientId?: string;
  @Input() startDate?: string | null;
  @Input() endDate?: string | null;
  @Input() refreshToken = 0;

  loading = false;
  error = '';
  events: PatientTimelineEvent[] = [];
  allEvents: PatientTimelineEvent[] = [];

  constructor(
    private readonly timelineService: FhirPatientTimelineService,
    private readonly router: Router,
    private readonly translateService: TranslateService
  ) {}

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['patientId']) {
      this.loadTimeline();
      return;
    }

    if (changes['refreshToken']) {
      this.loadTimeline();
      return;
    }

    if (changes['startDate'] || changes['endDate']) {
      this.applyDateRangeFilter();
    }
  }

  openEvent(event: PatientTimelineEvent): void {
    if (!event.routeCommands?.length) {
      return;
    }

    this.router.navigate(event.routeCommands, event.queryParams ? { queryParams: event.queryParams } : undefined);
  }

  getCategoryLabel(category: PatientTimelineCategory): string {
    return this.translateService.instant(`myPatients.timeline.categories.${category}`);
  }

  getEventTypeLabel(event: PatientTimelineEvent): string {
    const action = this.translateService.instant(`myPatients.timeline.actions.${event.action}`);
    const category = this.getCategoryLabel(event.category);
    return `${action} ${category}`;
  }

  iconFor(category: PatientTimelineCategory): string {
    const map: Record<PatientTimelineCategory, string> = {
      document: 'file',
      questionnaire: 'questionnaire',
      appointment: 'calendar',
      'care-team': 'team',
      'related-person': 'people',
      careplan: 'plan',
      patient: 'user',
      discussion: 'chat',
      other: 'dot'
    };

    return map[category] || 'dot';
  }

  private loadTimeline(): void {
    if (!this.patientId) {
      this.events = [];
      return;
    }

    this.loading = true;
    this.error = '';

    this.timelineService.listPatientTimeline(this.patientId).subscribe({
      next: (events) => {
        this.allEvents = events;
        this.applyDateRangeFilter();
        this.loading = false;
      },
      error: (error: unknown) => {
        this.error = this.formatError(error);
        this.loading = false;
      }
    });
  }

  private applyDateRangeFilter(): void {
    const startTs = this.toTimestamp(this.startDate);
    const endTs = this.toTimestamp(this.endDate);

    this.events = this.allEvents.filter((event) => {
      const eventTs = this.toTimestamp(event.occurredAt);
      const startMatch = startTs === null || (eventTs !== null && eventTs >= startTs);
      const endMatch = endTs === null || (eventTs !== null && eventTs <= endTs);
      return startMatch && endMatch;
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
    return this.translateService.instant('myPatients.timeline.errors.load');
  }
}
