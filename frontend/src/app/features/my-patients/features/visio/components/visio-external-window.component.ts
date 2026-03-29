import {
  AfterViewInit,
  Component,
  ElementRef,
  OnDestroy,
  ViewChild,
  inject
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute } from '@angular/router';
import { TranslateModule } from '@ngx-translate/core';
import { environment } from '../../../../../../environments/environment';

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

interface JitsiApi {
  addEventListeners(events: Record<string, (data: unknown) => void>): void;
  dispose(): void;
}

@Component({
  selector: 'app-visio-external-window',
  standalone: true,
  imports: [CommonModule, TranslateModule],
  templateUrl: './visio-external-window.component.html',
  styleUrl: './visio-external-window.component.scss'
})
export class VisioExternalWindowComponent implements AfterViewInit, OnDestroy {
  @ViewChild('jitsiContainer', { static: false }) jitsiContainer?: ElementRef<HTMLDivElement>;

  private readonly route = inject(ActivatedRoute);
  readonly jitsiDomain = environment.jitsiDomain;
  readonly jitsiScriptUrl = environment.jitsiScriptUrl;

  loading = true;
  error = '';
  roomName = '';

  private api: JitsiApi | null = null;
  private scriptLoaded = false;

  ngAfterViewInit(): void {
    this.roomName = this.route.snapshot.paramMap.get('roomName') ?? '';
    const prejoin = this.route.snapshot.queryParamMap.get('prejoin') !== '0';

    if (!this.roomName || !this.jitsiContainer?.nativeElement) {
      this.error = 'visio.error.start';
      this.loading = false;
      return;
    }

    document.title = `${this.roomName} - Visio`;

    this.loadJitsiScript()
      .then(() => {
        this.api = new JitsiMeetExternalAPI(this.jitsiDomain, {
          roomName: this.roomName,
          parentNode: this.jitsiContainer!.nativeElement,
          width: '100%',
          height: '100%',
          configOverwrite: {
            startWithAudioMuted: false,
            startWithVideoMuted: false,
            disableDeepLinking: true,
            prejoinPageEnabled: prejoin,
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
            this.loading = false;
          },
          videoConferenceLeft: () => {
            window.close();
          }
        });
      })
      .catch(() => {
        this.error = 'visio.error.sdkLoad';
        this.loading = false;
      });
  }

  ngOnDestroy(): void {
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
}
