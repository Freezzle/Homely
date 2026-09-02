import { localeDeLangue } from '../../../core/i18n/locale.util';

/**
 * Formatage des montants pour l'écran « Comparaison de scénarios »
 * (docs/features/feature_5_bis.md §11) — sans exception :
 *
 * - Locale = celle de l'utilisateur (via `localeDeLangue`), zéro décimale,
 *   arrondi à l'entier le plus proche (`Math.round`).
 * - Signe explicite : `+` si `> 0`, `−` (U+2212, moins typographique) si `< 0`,
 *   rien si nul.
 * - Un écart dont la valeur absolue est `< 0.01` est traité comme **nul**
 *   partout (retourne le tiret cadratin `—`).
 * - La devise n'est pas incluse dans la chaîne — elle est ajoutée séparément
 *   par le composant appelant (dans une infobulle, une colonne, etc.).
 */
export const TIRET_NUL = '—';
export const MOINS_TYPO = '\u2212';
export const SEUIL_NUL = 0.01;

export function estNul(valeur: number): boolean {
  return Math.abs(valeur) < SEUIL_NUL;
}

/** Signe qualitatif d'un écart, pour piloter les classes de couleur. */
export type SigneEcart = 'positif' | 'negatif' | 'nul';

export function signeEcart(valeur: number): SigneEcart {
  if (estNul(valeur)) return 'nul';
  return valeur > 0 ? 'positif' : 'negatif';
}

/**
 * Formate un montant **non signé** (chiffres seuls, sans `+`/`−` explicite,
 * mais U+2212 comme séparateur négatif — c'est le comportement natif Intl
 * avec locale fr-CH). Retourne `—` si le montant est traité comme nul.
 */
export function formatMontant(valeur: number, langue: string | null | undefined): string {
  if (estNul(valeur)) return TIRET_NUL;
  return new Intl.NumberFormat(localeDeLangue(langue), {
    maximumFractionDigits: 0,
    minimumFractionDigits: 0,
  }).format(Math.round(valeur));
}

/**
 * Formate un écart avec **signe explicite** : `+` si positif strict, `−` si
 * négatif strict, `—` si nul. Utilisé pour toutes les colonnes/lignes
 * d'écart de l'écran.
 */
export function formatMontantSigne(valeur: number, langue: string | null | undefined): string {
  if (estNul(valeur)) return TIRET_NUL;
  const abs = new Intl.NumberFormat(localeDeLangue(langue), {
    maximumFractionDigits: 0,
    minimumFractionDigits: 0,
  }).format(Math.round(Math.abs(valeur)));
  return valeur > 0 ? `+${abs}` : `${MOINS_TYPO}${abs}`;
}

/**
 * Formate un pourcentage d'évolution signé avec une décimale (utilisé par
 * `IndicateurEcartComponent`, §4). Retourne `—` si nul.
 */
export function formatPourcentageSigne(valeur: number, langue: string | null | undefined): string {
  if (estNul(valeur)) return TIRET_NUL;
  const abs = new Intl.NumberFormat(localeDeLangue(langue), {
    maximumFractionDigits: 1,
    minimumFractionDigits: 1,
  }).format(Math.abs(valeur));
  return valeur > 0 ? `+${abs}\u00A0%` : `${MOINS_TYPO}${abs}\u00A0%`;
}
