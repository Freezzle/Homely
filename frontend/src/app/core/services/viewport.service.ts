import { Injectable, signal, DestroyRef, inject } from '@angular/core';

/**
 * Détecte les breakpoints viewport utiles à l'application.
 * - `estMobile` : < 768 px (breakpoint md Tailwind)
 * - `estCompact` : < 1024 px (mobile + tablette, breakpoint lg Tailwind)
 * Les signaux restent synchronisés via `matchMedia` — pas de localStorage.
 */
@Injectable({ providedIn: 'root' })
export class ViewportService {
  private readonly mobileMql: MediaQueryList | null =
    typeof window !== 'undefined' ? window.matchMedia('(max-width: 767.98px)') : null;
  private readonly compactMql: MediaQueryList | null =
    typeof window !== 'undefined' ? window.matchMedia('(max-width: 1023.98px)') : null;

  readonly estMobile = signal<boolean>(this.mobileMql?.matches ?? false);
  readonly estCompact = signal<boolean>(this.compactMql?.matches ?? false);

  constructor() {
    const destroyRef = inject(DestroyRef);

    if (this.mobileMql) {
      const mobileHandler = (e: MediaQueryListEvent) => this.estMobile.set(e.matches);
      this.mobileMql.addEventListener('change', mobileHandler);
      destroyRef.onDestroy(() => this.mobileMql?.removeEventListener('change', mobileHandler));
    }

    if (this.compactMql) {
      const compactHandler = (e: MediaQueryListEvent) => this.estCompact.set(e.matches);
      this.compactMql.addEventListener('change', compactHandler);
      destroyRef.onDestroy(() => this.compactMql?.removeEventListener('change', compactHandler));
    }
  }
}

