/**
 * Fonctions pures de gestion des couleurs de membre (normalisation hex + contraste de
 * texte), partagées par `TagComponent`, `DecompositionService` et les composants
 * affichant des tags membre/couleur. Aucune dépendance Angular.
 */

/** Normalise une couleur stockée (avec ou sans `#`) ; couleur neutre par défaut si absente. */
export function normaliserCouleur(couleur?: string | null): string {
  if (!couleur) return '#64748b';
  return couleur.startsWith('#') ? couleur : `#${couleur}`;
}

/** Lisibilité minimale des tags, quelle que soit la couleur de fond du membre. */
export function couleurTexteContraste(hexColor: string): string {
  const hex = hexColor.replace('#', '');
  if (hex.length !== 6 || /[^0-9a-f]/i.test(hex)) return '#ffffff';
  const r = parseInt(hex.substring(0, 2), 16);
  const g = parseInt(hex.substring(2, 4), 16);
  const b = parseInt(hex.substring(4, 6), 16);
  const luminance = (0.299 * r) + (0.587 * g) + (0.114 * b);
  return luminance > 170 ? '#111827' : '#ffffff';
}
