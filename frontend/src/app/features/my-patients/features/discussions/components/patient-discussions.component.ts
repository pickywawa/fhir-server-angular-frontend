import { CommonModule } from '@angular/common';
import { AfterViewChecked, Component, ElementRef, HostBinding, Input, OnChanges, OnDestroy, OnInit, SimpleChanges, ViewChild, inject } from '@angular/core';
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
import { FhirCarePlanWorklistService } from '../../../services/fhir-care-plan-worklist.service';
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
export class PatientDiscussionsComponent implements OnChanges, OnInit, OnDestroy, AfterViewChecked {
  @Input() patientId?: string;
  @Input() bare = false;
  @Input() embedded = false;
  @ViewChild('messagesList') private messagesList?: ElementRef<HTMLDivElement>;

  @HostBinding('class.embedded-mode')
  get embeddedMode(): boolean {
    return this.embedded;
  }

  isNarrow = false;
  private resizeObserver?: ResizeObserver;
  private readonly el = inject(ElementRef);

  readonly messageForm: FormGroup;
  readonly isTtsSupported: boolean;

  loading = false;
  sending = false;
  renamingTitle = false;
  error = '';

  isDictating = false;
  private shouldScrollToBottom = false;
  private recognition: any = null;

  members: CareTeamMember[] = [];
  allMessages: PatientDiscussionMessage[] = [];
  threads: PatientDiscussionThread[] = [];
  threadSearchQuery = '';
  editedDiscussionTitle = '';
  isEditingDiscussionTitle = false;
  selectedDiscussionId = '';
  senderReference = '';
  recipientReference = '';
  referenceDisplayMap: Record<string, string> = {};

  get isGlobalContext(): boolean {
    return !this.patientId;
  }

  constructor(
    private readonly fb: FormBuilder,
    private readonly authService: AuthService,
    private readonly careTeamService: FhirCareTeamService,
    private readonly carePlanWorklistService: FhirCarePlanWorklistService,
    private readonly discussionService: FhirPatientDiscussionService,
    private readonly connectedPractitionerResolver: ConnectedPractitionerResolverService,
    private readonly translateService: TranslateService
  ) {
    this.messageForm = this.fb.group({
      content: ['', [Validators.required, Validators.maxLength(2000)]]
    });
    this.isTtsSupported = 'SpeechRecognition' in window || 'webkitSpeechRecognition' in window;
  }

  ngOnInit(): void {
    this.loadData();
    this.resizeObserver = new ResizeObserver((entries) => {
      const width = entries[0]?.contentRect.width ?? this.el.nativeElement.offsetWidth;
      this.isNarrow = width < 560;
    });
    this.resizeObserver.observe(this.el.nativeElement);
  }

  ngOnDestroy(): void {
    this.stopDictation();
    this.resizeObserver?.disconnect();
  }

  ngAfterViewChecked(): void {
    if (!this.shouldScrollToBottom) {
      return;
    }
    this.scrollMessagesToBottom();
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

  get selectedThread(): PatientDiscussionThread | undefined {
    return this.threads.find((thread) => thread.id === this.selectedDiscussionId);
  }

  get selectedThreadTitle(): string {
    return this.selectedThread?.title || this.getDefaultThreadTitle(this.selectedDiscussionId);
  }

  get filteredThreads(): PatientDiscussionThread[] {
    const query = this.threadSearchQuery.trim().toLowerCase();
    if (!query) {
      return this.threads;
    }

    return this.threads.filter((thread) => {
      const id = String(thread.id || '').toLowerCase();
      const title = String(thread.title || '').toLowerCase();
      const lastMessage = String(thread.lastMessage || '').toLowerCase();
      const patientLabel = String(this.getThreadPatientLabel(thread) || '').toLowerCase();
      return id.includes(query) || title.includes(query) || lastMessage.includes(query) || patientLabel.includes(query);
    });
  }

  getThreadDisplayTitle(thread: PatientDiscussionThread): string {
    return String(thread.title || '').trim() || this.getDefaultThreadTitle(thread.id);
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
    const seed = String(thread.title || thread.lastMessage || thread.id || '').trim();
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
    if (this.isGlobalContext) {
      return;
    }

    this.selectedDiscussionId = this.newUid();
    const draft: PatientDiscussionThread = {
      id: this.selectedDiscussionId,
      discussionId: this.selectedDiscussionId,
      title: this.getDefaultThreadTitle(this.selectedDiscussionId),
      lastMessage: this.translateService.instant('myPatients.discussions.newDiscussion'),
      lastSent: new Date().toISOString(),
      messageCount: 0
    };
    this.threads = [draft, ...this.threads];
    this.requestScrollToBottom();
  }

  selectDiscussion(threadId: string): void {
    this.selectedDiscussionId = threadId;
    this.requestScrollToBottom();
  }

  onThreadSearchInput(value: string): void {
    this.threadSearchQuery = value;
  }

  startDiscussionTitleEdit(): void {
    if (!this.selectedThread || this.renamingTitle) {
      return;
    }
    this.isEditingDiscussionTitle = true;
    this.editedDiscussionTitle = this.selectedThreadTitle;
  }

  cancelDiscussionTitleEdit(): void {
    this.isEditingDiscussionTitle = false;
    this.editedDiscussionTitle = '';
  }

  saveDiscussionTitle(): void {
    if (!this.selectedThread || this.renamingTitle) {
      return;
    }

    const nextTitle = String(this.editedDiscussionTitle || '').trim();
    if (!nextTitle) {
      this.error = this.translateService.instant('myPatients.discussions.errors.titleRequired');
      return;
    }

    if (this.selectedMessages.length === 0) {
      this.threads = this.threads.map((thread) =>
        thread.id === this.selectedDiscussionId
          ? { ...thread, title: nextTitle }
          : thread
      );
      this.isEditingDiscussionTitle = false;
      this.editedDiscussionTitle = '';
      return;
    }

    this.renamingTitle = true;
    this.error = '';

    this.discussionService.updateDiscussionTitle(this.selectedMessages, nextTitle).subscribe({
      next: () => {
        this.allMessages = this.allMessages.map((message) =>
          message.discussionId === this.selectedDiscussionId
            ? { ...message, discussionTitle: nextTitle }
            : message
        );
        this.rebuildThreads();
        this.isEditingDiscussionTitle = false;
        this.editedDiscussionTitle = '';
        this.renamingTitle = false;
      },
      error: (error: unknown) => {
        this.error = this.formatError(error, this.translateService.instant('myPatients.discussions.errors.renameTitle'));
        this.renamingTitle = false;
      }
    });
  }

  sendMessage(): void {
    const contextPatientId = this.patientId || this.extractPatientId(this.selectedThread?.patientReference || '');
    if (!contextPatientId) {
      this.error = this.translateService.instant('myPatients.discussions.errors.patientNotFound');
      return;
    }

    if (!this.selectedDiscussionId) {
      this.error = this.translateService.instant('myPatients.discussions.errors.selectDiscussion');
      return;
    }

    if (this.messageForm.invalid) {
      this.messageForm.markAllAsTouched();
      return;
    }

    const activeRecipientReference = this.getActiveRecipientReference();
    if (!activeRecipientReference) {
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
            contextPatientId,
            this.selectedThread?.discussionId || this.selectedDiscussionId,
            senderReference,
            activeRecipientReference,
            String(value.content || '').trim(),
            this.selectedThreadTitle
          )
          .subscribe({
            next: (message) => {
              this.allMessages = [...this.allMessages, message];
              this.rebuildThreads();
              this.ensureReferenceDisplays();
              this.sending = false;
              this.messageForm.patchValue({ content: '' });
              this.requestScrollToBottom();
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

  getThreadPatientLabel(thread: PatientDiscussionThread): string {
    const reference = String(thread.patientReference || '').trim();
    if (!reference) {
      return '';
    }
    return this.referenceDisplayMap[reference] || reference;
  }

  private loadData(): void {
    this.cancelDiscussionTitleEdit();

    if (!this.patientId) {
      this.loadGlobalData();
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
          this.requestScrollToBottom();
        }

        this.loading = false;
      },
      error: (error: unknown) => {
        this.error = this.formatError(error, this.translateService.instant('myPatients.discussions.errors.load'));
        this.loading = false;
      }
    });
  }

  private loadGlobalData(): void {
    this.loading = true;
    this.error = '';
    this.cancelDiscussionTitleEdit();
    this.members = [];
    this.allMessages = [];
    this.threads = [];
    this.selectedDiscussionId = '';

    this.resolveSenderReference().subscribe({
      next: (senderReference) => {
        console.debug('[discussions-global] resolved sender reference', { senderReference });
        this.loadGlobalDataForReference(senderReference, true);
      },
      error: () => {
        console.debug('[discussions-global] failed to resolve sender reference');
        this.error = this.translateService.instant('myPatients.discussions.errors.senderNotFound');
        this.loading = false;
      }
    });
  }

  private loadGlobalDataForReference(senderReference: string, allowResolverFallback: boolean): void {
    this.senderReference = senderReference;
    const practitionerId = this.extractPractitionerId(senderReference);

    console.debug('[discussions-global] loading for reference', {
      senderReference,
      practitionerId,
      allowResolverFallback
    });

    if (!practitionerId) {
      console.debug('[discussions-global] practitioner id missing from sender reference', { senderReference });
      this.error = this.translateService.instant('myPatients.discussions.errors.senderNotFound');
      this.loading = false;
      return;
    }

    this.careTeamService.getCareTeamReferencesByPractitioner(practitionerId).subscribe({
      next: (careTeamReferences) => {
        const recipientReferences = [`Practitioner/${practitionerId}`, ...careTeamReferences];
        console.debug('[discussions-global] resolved recipient references', {
          practitionerId,
          careTeamReferences,
          recipientReferences
        });

        this.discussionService.listMessagesByRecipients(recipientReferences).subscribe({
          next: (messages) => {
            console.debug('[discussions-global] messages loaded by recipients', {
              recipientReferencesCount: recipientReferences.length,
              messagesCount: messages.length,
              discussionIds: Array.from(new Set(messages.map((m) => m.discussionId)))
            });
            if (!messages.length && allowResolverFallback) {
              this.loadGlobalDataFromWorklist(senderReference, careTeamReferences, allowResolverFallback);
              return;
            }

            this.applyGlobalMessages(messages);
          },
          error: (error: unknown) => {
            console.debug('[discussions-global] failed loading messages by recipients', { error });
            this.error = this.formatError(error, this.translateService.instant('myPatients.discussions.errors.load'));
            this.loading = false;
          }
        });
      },
      error: (error: unknown) => {
        console.debug('[discussions-global] failed loading care team references', { practitionerId, error });
        this.error = this.formatError(error, this.translateService.instant('myPatients.discussions.errors.load'));
        this.loading = false;
      }
    });
  }

  private loadGlobalDataFromWorklist(
    senderReference: string,
    careTeamReferences: string[],
    allowResolverFallback: boolean
  ): void {
    console.debug('[discussions-global] falling back to my-patients worklist aggregation');

    this.carePlanWorklistService.getCarePlanWorklist(200).subscribe({
      next: (items) => {
        const patientIds = Array.from(new Set(items.map((item) => String(item.patientId || '').trim()).filter(Boolean)));
        const patientLabelMap = items.reduce<Record<string, string>>((acc, item) => {
          const patientId = String(item.patientId || '').trim();
          if (!patientId) {
            return acc;
          }

          const label = `${String(item.patientFirstName || '').trim()} ${String(item.patientLastName || '').trim()}`.trim();
          if (label) {
            acc[`Patient/${patientId}`] = label;
          }
          return acc;
        }, {});

        console.debug('[discussions-global] worklist patients resolved', {
          worklistCount: items.length,
          patientIdsCount: patientIds.length,
          patientIds
        });

        if (!patientIds.length) {
          this.tryResolverFallbackOrApplyEmpty(senderReference, allowResolverFallback, patientLabelMap);
          return;
        }

        forkJoin(
          patientIds.map((patientId) => this.discussionService.listMessagesByPatient(patientId).pipe(catchError(() => of([]))))
        ).subscribe({
          next: (resultSets) => {
            const allPatientMessages = resultSets.flat();
            const scopedMessages = this.filterRelevantMessagesForPractitioner(allPatientMessages, senderReference, careTeamReferences);
            const selectedMessages = scopedMessages.length > 0 ? scopedMessages : allPatientMessages;

            console.debug('[discussions-global] worklist discussion aggregation', {
              allPatientMessagesCount: allPatientMessages.length,
              scopedMessagesCount: scopedMessages.length,
              selectedMessagesCount: selectedMessages.length,
              discussionIds: Array.from(new Set(selectedMessages.map((m) => m.discussionId)))
            });

            if (!selectedMessages.length) {
              this.tryResolverFallbackOrApplyEmpty(senderReference, allowResolverFallback, patientLabelMap);
              return;
            }

            this.applyGlobalMessages(selectedMessages, patientLabelMap);
          },
          error: (error: unknown) => {
            console.debug('[discussions-global] failed loading worklist patient discussions', { error });
            this.error = this.formatError(error, this.translateService.instant('myPatients.discussions.errors.load'));
            this.loading = false;
          }
        });
      },
      error: (error: unknown) => {
        console.debug('[discussions-global] failed loading worklist patients', { error });
        this.error = this.formatError(error, this.translateService.instant('myPatients.discussions.errors.load'));
        this.loading = false;
      }
    });
  }

  private tryResolverFallbackOrApplyEmpty(
    senderReference: string,
    allowResolverFallback: boolean,
    patientLabelMap: Record<string, string>
  ): void {
    if (!allowResolverFallback) {
      this.applyGlobalMessages([], patientLabelMap);
      return;
    }

    console.debug('[discussions-global] no messages found, trying forced practitioner resolver fallback');
    this.connectedPractitionerResolver.resolveReference(true).subscribe({
      next: (resolvedReference) => {
        const normalizedResolved = String(resolvedReference || '').trim();
        console.debug('[discussions-global] forced resolver result', {
          previousReference: senderReference,
          resolvedReference: normalizedResolved
        });
        if (normalizedResolved && normalizedResolved !== senderReference) {
          this.loadGlobalDataForReference(normalizedResolved, false);
          return;
        }

        this.applyGlobalMessages([], patientLabelMap);
      },
      error: () => {
        console.debug('[discussions-global] forced resolver fallback failed');
        this.applyGlobalMessages([], patientLabelMap);
      }
    });
  }

  private filterRelevantMessagesForPractitioner(
    messages: PatientDiscussionMessage[],
    senderReference: string,
    careTeamReferences: string[]
  ): PatientDiscussionMessage[] {
    const recipients = new Set([senderReference, ...careTeamReferences].map((item) => String(item || '').trim()).filter(Boolean));

    return messages.filter((message) => {
      const messageSender = String(message.senderReference || '').trim();
      const messageRecipients = (message.recipientReferences || []).map((item) => String(item || '').trim()).filter(Boolean);
      return messageSender === senderReference || messageRecipients.some((reference) => recipients.has(reference));
    });
  }

  private applyGlobalMessages(messages: PatientDiscussionMessage[], patientLabelMap: Record<string, string> = {}): void {
    this.allMessages = messages;
    this.referenceDisplayMap = {
      ...patientLabelMap,
      ...this.referenceDisplayMap
    };
    this.rebuildThreads();
    this.ensureReferenceDisplays();
    if (!this.selectedDiscussionId && this.threads.length > 0) {
      this.selectedDiscussionId = this.threads[0].id;
      this.requestScrollToBottom();
    }
    console.debug('[discussions-global] threads built', {
      threadsCount: this.threads.length,
      selectedDiscussionId: this.selectedDiscussionId
    });
    this.loading = false;
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
        const titledMessage = [...sorted].reverse().find((item) => String(item.discussionTitle || '').trim());
        const title = String(titledMessage?.discussionTitle || '').trim() || this.getDefaultThreadTitle(id);
        const patientReference =
          last?.subjectReference ||
          sorted.find((item) => String(item.subjectReference || '').trim())?.subjectReference ||
          '';
        const recipientReference =
          (last?.recipientReferences || []).find((reference) => reference !== this.senderReference) ||
          last?.recipientReferences?.[0] ||
          '';

        return {
          id,
          discussionId: id,
          title,
          patientReference,
          recipientReference,
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

  private getDefaultThreadTitle(discussionId: string): string {
    const shortId = String(discussionId || '').slice(0, 8);
    if (!shortId) {
      return this.translateService.instant('myPatients.discussions.threadPrefix');
    }
    return `${this.translateService.instant('myPatients.discussions.threadPrefix')} ${shortId}`;
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
          .flatMap((message) => [
            String(message.senderReference || '').trim(),
            String(message.subjectReference || '').trim()
          ])
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

  private extractPractitionerId(reference: string): string {
    const value = String(reference || '').trim();
    const prefix = 'Practitioner/';
    return value.startsWith(prefix) ? value.slice(prefix.length) : '';
  }

  private extractPatientId(reference: string): string {
    const value = String(reference || '').trim();
    const prefix = 'Patient/';
    return value.startsWith(prefix) ? value.slice(prefix.length) : '';
  }

  private getActiveRecipientReference(): string {
    if (!this.isGlobalContext) {
      return this.recipientReference;
    }
    return String(this.selectedThread?.recipientReference || '').trim();
  }

  toggleDictation(): void {
    if (this.isDictating) {
      this.stopDictation();
    } else {
      this.startDictation();
    }
  }

  private startDictation(): void {
    const SpeechRecognitionApi =
      (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRecognitionApi) {
      return;
    }

    this.recognition = new SpeechRecognitionApi();
    this.recognition.lang = navigator.language || 'fr-FR';
    this.recognition.interimResults = false;
    this.recognition.maxAlternatives = 1;
    this.recognition.continuous = false;

    this.recognition.onresult = (event: any) => {
      const transcript: string = event.results[0][0].transcript;
      const current: string = this.messageForm.get('content')?.value || '';
      const separator = current && !current.endsWith(' ') ? ' ' : '';
      this.messageForm.patchValue({ content: current + separator + transcript });
    };

    this.recognition.onend = () => {
      this.isDictating = false;
      this.recognition = null;
    };

    this.recognition.onerror = () => {
      this.isDictating = false;
      this.recognition = null;
    };

    this.recognition.start();
    this.isDictating = true;
  }

  stopDictation(): void {
    if (this.recognition) {
      this.recognition.stop();
      this.recognition = null;
    }
    this.isDictating = false;
  }

  private requestScrollToBottom(): void {
    this.shouldScrollToBottom = true;
  }

  private scrollMessagesToBottom(): void {
    const container = this.messagesList?.nativeElement;
    if (!container) {
      return;
    }
    container.scrollTop = container.scrollHeight;
    this.shouldScrollToBottom = false;
  }
}
