import { Injectable, signal } from '@angular/core';

@Injectable({
  providedIn: 'root'
})
export class VisioFloatingService {
  readonly isOpen = signal(false);
  readonly inCall = signal(false);
  readonly loading = signal(false);
  readonly roomName = signal('');
  readonly participantCount = signal(0);
  readonly isMuted = signal(false);
  readonly error = signal('');
  readonly requestId = signal(0);

  open(roomName: string): void {
    this.roomName.set(roomName);
    this.error.set('');
    this.isMuted.set(false);
    this.participantCount.set(0);
    this.loading.set(true);
    this.inCall.set(false);
    this.isOpen.set(true);
    this.requestId.update(v => v + 1);
  }

  setConnected(): void {
    this.loading.set(false);
    this.inCall.set(true);
    this.error.set('');
  }

  setLoading(): void {
    this.loading.set(true);
  }

  setError(errorKey: string): void {
    this.error.set(errorKey);
    this.loading.set(false);
    this.inCall.set(false);
  }

  updateParticipantCount(count: number): void {
    this.participantCount.set(count);
  }

  setMuted(muted: boolean): void {
    this.isMuted.set(muted);
  }

  close(): void {
    this.isOpen.set(false);
    this.loading.set(false);
    this.inCall.set(false);
    this.error.set('');
    this.participantCount.set(0);
    this.isMuted.set(false);
  }
}
