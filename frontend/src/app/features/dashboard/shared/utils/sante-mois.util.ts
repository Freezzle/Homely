/** Part du revenu de la période au-delà de laquelle le solde restant est considéré comme
 *  sain. En-dessous (mais positif), la période est « à surveiller » ; un solde négatif est
 *  « à risque ». */
export const PART_REVENU_SOLDE_SAIN = 0.05;

/** Niveau de santé d'un mois : `low` = solde négatif, `mid` = solde positif mais sous
 *  5 % du revenu du mois, `high` = solde ≥ 5 % du revenu. */
export type NiveauSanteMois = 'low' | 'mid' | 'high';

/** Règle unique de coloration des mois (sélecteur de période + heatmap « Mois à risque »).
 *  Un revenu nul ou négatif ramène le seuil à 0 : seul le signe du solde compte. */
export function niveauSanteMois(soldeDisponible: number, revenus: number): NiveauSanteMois {
  if (soldeDisponible < 0) return 'low';
  return soldeDisponible < Math.max(revenus, 0) * PART_REVENU_SOLDE_SAIN ? 'mid' : 'high';
}
