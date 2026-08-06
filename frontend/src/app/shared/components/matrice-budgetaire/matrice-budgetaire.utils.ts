/**
 * Métadonnées de présentation pour le classement "Postes à optimiser en priorité".
 *
 * ⚠️ Tout le calcul (montant annualisé, score unique 0-100, tri décroissant, troncature
 * au top 30) est fait côté **serveur** par `MatriceBudgetaireService` (voir
 * `PostePositionneDto`, exposé par
 * `GET /api/foyers/{foyerId}/scenarios/{scenarioId}/postes/matrice-budgetaire`).
 * Ce fichier ne contient plus que des constantes de rendu (aucune logique métier) : le
 * dégradé de couleur des barres selon le score.
 */

/** Nombre maximal de postes affichés (miroir de `MatriceBudgetaireService.TOP_N`). */
export const TOP_N = 30;

/** Paliers de score (0-100) utilisés pour le dégradé de couleur des barres — du plus
 *  neutre (score faible, poste à garder tel quel) au plus marqué (score élevé, poste
 *  prioritaire à réviser/couper). Triés par seuil croissant, le dernier est le palier
 *  par défaut au-delà de son seuil. */
export interface PalierScore {
  seuil: number;
  couleur: string;
}

export const PALIERS_SCORE: PalierScore[] = [
  { seuil: 33, couleur: '#94A3B8' }, // faible priorité
  { seuil: 66, couleur: '#F59E0B' }, // priorité moyenne
  { seuil: 101, couleur: '#EF4444' }, // priorité haute
];

/** Couleur associée à un score (0-100) selon les paliers ci-dessus. */
export function couleurPourScore(score: number): string {
  for (const palier of PALIERS_SCORE) {
    if (score < palier.seuil) return palier.couleur;
  }
  return PALIERS_SCORE[PALIERS_SCORE.length - 1].couleur;
}
