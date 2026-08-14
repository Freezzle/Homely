/**
 * Résolution runtime des tokens de la charte graphique (`--app-*`).
 *
 * Chart.js dessine sur un `<canvas>` et ne résout pas les CSS custom
 * properties. On ne peut donc pas passer `var(--app-revenu)` comme
 * couleur de dataset — il faut résoudre la valeur en amont.
 *
 * Attention : `getComputedStyle(el).getPropertyValue('--app-revenu')`
 * retourne la valeur **déclarée** (par ex. `"var(--p-primary-color)"`)
 * sans résoudre les `var()`. Le preset Material de PrimeNG utilise en
 * plus `light-dark(...)`, ce qui rend une résolution récursive fragile.
 *
 * Astuce : on applique la couleur sur une "propriété réelle" (`color`)
 * d'un élément caché, puis on lit `getComputedStyle(el).color` — le
 * navigateur retourne un `rgb(...)` / `rgba(...)` totalement résolu,
 * quels que soient le nombre d'indirections et `light-dark()`.
 */

let probe: HTMLDivElement | null = null;

function ensureProbe(): HTMLDivElement | null {
  if (typeof document === 'undefined') return null;
  if (probe && probe.isConnected) return probe;
  probe = document.createElement('div');
  probe.style.cssText = 'position:absolute;left:-9999px;top:-9999px;width:0;height:0;pointer-events:none;';
  probe.setAttribute('aria-hidden', 'true');
  document.body.appendChild(probe);
  return probe;
}

/** Résout un token de la charte (`--app-…`) en couleur littérale
 *  (`rgb(...)` / `rgba(...)`). Retourne `fallback` si le DOM n'est pas
 *  disponible ou si la couleur ne peut pas être calculée. */
export function resolveAppColor(name: string, fallback: string): string {
  const el = ensureProbe();
  if (!el) return fallback;
  el.style.color = '';
  el.style.color = `var(${name})`;
  const computed = getComputedStyle(el).color;
  // Le navigateur retourne `rgb(0, 0, 0)` (transparent noir) quand la
  // custom property est indéfinie ou invalide — on retombe alors sur le
  // fallback pour éviter un dataset "tout noir".
  if (!computed || computed === 'rgba(0, 0, 0, 0)') return fallback;
  return computed;
}

/** Convertit une couleur CSS (`rgb`/`rgba`/hex) en `rgba(r,g,b,alpha)`.
 *  Utilisé pour le fond semi-transparent des lignes Chart.js sans
 *  `color-mix` (qui n'est pas géré côté canvas). Retourne `fallback`
 *  quand la couleur est illisible. */
export function withAlpha(color: string, alpha: number, fallback: string): string {
  const trimmed = color.trim();
  const rgb = trimmed.match(/^rgba?\(\s*([\d.]+)[ ,]+([\d.]+)[ ,]+([\d.]+)/);
  if (rgb) {
    return `rgba(${rgb[1]}, ${rgb[2]}, ${rgb[3]}, ${alpha})`;
  }
  const hex = trimmed.match(/^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/);
  if (hex) {
    let h = hex[1];
    if (h.length === 3) h = h.split('').map((c) => c + c).join('');
    const r = parseInt(h.slice(0, 2), 16);
    const g = parseInt(h.slice(2, 4), 16);
    const b = parseInt(h.slice(4, 6), 16);
    return `rgba(${r}, ${g}, ${b}, ${alpha})`;
  }
  return fallback;
}

