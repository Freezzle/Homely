/**
 * Breakpoints de l'application — pendant TypeScript de `src/styles/_breakpoints.css`.
 *
 * Les valeurs DOIVENT rester identiques à celles du `@theme` Tailwind : c'est la seule
 * façon d'éviter qu'une logique responsive en TypeScript diverge du CSS. Toute
 * modification se fait dans les deux fichiers à la fois.
 *
 * Le `- 0.02` des requêtes `max-width` évite la zone morte entre `max-width: 768px` et
 * `min-width: 768px`, qui matcheraient toutes les deux à exactement 768px.
 */
export const BREAKPOINTS = {
  sm: 640,
  md: 768,
  lg: 1024,
  xl: 1280,
  '2xl': 1360,
} as const;

export type NomBreakpoint = keyof typeof BREAKPOINTS;

/** Largeur minimale supportée par l'interface (aucun débordement en dessous de 435px). */
export const LARGEUR_MIN = 435;

/** Largeur maximale du contenu : au-delà, la mise en page reste centrée. */
export const LARGEUR_MAX = BREAKPOINTS['2xl'];

/** Media query « strictement en dessous du breakpoint », en approche mobile-first. */
export function enDessousDe(bp: NomBreakpoint): string {
  return `(max-width: ${BREAKPOINTS[bp] - 0.02}px)`;
}

/** Media query « à partir du breakpoint ». */
export function aPartirDe(bp: NomBreakpoint): string {
  return `(min-width: ${BREAKPOINTS[bp]}px)`;
}
