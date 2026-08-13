/** Formate un taux (%) avec au plus une décimale, sans décimale superflue (ex: 12%,
 *  12.3%) — évite d'arrondir brutalement à l'entier près. Utilitaire partagé pour
 *  garantir un formatage cohérent partout où un pourcentage est affiché (donuts, barres
 *  de répartition, indicateurs du dashboard). */
export function formatTaux(value: number): string {
  const arrondi = Math.round(value * 10) / 10;
  return Number.isInteger(arrondi) ? `${arrondi}` : arrondi.toFixed(1);
}
