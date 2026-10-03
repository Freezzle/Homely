/** Utilitaires de tracé des courbes SVG (sparkline, double courbe, courbes multiples). */

export interface EchelleSerie {
  min: number;
  max: number;
}

/** Échelle commune à une ou plusieurs séries (min/max, aplatie si constante). */
export function echelleCommune(...series: number[][]): EchelleSerie {
  const valeurs = series.flat().filter((v) => Number.isFinite(v));
  if (!valeurs.length) return { min: 0, max: 1 };
  const min = Math.min(...valeurs);
  const max = Math.max(...valeurs);
  return min === max ? { min: min - 1, max: max + 1 } : { min, max };
}

/**
 * Chemin SVG d'une série dans un `viewBox="0 0 100 <hauteurBoite>"` :
 * X réparti uniformément, Y inversé (l'axe SVG descend).
 */
export function cheminSerie(serie: number[], echelle: EchelleSerie, base: number, amplitude: number): string {
  const points = serie.filter((v) => Number.isFinite(v));
  if (!points.length) return '';
  const etendue = echelle.max - echelle.min || 1;
  const pas = points.length > 1 ? 100 / (points.length - 1) : 0;
  return points
    .map((valeur, index) => {
      const x = points.length > 1 ? index * pas : 50;
      const y = base - ((valeur - echelle.min) / etendue) * amplitude;
      return `${index === 0 ? 'M' : 'L'}${x.toFixed(2)} ${y.toFixed(2)}`;
    })
    .join(' ');
}

/** Variante fermée (retour par le bas) pour le remplissage dégradé. */
export function cheminRempli(chemin: string, hauteurBoite: number): string {
  return chemin ? `${chemin} L100 ${hauteurBoite} L0 ${hauteurBoite} Z` : '';
}

/**
 * Échelle d'un graphique multi-séries tracé dans un `viewBox="0 0 100 100"` :
 * `min`/`max` sont les valeurs réellement atteintes (graduations affichées), `bas`/`haut`
 * les bornes de tracé, élargies d'une marge pour laisser de l'air en haut et en bas.
 */
export interface EchelleCourbes {
  /** Plus petite valeur réellement présente dans les séries. */
  min: number;
  /** Plus grande valeur réellement présente dans les séries. */
  max: number;
  /** Borne basse de tracé (`min` moins la marge). */
  bas: number;
  /** Borne haute de tracé (`max` plus la marge). */
  haut: number;
}

/**
 * Échelle commune à plusieurs séries, élargie d'une marge proportionnelle à l'étendue.
 * Une étendue nulle (toutes les valeurs identiques) retombe sur une marge de 1 pour
 * éviter une division par zéro.
 */
export function echelleAvecMarge(series: number[][], inclureZero = false, ratioMarge = 0.08): EchelleCourbes {
  const valeurs = series.flat().filter((v) => Number.isFinite(v));
  if (!valeurs.length) return { min: 0, max: 1, bas: 0, haut: 1 };
  const min = inclureZero ? Math.min(0, ...valeurs) : Math.min(...valeurs);
  const max = inclureZero ? Math.max(0, ...valeurs) : Math.max(...valeurs);
  const marge = (max - min) * ratioMarge || 1;
  return { min, max, bas: min - marge, haut: max + marge };
}

/** Abscisse (en %) du point d'index `index` : centre de la colonne, aligné sous son libellé. */
export function abscissePourcent(index: number, nbPoints: number): number {
  return nbPoints > 0 ? ((index + 0.5) / nbPoints) * 100 : 50;
}

/** Ordonnée (en %) d'une valeur, axe SVG inversé (0 % en haut). */
export function ordonneePourcent(valeur: number, echelle: EchelleCourbes): number {
  const etendue = echelle.haut - echelle.bas || 1;
  return (1 - (valeur - echelle.bas) / etendue) * 100;
}

/**
 * Pas de graduation « rond » (1, 2, 5 ou 10 × 10ⁿ) pour couvrir `max` en `nbGraduations`
 * intervalles : les libellés d'axe tombent ainsi sur des valeurs lisibles.
 */
export function pasArrondi(max: number, nbGraduations = 3): number {
  const brut = Math.max(max, Number.EPSILON) / Math.max(nbGraduations, 1);
  const puissance = Math.pow(10, Math.floor(Math.log10(brut)));
  const facteur = brut / puissance;
  return (facteur <= 1 ? 1 : facteur <= 2 ? 2 : facteur <= 5 ? 5 : 10) * puissance;
}

/** Échelle d'un graphique dont l'axe Y part toujours de 0 (barres empilées). */
export interface EchelleDepuisZero {
  /** Borne haute, arrondie au pas supérieur. */
  haut: number;
  /** Écart entre deux graduations. */
  pas: number;
  /** Valeurs des graduations, de 0 à `haut`. */
  graduations: number[];
}

/**
 * Échelle partant de 0 et arrondie à un pas « rond », commune à toutes les séries
 * (barres empilées et ligne de référence restent donc comparables à l'œil).
 */
export function echelleDepuisZero(valeurs: number[], nbGraduations = 3): EchelleDepuisZero {
  const max = Math.max(...valeurs.filter((v) => Number.isFinite(v)), 0);
  // Aucune valeur positive : seule la ligne 0 a du sens, et `haut = 1` évite la division par zéro.
  if (max <= 0) return { haut: 1, pas: 1, graduations: [0] };
  const pas = pasArrondi(max * 1.05, nbGraduations);
  const haut = Math.ceil((max * 1.06) / pas) * pas;
  const graduations: number[] = [];
  for (let valeur = 0; valeur <= haut + 1e-9; valeur += pas) graduations.push(valeur);
  return { haut, pas, graduations };
}

/** Ordonnée (en %) d'une valeur sur une échelle partant de 0, axe SVG inversé. */
export function ordonneeDepuisZero(valeur: number, echelle: EchelleDepuisZero): number {
  return 100 - (valeur / (echelle.haut || 1)) * 100;
}

/** Part de sa colonne occupée par une barre (le reste forme la gouttière). */
export const RATIO_LARGEUR_BARRE = 0.62;

/** Largeur (en %) d'une barre parmi `nbPoints` colonnes. */
export function largeurBarrePourcent(nbPoints: number): number {
  return nbPoints > 0 ? (100 / nbPoints) * RATIO_LARGEUR_BARRE : 0;
}

/** Abscisse (en %) du bord gauche de la barre d'index `index`, centrée dans sa colonne. */
export function abscisseBarrePourcent(index: number, nbPoints: number): number {
  if (nbPoints <= 0) return 0;
  const colonne = 100 / nbPoints;
  return index * colonne + (colonne - colonne * RATIO_LARGEUR_BARRE) / 2;
}
