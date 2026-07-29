/**
 * Tolérance de validation d'une répartition en pourcentage (somme des quotes-parts).
 *
 * Règle métier partagée entre les écrans de saisie de répartition (scénarios,
 * postes) : la somme doit être visuellement égale à 100%, mais on tolère les résidus
 * binaires de l'arithmétique flottante (ex. 33.33 + 33.33 + 33.34 = 100.00000000000001,
 * ou l'inverse) pour ne pas refuser à tort une saisie correcte.
 */
export const TOLERANCE_SOMME_REPARTITION = 0.01;

/** Arrondit une somme de pourcentages à 2 décimales pour neutraliser les résidus binaires. */
export function arrondirSommeRepartition(total: number): number {
  return Math.round(total * 100) / 100;
}

/** Vrai si la somme (déjà arrondie ou non) est considérée égale à 100% aux tolérances près. */
export function sommeRepartitionValide(somme: number): boolean {
  return Math.abs(somme - 100) < TOLERANCE_SOMME_REPARTITION;
}
