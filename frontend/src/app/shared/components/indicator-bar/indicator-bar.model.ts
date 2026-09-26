/**
 * Modèles publics du composant `IndicatorBar` (barre à zones ou de répartition)
 * et de son enveloppe `IndicatorCard`.
 *
 * Voir `docs/features/feature.md` §3.1. Ces types sont volontairement
 * agnostiques du domaine métier : le composant reçoit des pourcentages déjà
 * calculés (utiliser `toPercent()` de `to-percent.util.ts` comme pont).
 */

/** Raccourci sémantique de couleur, résolu via les jetons CSS du composant. */
export type IndicatorVariant = 'good' | 'warn' | 'bad' | 'neutral';

/** Style d'une bulle (`marker`) posée au-dessus de la barre. */
export type MarkerKind =
  /** Pastille pleine + tige épaisse : la valeur de l'indicateur. */
  | 'primary'
  /** Pastille contournée + tige pointillée : objectif, scénario, moyenne. */
  | 'reference'
  /** Texte seul, sans tige : étiquette de segment (usage « répartition »). */
  | 'plain';

export interface IndicatorSegment {
  /** Largeur du segment, en % de la barre. */
  widthPercent: number;
  /** Couleur libre (prioritaire sur `variant`). Toute valeur CSS valide. */
  color?: string;
  /** Raccourci de couleur, résolu via les jetons CSS du composant. */
  variant?: IndicatorVariant;
  /** Libellé lu par les technologies d'assistance (ex. « zone à risque »). */
  a11yLabel?: string;
}

export interface IndicatorTick {
  /** Position sur la barre, en % (0 = bord gauche, 100 = bord droit). */
  positionPercent: number;
  /** Étiquette sous la barre. Absente = trait seul, sans texte. */
  label?: string;
}

export interface IndicatorMarker {
  /** Position sur la barre, en % (bornée à [0, 100] au rendu). */
  positionPercent: number;
  /** Texte de la bulle. Absent = tige seule. */
  label?: string;
  /** Défaut : `'primary'`. */
  kind?: MarkerKind;
  /** Couleur libre (prioritaire sur `variant`). */
  color?: string;
  /** Défaut : `'neutral'`. */
  variant?: IndicatorVariant;
  /** Description longue pour l'accessibilité (ex. « valeur du mois : 15,3 % »). */
  a11yLabel?: string;
}
