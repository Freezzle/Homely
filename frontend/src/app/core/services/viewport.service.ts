import { Injectable, signal, DestroyRef, inject } from '@angular/core';

/**
 * Détecte si le viewport courant est de taille "mobile" (< 768 px = breakpoint md Tailwind).
 * Le signal `estMobile` reste synchronisé via `matchMedia` — pas de localStorage.
 */
@Injectable({ providedIn: 'root' })
export class ViewportService {
  private readonly mql: MediaQueryList | null =
    typeof window !== 'undefined' ? window.matchMedia('(max-width: 767.98px)') : null;

  readonly estMobile = signal<boolean>(this.mql?.matches ?? false);

  constructor() {
    if (!this.mql) return;
    const handler = (e: MediaQueryListEvent) => this.estMobile.set(e.matches);
    this.mql.addEventListener('change', handler);
    inject(DestroyRef).onDestroy(() => this.mql?.removeEventListener('change', handler));
  }
}

