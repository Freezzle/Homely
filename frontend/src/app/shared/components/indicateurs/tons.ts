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

/** Variante foncée pour une **surface** portant du texte blanc (contraste WCAG, ex.
 *  cellules de heatmap). Pour colorer du *texte*, utiliser `couleurTexte`. */
export function couleurForte(ton: TonIndicateur): string {
  return `color-mix(in srgb, ${couleursTon(ton).plein} 70%, #000)`;
}

/**
 * Part de couleur conservée pour `couleurTexte` (le reste vient de
 * `--app-contraste-texte`). 45 % est la valeur la plus claire qui tienne le **contraste
 * WCAG AA (≥ 4,5:1)** sur tous les tons posés sur leur propre fond doux, dans les deux
 * thèmes — le jaune `attention` étant le cas limite en clair (5,27:1 à 45 %, contre
 * 1,17:1 avec la couleur pleine).
 */
const PART_COULEUR_TEXTE = 45;

/**
 * Couleur d'un **texte coloré** : badge de `app-carte-info`, `app-tag [ton]`,
 * `app-badge-delta`, libellé de `app-indicateur-niveau`.
 *
 * La couleur pleine est pensée pour des **surfaces** (barres, segments, pastilles) ; en
 * texte elle n'a pas un contraste suffisant. Ne jamais utiliser `couleurPleine` ni
 * `couleurForte` comme `color` d'un libellé — utiliser cette fonction.
 *
 * Le mélange se fait vers `--app-contraste-texte` (noir en clair, blanc en sombre), la
 * couleur reste donc lisible dans les deux thèmes. `neutre` est déjà une couleur d'encre :
 * il est renvoyé tel quel.
 */
export function couleurTexte(ton: TonIndicateur): string {
  const { plein } = couleursTon(ton);
  if (ton === 'neutre') return plein;
  return `color-mix(in srgb, ${plein} ${PART_COULEUR_TEXTE}%, var(--app-contraste-texte))`;
}

/**
 * Surface translucide dérivée d'un ton (barres d'entonnoir, zones d'écart, segments
 * empilés). Le mélange se fait avec `transparent` : la surface se pose sur le fond de la
 * carte, en thème clair comme en thème sombre.
 */
export function couleurSurface(ton: TonIndicateur, pourcent: number): string {
  const part = Math.min(Math.max(pourcent, 0), 100);
  return `color-mix(in srgb, ${couleursTon(ton).plein} ${part}%, transparent)`;
}

/** Intensité de surface d'un élément portant son propre ton (entonnoir). */
export const OPACITE_SURFACE_TON_PROPRE = 28;

/**
 * Intensité de surface des segments empilés : plus soutenue que celle de l'entonnoir, car
 * les tranches d'une barre sont fines et doivent rester distinctes les unes des autres.
 */
export const OPACITE_SURFACE_SEGMENT = 65;

/** Ton de la palette catégorielle pour un index (bouclage au-delà de 10). */
export function tonCategorie(index: number): TonCategorie {
  const n = ((Math.trunc(index) % NB_TONS_CATEGORIE) + NB_TONS_CATEGORIE) % NB_TONS_CATEGORIE;
  return `categorie-${n + 1}` as TonCategorie;
}
