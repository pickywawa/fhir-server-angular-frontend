import { CommonModule } from '@angular/common';
import { Component, ElementRef, HostListener, OnDestroy, OnInit, ViewChild, inject } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router } from '@angular/router';
import { TranslateModule } from '@ngx-translate/core';
import { TranslateService } from '@ngx-translate/core';
import { Subject, Subscription, take, takeUntil } from 'rxjs';
import { AuthService } from '../../../core/services/auth.service';
import { ChatBotService, ChatStreamEvent } from '../../../core/services/chat-bot.service';
import { LinkifyPipe } from '../../pipes/linkify.pipe';
import { ChatAssistantStateService } from '../../../core/services/chat-assistant-state.service';

type SpeechRecognitionCtor = new () => SpeechRecognitionLike;

interface SpeechRecognitionLike {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  maxAlternatives: number;
  onstart: (() => void) | null;
  onaudiostart?: (() => void) | null;
  onaudioend?: (() => void) | null;
  onsoundstart?: (() => void) | null;
  onsoundend?: (() => void) | null;
  onspeechstart?: (() => void) | null;
  onspeechend?: (() => void) | null;
  onresult: ((event: SpeechRecognitionEventLike) => void) | null;
  onerror: ((event: Event) => void) | null;
  onend: (() => void) | null;
  start(): void;
  stop(): void;
}

interface SpeechRecognitionEventLike {
  resultIndex: number;
  results: ArrayLike<SpeechRecognitionResultLike>;
}

interface SpeechRecognitionErrorEventLike extends Event {
  error?: string;
}

interface SpeechRecognitionResultLike {
  isFinal: boolean;
  0: SpeechRecognitionAlternativeLike;
}

interface SpeechRecognitionAlternativeLike {
  transcript: string;
}

declare global {
  interface Window {
    SpeechRecognition?: SpeechRecognitionCtor;
    webkitSpeechRecognition?: SpeechRecognitionCtor;
  }
}

interface ChatMessage {
  role: 'user' | 'assistant';
  text: string;
  createdAt: Date;
}

@Component({
  selector: 'app-chat-assistant',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, TranslateModule, LinkifyPipe],
  templateUrl: './chat-assistant.component.html',
  styleUrl: './chat-assistant.component.scss'
})
export class ChatAssistantComponent implements OnInit, OnDestroy {
  @ViewChild('messagesContainer') messagesContainer?: ElementRef<HTMLDivElement>;

  private readonly fb = inject(FormBuilder);
  private readonly chatBotService = inject(ChatBotService);
  private readonly translateService = inject(TranslateService);
  private readonly authService = inject(AuthService);
  private readonly router = inject(Router);
  private readonly chatState = inject(ChatAssistantStateService);
  private readonly destroy$ = new Subject<void>();

  private streamSub?: Subscription;
  private resizeStartX = 0;
  private resizeStartWidth = 420;
  private recognition?: SpeechRecognitionLike;
  private voiceBuffer = '';
  private shouldSendAfterStop = false;
  private holdToTalkActive = false;

  isMobile = false;
  isStreaming = false;
  isResizing = false;
  isRecording = false;
  isVoiceArmed = false;
  speechSupported = false;
  chatWidth = 420;
  showVoiceDebug = true;
  voiceDebugLogs: string[] = [];
  voiceStatus = {
    started: false,
    audio: false,
    sound: false,
    speech: false,
    resultCount: 0,
    lastError: ''
  };

  readonly minChatWidth = 320;
  readonly maxChatWidth = 720;

  sessionId = this.createSessionId();
  messages: ChatMessage[] = [];

  form = this.fb.group({
    message: ['', [Validators.required, Validators.maxLength(2000)]]
  });

  get isOpen(): boolean {
    return this.chatState.isOpen();
  }

  constructor() {
    this.messages = [];

    this.applyViewportMode();
    this.chatWidth = this.clampChatWidth(this.chatWidth);
    this.initVoiceInput();
    this.addVoiceLog('init component');
  }

  ngOnInit(): void {
    this.addGreetingMessage();
  }

  ngOnDestroy(): void {
    this.streamSub?.unsubscribe();
    this.recognition?.stop();
    document.body.style.removeProperty('user-select');
    document.body.style.removeProperty('cursor');
    this.destroy$.next();
    this.destroy$.complete();
  }

  toggleOpen(): void {
    this.chatState.toggle();
  }

  startResize(event: MouseEvent): void {
    if (this.isMobile) {
      return;
    }

    event.preventDefault();
    this.isResizing = true;
    this.resizeStartX = event.clientX;
    this.resizeStartWidth = this.chatWidth;
    document.body.style.userSelect = 'none';
    document.body.style.cursor = 'col-resize';
  }

  onResizerKeyDown(event: KeyboardEvent): void {
    if (this.isMobile) {
      return;
    }

    const step = 24;
    if (event.key === 'ArrowLeft') {
      event.preventDefault();
      this.chatWidth = this.clampChatWidth(this.chatWidth + step);
      return;
    }

    if (event.key === 'ArrowRight') {
      event.preventDefault();
      this.chatWidth = this.clampChatWidth(this.chatWidth - step);
    }
  }

  @HostListener('window:resize')
  onWindowResize(): void {
    const wasMobile = this.isMobile;
    this.applyViewportMode();
    this.chatWidth = this.clampChatWidth(this.chatWidth);

    if (wasMobile && !this.isMobile) {
      this.chatState.open();
    }
  }

  @HostListener('document:mousemove', ['$event'])
  onDocumentMouseMove(event: MouseEvent): void {
    if (!this.isResizing) {
      return;
    }

    const deltaX = this.resizeStartX - event.clientX;
    this.chatWidth = this.clampChatWidth(this.resizeStartWidth + deltaX);
  }

  @HostListener('document:mouseup')
  onDocumentMouseUp(): void {
    if (!this.isResizing) {
      return;
    }

    this.isResizing = false;
    document.body.style.removeProperty('user-select');
    document.body.style.removeProperty('cursor');
  }

  startVoiceInput(event: PointerEvent): void {
    if (!this.speechSupported || this.isStreaming) {
      this.addVoiceLog(
        `voice blocked supported=${this.speechSupported} streaming=${this.isStreaming}`
      );
      return;
    }

    if (this.isRecording) {
      return;
    }

    event.preventDefault();
    this.holdToTalkActive = true;

    this.shouldSendAfterStop = false;
    this.voiceBuffer = '';
    this.resetVoiceStatus();
    void this.ensureMicrophonePermission();

    this.form.patchValue({ message: '' });
    this.isVoiceArmed = true;
    this.isRecording = true;

    try {
      this.recognition?.start();
      this.addVoiceLog('recognition.start called (toggle mode)');
    } catch {
      this.isVoiceArmed = false;
      this.isRecording = false;
      this.addVoiceLog('recognition.start failed');
    }
  }

  stopVoiceInput(event: PointerEvent): void {
    if (!this.holdToTalkActive) {
      return;
    }

    event.preventDefault();
    this.holdToTalkActive = false;

    if (!this.isVoiceArmed) {
      return;
    }

    this.isVoiceArmed = false;
    this.shouldSendAfterStop = true;
    this.isRecording = false;
    this.addVoiceLog('recognition.stop requested');

    try {
      this.recognition?.stop();
    } catch {
      this.addVoiceLog('recognition.stop failed -> finalize now');
      this.finalizeVoiceSend();
    }
  }

  @HostListener('document:pointerup', ['$event'])
  onDocumentPointerUp(event: PointerEvent): void {
    if (!this.holdToTalkActive) {
      return;
    }

    this.stopVoiceInput(event);
  }

  @HostListener('document:pointercancel', ['$event'])
  onDocumentPointerCancel(event: PointerEvent): void {
    if (!this.holdToTalkActive) {
      return;
    }

    this.stopVoiceInput(event);
  }

  onEnterKey(event: KeyboardEvent): void {
    if (event.key !== 'Enter' || event.shiftKey) {
      return;
    }
    event.preventDefault();
    this.send();
  }

  send(): void {
    if (this.form.invalid || this.isStreaming) {
      this.addVoiceLog(`send blocked invalid=${this.form.invalid} streaming=${this.isStreaming}`);
      this.form.markAllAsTouched();
      return;
    }

    const message = (this.form.value.message ?? '').trim();
    if (!message) {
      this.addVoiceLog('send blocked empty message');
      return;
    }

    this.addVoiceLog(`send message length=${message.length}`);

    this.messages.push({ role: 'user', text: message, createdAt: new Date() });
    const assistantIndex = this.pushAssistantPlaceholder();

    this.form.reset({ message: '' });
    this.isStreaming = true;
    this.scrollToBottom();

    this.streamSub?.unsubscribe();
    const practitionerId = this.authService.getConnectedPractitionerId();
    const patientId = this.resolvePatientIdForChat();
    const fromUrl = this.resolveCurrentUrl();
    this.streamSub = this.chatBotService
      .stream({
        sessionId: this.sessionId,
        message,
        practitionerId: practitionerId || undefined,
        patientId: patientId || undefined,
        fromUrl: fromUrl || undefined
      })
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (event) => this.handleStreamEvent(event, assistantIndex),
        error: () => {
          this.messages[assistantIndex].text = this.translateService.instant('chatbot.unavailable');
          this.isStreaming = false;
          this.scrollToBottom();
        },
        complete: () => {
          if (!this.messages[assistantIndex].text.trim()) {
            this.messages[assistantIndex].text = this.translateService.instant('chatbot.unavailable');
          }
          this.isStreaming = false;
          this.scrollToBottom();
        }
      });
  }

  private handleStreamEvent(event: ChatStreamEvent, assistantIndex: number): void {
    if (event.type === 'chunk') {
      this.messages[assistantIndex].text += event.content;
      this.scrollToBottom();
      return;
    }

    if (event.type === 'done') {
      this.isStreaming = false;
      this.scrollToBottom();
    }
  }

  private pushAssistantPlaceholder(): number {
    this.messages.push({ role: 'assistant', text: '', createdAt: new Date() });
    return this.messages.length - 1;
  }

  private scrollToBottom(): void {
    setTimeout(() => {
      if (!this.messagesContainer) {
        return;
      }
      const el = this.messagesContainer.nativeElement;
      el.scrollTop = el.scrollHeight;
    });
  }

  private createSessionId(): string {
    if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
      return crypto.randomUUID();
    }
    return `session-${Date.now()}`;
  }

  private resolvePatientIdForChat(): string {
    const routePatientId = this.extractPatientIdFromCurrentUrl();
    if (!routePatientId) {
      return '';
    }

    const raw = sessionStorage.getItem('chat-careplan-context');
    if (!raw) {
      return '';
    }

    try {
      const context = JSON.parse(raw) as {
        source?: string;
        patientId?: string;
        createdAt?: number;
      };

      const isRecent = typeof context.createdAt === 'number' && Date.now() - context.createdAt < 1000 * 60 * 60 * 12;
      const isFromWorklist = context.source === 'careplan-worklist';
      const matchesCurrentPatient = (context.patientId ?? '') === routePatientId;

      return isRecent && isFromWorklist && matchesCurrentPatient ? routePatientId : '';
    } catch {
      return '';
    }
  }

  private extractPatientIdFromCurrentUrl(): string {
    const match = this.router.url.match(/\/my-patients\/([^/?#]+)/);
    return match?.[1] ?? '';
  }

  private resolveCurrentUrl(): string {
    if (typeof window !== 'undefined' && typeof window.location?.href === 'string') {
      return window.location.href;
    }
    return this.router.url;
  }

  private initVoiceInput(): void {
    if (typeof window === 'undefined') {
      return;
    }

    const recognitionCtor = window.SpeechRecognition ?? window.webkitSpeechRecognition;
    if (!recognitionCtor) {
      this.speechSupported = false;
      this.addVoiceLog('speech api unsupported');
      return;
    }

    this.speechSupported = true;
    this.recognition = new recognitionCtor();
    this.recognition.continuous = false;
    this.recognition.interimResults = true;
    this.recognition.maxAlternatives = 1;
    this.recognition.lang = this.resolveRecognitionLang();
    this.addVoiceLog(`speech api ready lang=${this.recognition.lang}`);

    this.recognition.onstart = () => {
      this.voiceStatus.started = true;
      this.addVoiceLog('recognition.onstart');
    };
    this.recognition.onaudiostart = () => {
      this.voiceStatus.audio = true;
      this.addVoiceLog('recognition.onaudiostart');
    };
    this.recognition.onaudioend = () => {
      this.addVoiceLog('recognition.onaudioend');
    };
    this.recognition.onsoundstart = () => {
      this.voiceStatus.sound = true;
      this.addVoiceLog('recognition.onsoundstart');
    };
    this.recognition.onsoundend = () => {
      this.addVoiceLog('recognition.onsoundend');
    };
    this.recognition.onspeechstart = () => {
      this.voiceStatus.speech = true;
      this.addVoiceLog('recognition.onspeechstart');
    };
    this.recognition.onspeechend = () => {
      this.addVoiceLog('recognition.onspeechend');
    };
    this.recognition.onresult = (event) => this.onVoiceResult(event);
    this.recognition.onerror = (event) => {
      this.isRecording = false;
      const speechEvent = event as SpeechRecognitionErrorEventLike;
      this.voiceStatus.lastError = speechEvent.error ?? 'unknown';
      this.addVoiceLog(`recognition.onerror=${speechEvent.error ?? 'unknown'}`);
      if (speechEvent.error === 'aborted' && this.shouldSendAfterStop) {
        this.addVoiceLog('ignore aborted error during pending send');
        return;
      }
      if (this.shouldSendAfterStop) {
        this.finalizeVoiceSend();
      }
    };
    this.recognition.onend = () => {
      this.isRecording = false;
      this.addVoiceLog('recognition.onend');
      if (this.shouldSendAfterStop) {
        this.finalizeVoiceSend();
      }
    };
  }

  private onVoiceResult(event: SpeechRecognitionEventLike): void {
    let finalTranscript = '';
    let interimTranscript = '';
    for (let i = 0; i < event.results.length; i += 1) {
      const chunk = event.results[i]?.[0]?.transcript ?? '';
      if (event.results[i]?.isFinal) {
        finalTranscript += chunk;
      } else {
        interimTranscript += chunk;
      }
    }

    const transcript = `${finalTranscript} ${interimTranscript}`.trim();
    this.voiceBuffer = transcript;
    this.voiceStatus.resultCount += 1;
    this.form.patchValue({ message: transcript });
    this.addVoiceLog(`onresult textLength=${transcript.length}`);
  }

  private resolveRecognitionLang(): string {
    const lang = this.translateService.currentLang;
    if (lang === 'fr') {
      return 'fr-FR';
    }
    if (lang === 'de') {
      return 'de-DE';
    }
    if (lang === 'it') {
      return 'it-IT';
    }
    return 'en-US';
  }

  private addGreetingMessage(): void {
    this.translateService
      .get('chatbot.greeting')
      .pipe(take(1))
      .subscribe((greeting) => {
        const fallbackGreeting = 'Bonjour, je peux vous aider a rechercher un patient, creer un rendez-vous, mettre a jour une identite ou naviguer vers une ressource.';
        const text = greeting === 'chatbot.greeting' ? fallbackGreeting : greeting;
        this.messages.push({ role: 'assistant', text, createdAt: new Date() });
      });
  }

  private finalizeVoiceSend(): void {
    if (!this.shouldSendAfterStop) {
      this.addVoiceLog('finalize skipped shouldSendAfterStop=false');
      return;
    }

    this.shouldSendAfterStop = false;

    const text = (this.voiceBuffer || this.form.value.message || '').trim();
    if (this.isStreaming) {
      this.addVoiceLog('finalize blocked streaming=true');
      return;
    }

    if (!text) {
      this.addVoiceLog('finalize blocked textLength=0');
      this.messages.push({
        role: 'assistant',
        text: this.translateService.instant('chatbot.voiceNoTranscript'),
        createdAt: new Date()
      });
      this.scrollToBottom();
      return;
    }

    this.form.patchValue({ message: text });
    this.addVoiceLog(`finalize sending textLength=${text.length}`);
    this.send();
  }

  private addVoiceLog(message: string): void {
    const ts = new Date().toLocaleTimeString();
    this.voiceDebugLogs = [...this.voiceDebugLogs, `${ts} - ${message}`].slice(-14);
  }

  private resetVoiceStatus(): void {
    this.voiceStatus = {
      started: false,
      audio: false,
      sound: false,
      speech: false,
      resultCount: 0,
      lastError: ''
    };
  }

  private async ensureMicrophonePermission(): Promise<boolean> {
    if (typeof navigator === 'undefined' || !navigator.mediaDevices?.getUserMedia) {
      return true;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      stream.getTracks().forEach((track) => track.stop());
      this.addVoiceLog('microphone permission granted');
      return true;
    } catch {
      this.addVoiceLog('microphone permission denied');
      return false;
    }
  }

  private applyViewportMode(): void {
    if (typeof window === 'undefined') {
      return;
    }

    this.isMobile = window.matchMedia('(max-width: 900px)').matches;
    if (this.isMobile) {
      this.chatState.close();
    }
  }

  private clampChatWidth(width: number): number {
    const maxWidth = this.getMaxAllowedWidth();
    return Math.max(this.minChatWidth, Math.min(width, maxWidth));
  }

  private getMaxAllowedWidth(): number {
    if (typeof window === 'undefined') {
      return this.maxChatWidth;
    }

    return Math.min(this.maxChatWidth, Math.floor(window.innerWidth * 0.75));
  }
}
