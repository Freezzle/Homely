import { Injectable, signal, DestroyRef, inject, WritableSignal } from '@angular/core';
import { BREAKPOINTS, enDessousDe } from '../layout/breakpoints';

/**
 * Détecte les breakpoints viewport utiles à l'application.
 * - `estMobile` : sous le breakpoint `md` (768px)
 * - `estCompact` : sous le breakpoint `lg` (1024px) — mobile + tablette
 * - `estLarge` : à partir du breakpoint `xl` (1280px)
 *
 * Les seuils proviennent de `core/layout/breakpoints.ts`, miroir du `@theme` Tailwind
 * défini dans `src/styles/_breakpoints.css` : aucune valeur n'est écrite en dur ici, afin
 * que la logique responsive TypeScript ne puisse pas diverger du CSS.
 *
 * Les signaux restent synchronisés via `matchMedia` — pas de localStorage.
 */
@Injectable({ providedIn: 'root' })
export class ViewportService {
  private readonly mobileMql = ViewportService.creerMql(enDessousDe('md'));
  private readonly compactMql = ViewportService.creerMql(enDessousDe('lg'));
  private readonly largeMql = ViewportService.creerMql(`(min-width: ${BREAKPOINTS.xl}px)`);

  readonly estMobile = signal<boolean>(this.mobileMql?.matches ?? false);
  readonly estCompact = signal<boolean>(this.compactMql?.matches ?? false);
  readonly estLarge = signal<boolean>(this.largeMql?.matches ?? false);

  constructor() {
    const destroyRef = inject(DestroyRef);
    this.suivre(destroyRef, this.mobileMql, this.estMobile);
    this.suivre(destroyRef, this.compactMql, this.estCompact);
    this.suivre(destroyRef, this.largeMql, this.estLarge);
  }

  private static creerMql(query: string): MediaQueryList | null {
    return typeof window !== 'undefined' ? window.matchMedia(query) : null;
  }

  private suivre(
    destroyRef: DestroyRef,
    mql: MediaQueryList | null,
    cible: WritableSignal<boolean>,
  ): void {
    if (!mql) {
      return;
    }
    const handler = (e: MediaQueryListEvent) => cible.set(e.matches);
    mql.addEventListener('change', handler);
    destroyRef.onDestroy(() => mql.removeEventListener('change', handler));
  }
}

