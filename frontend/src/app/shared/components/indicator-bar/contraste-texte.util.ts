/**
 * Contraste automatique du texte sur un fond coloré résolu (chaîne CSS
 * `rgb(R, G, B)` ou `rgba(R, G, B, A)` telle que retournée par
 * `getComputedStyle(el).backgroundColor`).
 *
 * Utilisée par `IndicatorBarComponent` pour choisir la couleur de texte de la
 * bulle du marqueur en fonction de la couleur de fond effectivement appliquée
 * (peu importe qu'elle provienne d'un token `var(--...)`, d'un hex, d'un rgb,
 * ou du thème sombre — on lit toujours du rgb côté DOM).
 *
 * Retourne `null` si la chaîne n'est pas parsable : l'appelant conserve alors
 * la couleur définie en CSS (fallback silencieux).
 */
export function contrasteTexteDepuisRgb(rgb: string): '#111827' | '#ffffff' | null {
  const m = rgb.match(/^rgba?\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)/i);
  if (!m) return null;
  const r = Number(m[1]);
  const g = Number(m[2]);
  const b = Number(m[3]);
  if (![r, g, b].every((v) => Number.isFinite(v) && v >= 0 && v <= 255)) return null;
  // Luminance perçue (approximation ITU-R BT.601, mêmes coefficients que
  // `couleurTexteContraste()` du util `couleur.util.ts` — cohérent avec les
  // tags membre).
  const luminance = 0.299 * r + 0.587 * g + 0.114 * b;
  return luminance > 170 ? '#111827' : '#ffffff';
}
