/**
 * Métadonnées de présentation pour la matrice "Nécessité vs Priorité d'action".
 *
 * ⚠️ Tout le calcul (montant annualisé, scores 0-100 par rang percentile, poids du
 * montant, classification en quadrant) est fait côté **serveur** par
 * `MatriceBudgetaireService` (voir `PostePositionneDto`, exposé par
 * `GET /api/foyers/{foyerId}/scenarios/{scenarioId}/postes/matrice-budgetaire`).
 * Ce fichier ne contient plus que des constantes de rendu (aucune logique métier),
 * pour que le composant partagé sache dessiner les 4 quadrants et leurs couleurs.
 */

/** Nom des 4 quadrants de la matrice. */
export type QuadrantName = 'rigides' | 'negocier' | 'bruit' | 'couper';

export interface QuadrantDefinition {
  id: QuadrantName;
  labelKey: string;
  couleurAccent: string;
}

/** Le croisement des 2 axes (quadrants + gridlines) se fait au centre de l'échelle 0-100
 *  renvoyée par le serveur. */
export const CENTRE_ECHELLE = 50;

/** Les 4 quadrants, dans l'ordre d'affichage (haut-gauche, haut-droite, bas-gauche, bas-droite). */
export const QUADRANTS: QuadrantDefinition[] = [
  { id: 'rigides', labelKey: 'essentielsRigides', couleurAccent: '#0EA5E9' },
  { id: 'negocier', labelKey: 'essentielsANegocier', couleurAccent: '#6366F1' },
  { id: 'bruit', labelKey: 'bruitBudgetaire', couleurAccent: '#94A3B8' },
  { id: 'couper', labelKey: 'aCouperEnPriorite', couleurAccent: '#F97316' },
];
