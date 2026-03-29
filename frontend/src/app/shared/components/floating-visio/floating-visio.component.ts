import {
  AfterViewInit,
  Component,
  ElementRef,
  HostListener,
  ViewChild,
  effect,
  inject
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { TranslateModule } from '@ngx-translate/core';
import { environment } from '../../../../environments/environment';
import { VisioFloatingService } from '../../../core/services/visio-floating.service';

declare const JitsiMeetExternalAPI: new (domain: string, options: JitsiOptions) => JitsiApi;

interface JitsiOptions {
  roomName: string;
  parentNode: HTMLElement;
  width: string | number;
  height: string | number;
  configOverwrite: Record<string, unknown>;
  interfaceConfigOverwrite: Record<string, unknown>;
  lang?: string;
}

interface JitsiParticipant {
  id: string;
}

interface JitsiApi {
  addEventListeners(events: Record<string, (data: unknown) => void>): void;
  executeCommand(command: string, ...args: unknown[]): void;
  getParticipantsInfo(): JitsiParticipant[];
  dispose(): void;
}

@Component({
  selector: 'app-floating-visio',
  standalone: true,
  imports: [CommonModule, TranslateModule],
  templateUrl: './floating-visio.component.html',
  styleUrl: './floating-visio.component.scss'
})
export class FloatingVisioComponent implements AfterViewInit {
  @ViewChild('jitsiContainer', { static: false }) jitsiContainer?: ElementRef<HTMLDivElement>;

  readonly floating = inject(VisioFloatingService);
  readonly jitsiDomain = environment.jitsiDomain;
  readonly jitsiScriptUrl = environment.jitsiScriptUrl;

  width = 460;
  height = 300;
  left = 16;
  top = 16;
  isExpanded = true;

  private api: JitsiApi | null = null;
  private scriptLoaded = false;
  private dragging = false;
  private resizing = false;
  private resizeDirection: 'bottom-right' | 'top-left' = 'bottom-right';
  private dragOffsetX = 0;
  private dragOffsetY = 0;
  private resizeStartX = 0;
  private resizeStartY = 0;
  private resizeStartLeft = 0;
  private resizeStartTop = 0;
  private resizeStartWidth = 0;
  private resizeStartHeight = 0;

  constructor() {
    effect(() => {
      const requestId = this.floating.requestId();
      if (requestId > 0) {
        this.applyExpandedLayout();
        queueMicrotask(() => this.startFloatingConference());
      }
    });

    effect(() => {
      if (!this.floating.isOpen()) {
        this.disposeApi();
      }
    });
  }

  ngAfterViewInit(): void {
    this.resetDefaultPosition();
  }

  @HostListener('window:resize')
  onWindowResize(): void {
    this.keepWindowInViewport();
  }

  @HostListener('document:mousemove', ['$event'])
  onMouseMove(event: MouseEvent): void {
    if (this.dragging) {
      this.left = event.clientX - this.dragOffsetX;
      this.top = event.clientY - this.dragOffsetY;
      this.keepWindowInViewport();
      return;
    }

    if (this.resizing) {
      if (this.resizeDirection === 'bottom-right') {
        const nextWidth = this.resizeStartWidth + (event.clientX - this.resizeStartX);
        const nextHeight = this.resizeStartHeight + (event.clientY - this.resizeStartY);
        this.width = Math.min(Math.max(nextWidth, 260), window.innerWidth - 16);
        this.height = Math.min(Math.max(nextHeight, 160), window.innerHeight - 16);
      } else {
        const right = this.resizeStartLeft + this.resizeStartWidth;
        const bottom = this.resizeStartTop + this.resizeStartHeight;
        const nextLeft = Math.min(
          Math.max(8, this.resizeStartLeft + (event.clientX - this.resizeStartX)),
          right - 260
        );
        const nextTop = Math.min(
          Math.max(8, this.resizeStartTop + (event.clientY - this.resizeStartY)),
          bottom - 160
        );

        this.left = nextLeft;
        this.top = nextTop;
        this.width = Math.min(Math.max(right - nextLeft, 260), window.innerWidth - 8);
        this.height = Math.min(Math.max(bottom - nextTop, 160), window.innerHeight - 8);
      }
      this.keepWindowInViewport();
    }
  }

  @HostListener('document:mouseup')
  onMouseUp(): void {
    this.dragging = false;
    this.resizing = false;
  }

  startDrag(event: MouseEvent): void {
    event.preventDefault();
    this.dragging = true;
    this.dragOffsetX = event.clientX - this.left;
    this.dragOffsetY = event.clientY - this.top;
  }

  startResize(event: MouseEvent, direction: 'bottom-right' | 'top-left' = 'bottom-right'): void {
    event.preventDefault();
    this.resizing = true;
    this.resizeDirection = direction;
    this.resizeStartX = event.clientX;
    this.resizeStartY = event.clientY;
    this.resizeStartLeft = this.left;
    this.resizeStartTop = this.top;
    this.resizeStartWidth = this.width;
    this.resizeStartHeight = this.height;
  }

  toggleMute(): void {
    this.api?.executeCommand('toggleAudio');
  }

  openInNewWindow(): void {
    const roomName = this.floating.roomName();
    if (!roomName) {
      return;
    }

    const prejoin = this.floating.inCall() ? '0' : '1';
    const popupUrl = `${window.location.origin}/visio/window/${encodeURIComponent(roomName)}?prejoin=${prejoin}`;
    const popup = window.open(
      popupUrl,
      '_blank',
      'popup=yes,width=1440,height=900,resizable=yes,scrollbars=no'
    );

    if (!popup) {
      return;
    }

    this.closeFloating();
  }

  closeFloating(): void {
    this.api?.executeCommand('hangup');
    this.disposeApi();
    this.floating.close();
  }

  private startFloatingConference(): void {
    if (!this.floating.isOpen() || !this.jitsiContainer?.nativeElement) {
      return;
    }

    const roomName = this.floating.roomName();
    if (!roomName) {
      this.floating.setError('visio.error.start');
      return;
    }

    this.floating.setLoading();
    this.loadJitsiScript()
      .then(() => {
        this.disposeApi();
        this.api = new JitsiMeetExternalAPI(this.jitsiDomain, {
          roomName,
          parentNode: this.jitsiContainer!.nativeElement,
          width: '100%',
          height: '100%',
          configOverwrite: {
            startWithAudioMuted: false,
            startWithVideoMuted: false,
            disableDeepLinking: true,
            prejoinPageEnabled: true,
            enableNoisyMicDetection: false
          },
          interfaceConfigOverwrite: {
            SHOW_JITSI_WATERMARK: false,
            SHOW_WATERMARK_FOR_GUESTS: false,
            SHOW_BRAND_WATERMARK: false,
            MOBILE_APP_PROMO: false
          },
          lang: 'fr'
        });

        this.api.addEventListeners({
          videoConferenceJoined: () => {
            this.floating.setConnected();
            this.refreshParticipants();
            this.applyDockedLayout();
          },
          videoConferenceLeft: () => {
            this.floating.close();
            this.disposeApi();
          },
          participantJoined: () => this.refreshParticipants(),
          participantLeft: () => this.refreshParticipants(),
          audioMuteStatusChanged: (data: unknown) => {
            const event = data as { muted: boolean };
            this.floating.setMuted(event.muted);
          }
        });
      })
      .catch(() => this.floating.setError('visio.error.sdkLoad'));
  }

  private refreshParticipants(): void {
    if (!this.api) {
      return;
    }
    const raw = this.api.getParticipantsInfo();
    const unique = new Set<string>();
    raw.forEach(p => unique.add(p.id));
    this.floating.updateParticipantCount(unique.size);
  }

  private loadJitsiScript(): Promise<void> {
    if (this.scriptLoaded || typeof JitsiMeetExternalAPI !== 'undefined') {
      this.scriptLoaded = true;
      return Promise.resolve();
    }

    return new Promise<void>((resolve, reject) => {
      const existing = document.querySelector(`script[src="${this.jitsiScriptUrl}"]`);
      if (existing) {
        this.scriptLoaded = true;
        resolve();
        return;
      }

      const script = document.createElement('script');
      script.src = this.jitsiScriptUrl;
      script.async = true;
      script.onload = () => {
        this.scriptLoaded = true;
        resolve();
      };
      script.onerror = () => reject(new Error('Jitsi script load failed'));
      document.head.appendChild(script);
    });
  }

  private resetDefaultPosition(): void {
    this.applyDockedLayout();
  }

  private applyExpandedLayout(): void {
    this.isExpanded = true;
    this.width = Math.min(920, Math.max(560, window.innerWidth - 72));
    this.height = Math.min(720, Math.max(420, window.innerHeight - 120));
    this.left = Math.max(8, Math.round((window.innerWidth - this.width) / 2));
    this.top = Math.max(8, Math.round((window.innerHeight - this.height) / 2));
    this.keepWindowInViewport();
  }

  private applyDockedLayout(): void {
    this.isExpanded = false;
    this.width = Math.min(460, Math.max(320, window.innerWidth - 24));
    this.height = Math.min(300, Math.max(200, Math.round(this.width * 0.65)));
    this.left = Math.max(8, window.innerWidth - this.width - 16);
    this.top = Math.max(8, window.innerHeight - this.height - 16);
    this.keepWindowInViewport();
  }

  private keepWindowInViewport(): void {
    this.width = Math.min(this.width, window.innerWidth - 8);
    this.height = Math.min(this.height, window.innerHeight - 8);
    this.left = Math.min(Math.max(8, this.left), Math.max(8, window.innerWidth - this.width - 8));
    this.top = Math.min(Math.max(8, this.top), Math.max(8, window.innerHeight - this.height - 8));
  }

  private disposeApi(): void {
    if (!this.api) {
      return;
    }
    try {
      this.api.dispose();
    } catch {
      // ignore
    }
    this.api = null;
  }
}
