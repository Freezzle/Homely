/**
 * Projette une valeur sur une échelle `[min, max]` et la borne à `[0, 100]`.
 *
 * Pont recommandé entre les valeurs métier (l'appelant raisonne en unités) et
 * le composant `IndicatorBar` (qui raisonne en pourcentages). Fonction pure,
 * volontairement placée hors du composant : le composant ne connaît pas la
 * notion d'échelle.
 *
 * Comportements de bord :
 * - `!Number.isFinite(value)` (NaN, ±Infinity) ⇒ `0`
 * - `min === max` ⇒ `0` (échelle dégénérée : pas de projection possible)
 * - valeur sous `min` ⇒ `0` ; au-dessus de `max` ⇒ `100`
 * - `min > max` toléré : la borne reste appliquée sur `[0, 100]`
 */
export function toPercent(value: number, min: number, max: number): number {
  if (!Number.isFinite(value) || max === min) {
    return 0;
  }
  return Math.min(100, Math.max(0, ((value - min) / (max - min)) * 100));
}
