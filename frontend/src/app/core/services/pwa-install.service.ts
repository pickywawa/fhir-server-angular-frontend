import { Injectable, signal } from '@angular/core';

@Injectable({
  providedIn: 'root'
})
export class PwaInstallService {
  private readonly dismissStorageKey = 'healthapp.pwa-dismissed-until';
  private readonly dismissDurationMs = 1000 * 60 * 60 * 24 * 3;
  private deferredPrompt: any = null;

  readonly isAvailable = signal(false);
  readonly isInstalled = signal(false);
  readonly isMobile = signal(false);
  readonly isDismissed = signal(false);

  constructor() {
    this.initialize();
  }

  private initialize(): void {
    // Détection mobile
    const isMobile = this.checkMobileDevice();
    this.isMobile.set(isMobile);

    // Détection si app déjà installée
    const isInstalled = this.checkIfInstalled();
    this.isInstalled.set(isInstalled);

    // Vérifier si le dismiss temporaire est encore actif
    const isDismissed = this.isDismissActive();
    this.isDismissed.set(isDismissed);

    // Sur mobile et pas installé et pas dismissé: afficher le banneau
    if (isMobile && !isInstalled && !isDismissed) {
      // Afficher immédiatement (sera aussi affiché si beforeinstallprompt se déclenche)
      this.isAvailable.set(true);
    }

    // Écouter l'événement beforeinstallprompt (Android principalement)
    window.addEventListener('beforeinstallprompt', (e: any) => {
      e.preventDefault();
      this.deferredPrompt = e;
      console.log('[PWA] beforeinstallprompt triggered');

      // Réaffirmer qu'on peut installer
      if (isMobile && !this.isInstalled() && !this.isDismissed()) {
        this.isAvailable.set(true);
      }
    });

    // Écouter l'événement app-installed
    window.addEventListener('appinstalled', () => {
      this.isInstalled.set(true);
      this.isAvailable.set(false);
      this.clearDismiss();
    });
  }

  private isDismissActive(): boolean {
    try {
      const raw = localStorage.getItem(this.dismissStorageKey);
      if (!raw) {
        return false;
      }

      const dismissUntil = Number(raw);
      if (!Number.isFinite(dismissUntil)) {
        localStorage.removeItem(this.dismissStorageKey);
        return false;
      }

      if (Date.now() >= dismissUntil) {
        localStorage.removeItem(this.dismissStorageKey);
        return false;
      }

      return true;
    } catch {
      return false;
    }
  }

  private clearDismiss(): void {
    try {
      localStorage.removeItem(this.dismissStorageKey);
    } catch {
      // Ignore storage errors
    }
  }

  private checkMobileDevice(): boolean {
    // Détection user-agent mobile
    const userAgent = navigator.userAgent || navigator.vendor || (window as any).opera;
    const mobileRegex = /android|webos|iphone|ipad|ipod|blackberry|iemobile|opera mini/i;
    return mobileRegex.test(userAgent.toLowerCase());
  }

  private checkIfInstalled(): boolean {
    // Vérification si app en mode installed
    // Sur iOS: navigator.standalone
    // Sur Android: display-mode media query ou theme-color
    if ((navigator as any).standalone === true) {
      return true;
    }

    // Vérifier display-mode media query
    if (window.matchMedia('(display-mode: standalone)').matches) {
      return true;
    }

    // Sur iOS Safari, vérifier si affichée en mode fullscreen
    if ((navigator as any).standalone === true) {
      return true;
    }

    return false;
  }

  async install(): Promise<void> {
    if (!this.deferredPrompt) {
      // iOS Safari n'expose pas beforeinstallprompt: afficher une instruction utilisateur.
      if (this.isMobile() && !this.isInstalled()) {
        window.alert("Sur iPhone/iPad: Safari > Partager > 'Sur l'ecran d'accueil'.");
      }
      console.warn('Install prompt not available');
      return;
    }

    try {
      this.deferredPrompt.prompt();
      const { outcome } = await this.deferredPrompt.userChoice;

      if (outcome === 'accepted') {
        this.isInstalled.set(true);
        this.isAvailable.set(false);
        this.clearDismiss();
      } else {
        // Utilisateur a refusé mais il peut réessayer
      }

      this.deferredPrompt = null;
    } catch (error) {
      console.error('Install error:', error);
    }
  }

  dismiss(): void {
    try {
      localStorage.setItem(this.dismissStorageKey, String(Date.now() + this.dismissDurationMs));
    } catch {
      // Ignore storage errors
    }
    this.isDismissed.set(true);
    this.isAvailable.set(false);
  }

  undismiss(): void {
    this.clearDismiss();
    this.isDismissed.set(false);

    // Re-vérifier si disponible
    if (this.isMobile() && !this.isInstalled() && this.deferredPrompt) {
      this.isAvailable.set(true);
    }
  }

  get canShow(): boolean {
    return this.isAvailable() && this.isMobile() && !this.isInstalled() && !this.isDismissed();
  }
}
