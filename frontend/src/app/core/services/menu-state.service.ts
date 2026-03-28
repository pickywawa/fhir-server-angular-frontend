import { Injectable, signal } from '@angular/core';

@Injectable({ providedIn: 'root' })
export class MenuStateService {
  readonly isOpen = signal(false);

  toggle(): void {
    this.isOpen.update((value) => !value);
  }

  close(): void {
    this.isOpen.set(false);
  }
}
