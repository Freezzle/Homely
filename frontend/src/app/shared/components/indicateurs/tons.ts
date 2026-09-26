/**
 * Tons (presets de couleur) des cartes d'info et des indicateurs.
 *
 * Seuls ces presets sont acceptés par `app-carte-info` et les `app-indicateur-*` :
 * aucune valeur CSS libre, pour garantir la cohérence avec la charte `--app-*`
 * (voir styles/_app-tokens.css) et le dark mode.
 */
export type TonSemantique =
  | 'neutre'
  | 'info'
  | 'succes'
  | 'attention'
  | 'alerte'
  | 'danger'
  | 'revenu'
  | 'charge'
  | 'reserve'
  | 'argent-poche';

export const NB_TONS_CATEGORIE = 10;

/** Tons de la palette catégorielle (`--app-categorie-1..10`). */
export type TonCategorie =
  | 'categorie-1' | 'categorie-2' | 'categorie-3' | 'categorie-4' | 'categorie-5'
  | 'categorie-6' | 'categorie-7' | 'categorie-8' | 'categorie-9' | 'categorie-10';

/** Ton d'en-tête / de badge d'une carte. */
export type TonCarte = TonSemantique;

/** Ton d'un élément d'indicateur (barre, segment, cellule, pastille de légende). */
export type TonIndicateur = TonSemantique | TonCategorie;

interface CouleursTon {
  /** Couleur pleine (barre surlignée, segment, pastille, texte de badge). */
  plein: string;
  /** Fond doux opaque (en-tête de carte, barres atténuées). */
  doux: string;
}

const SEMANTIQUES: Record<TonSemantique, CouleursTon> = {
  neutre: { plein: 'var(--app-ink-muted)', doux: 'var(--app-line-2)' },
  info: { plein: 'var(--app-info)', doux: 'var(--app-info-bg)' },
  succes: { plein: 'var(--app-success)', doux: 'var(--app-success-bg)' },
  attention: { plein: 'var(--app-warning)', doux: 'var(--app-warning-bg)' },
  alerte: { plein: 'var(--app-alert)', doux: 'var(--app-alert-bg)' },
  danger: { plein: 'var(--app-danger)', doux: 'var(--app-danger-bg)' },
  revenu: { plein: 'var(--app-revenu)', doux: 'var(--app-revenu-bg)' },
  charge: { plein: 'var(--app-charge)', doux: 'var(--app-charge-bg)' },
  reserve: { plein: 'var(--app-reserve)', doux: 'var(--app-reserve-bg)' },
  'argent-poche': { plein: 'var(--app-argent-poche)', doux: 'var(--app-argent-poche-bg)' },
};

function couleursTon(ton: TonIndicateur): CouleursTon {
  if (ton in SEMANTIQUES) return SEMANTIQUES[ton as TonSemantique];
  const variable = `var(--app-${ton})`;
  return { plein: variable, doux: `color-mix(in srgb, ${variable} 20%, var(--app-card))` };
}

export function couleurPleine(ton: TonIndicateur): string {
  return couleursTon(ton).plein;
}

export function couleurDouce(ton: TonIndicateur): string {
  return couleursTon(ton).doux;
}

/** Variante foncée pour un fond portant du texte blanc (contraste WCAG, ex. heatmap). */
export function couleurForte(ton: TonIndicateur): string {
  return `color-mix(in srgb, ${couleursTon(ton).plein} 70%, #000)`;
}

/** Ton de la palette catégorielle pour un index (bouclage au-delà de 10). */
export function tonCategorie(index: number): TonCategorie {
  const n = ((Math.trunc(index) % NB_TONS_CATEGORIE) + NB_TONS_CATEGORIE) % NB_TONS_CATEGORIE;
  return `categorie-${n + 1}` as TonCategorie;
}
