import { CommonModule } from '@angular/common';
import { Component, Input, OnChanges, SimpleChanges } from '@angular/core';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { HttpErrorResponse } from '@angular/common/http';
import { forkJoin, of } from 'rxjs';
import { catchError } from 'rxjs/operators';
import { BubbleCardComponent } from '../../../../../shared/components/bubble-card/bubble-card.component';
import { ButtonPrimaryComponent } from '../../../../../core/components/button/button-primary.component';
import { AuthService } from '../../../../../core/services/auth.service';
import { ConnectedPractitionerResolverService } from '../../../../../core/services/connected-practitioner-resolver.service';
import { FhirCareTeamService } from '../../care-team/services/fhir-care-team.service';
import { CareTeamMember } from '../../../models/care-team.model';
import { PatientDiscussionMessage, PatientDiscussionThread } from '../models/patient-discussion.model';
import { FhirPatientDiscussionService } from '../services/fhir-patient-discussion.service';
import { TranslateModule, TranslateService } from '@ngx-translate/core';

@Component({
  selector: 'app-patient-discussions',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, BubbleCardComponent, ButtonPrimaryComponent, TranslateModule],
  templateUrl: './patient-discussions.component.html',
  styleUrl: './patient-discussions.component.scss'
})
export class PatientDiscussionsComponent implements OnChanges {
  @Input() patientId?: string;

  readonly messageForm: FormGroup;

  loading = false;
  sending = false;
  error = '';

  members: CareTeamMember[] = [];
  allMessages: PatientDiscussionMessage[] = [];
  threads: PatientDiscussionThread[] = [];
  selectedDiscussionId = '';
  senderReference = '';
  recipientReference = '';
  referenceDisplayMap: Record<string, string> = {};

  constructor(
    private readonly fb: FormBuilder,
    private readonly authService: AuthService,
    private readonly careTeamService: FhirCareTeamService,
    private readonly discussionService: FhirPatientDiscussionService,
    private readonly connectedPractitionerResolver: ConnectedPractitionerResolverService,
    private readonly translateService: TranslateService
  ) {
    this.messageForm = this.fb.group({
      content: ['', [Validators.required, Validators.maxLength(2000)]]
    });
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['patientId']) {
      this.loadData();
    }
  }

  get selectedMessages(): PatientDiscussionMessage[] {
    if (!this.selectedDiscussionId) {
      return [];
    }
    return this.allMessages
      .filter((item) => item.discussionId === this.selectedDiscussionId)
      .sort((a, b) => new Date(a.sent).getTime() - new Date(b.sent).getTime());
  }

  isConnectedSender(message: PatientDiscussionMessage): boolean {
    return String(message.senderReference || '').trim() === String(this.senderReference || '').trim();
  }

  getSenderDisplay(message: PatientDiscussionMessage): string {
    const reference = String(message.senderReference || '').trim();
    if (!reference) {
      return this.translateService.instant('myPatients.discussions.unknownSender');
    }

    return this.referenceDisplayMap[reference] || this.getMemberLabel(reference);
  }

  getThreadInitial(thread: PatientDiscussionThread): string {
    const seed = String(thread.lastMessage || thread.id || '').trim();
    return seed ? seed.charAt(0).toUpperCase() : '•';
  }

  formatThreadTime(value: string): string {
    if (!value) {
      return '';
    }
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) {
      return '';
    }
    return date.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
  }

  createDiscussion(): void {
    this.selectedDiscussionId = this.newUid();
    const draft: PatientDiscussionThread = {
      id: this.selectedDiscussionId,
      lastMessage: this.translateService.instant('myPatients.discussions.newDiscussion'),
      lastSent: new Date().toISOString(),
      messageCount: 0
    };
    this.threads = [draft, ...this.threads];
  }

  selectDiscussion(threadId: string): void {
    this.selectedDiscussionId = threadId;
  }

  sendMessage(): void {
    if (!this.patientId) {
      this.error = this.translateService.instant('myPatients.discussions.errors.patientNotFound');
      return;
    }
    const patientId = this.patientId;

    if (!this.selectedDiscussionId) {
      this.error = this.translateService.instant('myPatients.discussions.errors.selectDiscussion');
      return;
    }

    if (this.messageForm.invalid) {
      this.messageForm.markAllAsTouched();
      return;
    }

    if (!this.recipientReference) {
      this.error = this.translateService.instant('myPatients.discussions.errors.recipientNotFound');
      return;
    }

    const value = this.messageForm.getRawValue();
    this.sending = true;
    this.error = '';

    this.resolveSenderReference().subscribe({
      next: (senderReference) => {
        if (!senderReference) {
          this.error = this.translateService.instant('myPatients.discussions.errors.senderNotFound');
          this.sending = false;
          return;
        }

        this.senderReference = senderReference;

        this.discussionService
          .sendMessage(
            patientId,
            this.selectedDiscussionId,
            senderReference,
            this.recipientReference,
            String(value.content || '').trim()
          )
          .subscribe({
            next: (message) => {
              this.allMessages = [...this.allMessages, message];
              this.rebuildThreads();
              this.ensureReferenceDisplays();
              this.sending = false;
              this.messageForm.patchValue({ content: '' });
            },
            error: (error: unknown) => {
              this.error = this.formatError(error, this.translateService.instant('myPatients.discussions.errors.send'));
              this.sending = false;
            }
          });
      },
      error: () => {
        this.error = this.translateService.instant('myPatients.discussions.errors.senderNotFound');
        this.sending = false;
      }
    });
  }

  getMemberLabel(reference: string): string {
    if (!reference) {
      return this.translateService.instant('myPatients.discussions.unknownSender');
    }
    const found = this.members.find((item) => item.reference === reference);
    if (found) {
      return found.name;
    }
    return reference;
  }

  private loadData(): void {
    if (!this.patientId) {
      this.members = [];
      this.allMessages = [];
      this.threads = [];
      this.selectedDiscussionId = '';
      return;
    }

    this.loading = true;
    this.error = '';

    forkJoin({
      members: this.careTeamService.getMembersByPatient(this.patientId).pipe(catchError(() => of([]))),
      messages: this.discussionService.listMessagesByPatient(this.patientId).pipe(catchError(() => of([]))),
      careTeamReference: this.careTeamService.getOrCreateCareTeamReference(this.patientId).pipe(catchError(() => of('')))
    }).subscribe({
      next: ({ members, messages, careTeamReference }) => {
        this.members = members.filter((item) => item.reference?.startsWith('Practitioner/'));
        this.allMessages = messages;
        this.recipientReference = careTeamReference;
        this.resolveSenderReference().subscribe({
          next: (reference) => {
            this.senderReference = reference;
          }
        });
        this.rebuildThreads();
        this.ensureReferenceDisplays();
        if (!this.selectedDiscussionId && this.threads.length > 0) {
          this.selectedDiscussionId = this.threads[0].id;
        }

        this.loading = false;
      },
      error: (error: unknown) => {
        this.error = this.formatError(error, this.translateService.instant('myPatients.discussions.errors.load'));
        this.loading = false;
      }
    });
  }

  private rebuildThreads(): void {
    const grouped = new Map<string, PatientDiscussionMessage[]>();

    this.allMessages.forEach((message) => {
      if (!grouped.has(message.discussionId)) {
        grouped.set(message.discussionId, []);
      }
      grouped.get(message.discussionId)?.push(message);
    });

    this.threads = Array.from(grouped.entries())
      .map(([id, messages]) => {
        const sorted = [...messages].sort((a, b) => new Date(a.sent).getTime() - new Date(b.sent).getTime());
        const last = sorted[sorted.length - 1];
        return {
          id,
          lastMessage: last?.content || this.translateService.instant('myPatients.discussions.threadPrefix'),
          lastSent: last?.sent || '',
          messageCount: messages.length
        } as PatientDiscussionThread;
      })
      .sort((a, b) => new Date(b.lastSent).getTime() - new Date(a.lastSent).getTime());

    if (this.selectedDiscussionId && !this.threads.some((thread) => thread.id === this.selectedDiscussionId)) {
      this.selectedDiscussionId = this.threads[0]?.id || '';
    }
  }

  private formatError(error: unknown, fallback: string): string {
    if (error instanceof HttpErrorResponse) {
      const diagnostics =
        error.error?.issue?.[0]?.diagnostics ||
        error.error?.message ||
        '';
      if (diagnostics) {
        return String(diagnostics);
      }
      return error.message || fallback;
    }

    if (error instanceof Error) {
      return error.message;
    }
    if (typeof error === 'string') {
      return error;
    }
    if (error && typeof error === 'object' && 'message' in error) {
      return String((error as { message: unknown }).message);
    }
    return fallback;
  }

  private newUid(): string {
    if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
      return crypto.randomUUID();
    }
    return `${Date.now()}-${Math.random().toString(16).slice(2)}`;
  }

  private resolveSenderReference() {
    if (this.senderReference) {
      return of(this.senderReference);
    }

    const practitionerId = this.authService.getConnectedPractitionerId();
    if (practitionerId) {
      return of(`Practitioner/${practitionerId}`);
    }

    return this.connectedPractitionerResolver.resolveReference();
  }

  private ensureReferenceDisplays(): void {
    const references = Array.from(
      new Set(
        this.allMessages
          .map((message) => String(message.senderReference || '').trim())
          .filter(Boolean)
      )
    );

    const missing = references.filter((reference) => !this.referenceDisplayMap[reference]);
    if (!missing.length) {
      return;
    }

    forkJoin(
      missing.map((reference) =>
        this.discussionService.resolveReferenceDisplay(reference).pipe(
          catchError(() => of(reference))
        )
      )
    ).subscribe((labels) => {
      const nextMap = { ...this.referenceDisplayMap };
      missing.forEach((reference, index) => {
        nextMap[reference] = labels[index] || reference;
      });
      this.referenceDisplayMap = nextMap;
    });
  }
}
