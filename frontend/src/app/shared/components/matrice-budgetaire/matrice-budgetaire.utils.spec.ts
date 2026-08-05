import { CENTRE_ECHELLE, QUADRANTS, QuadrantName } from './matrice-budgetaire.utils';

/**
 * Le calcul de score/quadrant est désormais fait côté serveur (voir
 * `MatriceBudgetaireServiceTest` côté backend, seule source de vérité pour la formule).
 * Ce fichier ne teste plus que les métadonnées de rendu conservées côté frontend.
 */
describe('matrice-budgetaire.utils', () => {
  it('définit exactement 4 quadrants, avec des ids uniques', () => {
    expect(QUADRANTS.length).toBe(4);
    const ids = new Set(QUADRANTS.map((q) => q.id));
    expect(ids.size).toBe(4);
    const attendus: QuadrantName[] = ['rigides', 'negocier', 'bruit', 'couper'];
    for (const id of attendus) {
      expect(QUADRANTS.some((q) => q.id === id)).toBe(true);
    }
  });

  it('chaque quadrant a une couleur d\'accent hexadécimale distincte', () => {
    const couleurs = QUADRANTS.map((q) => q.couleurAccent);
    expect(new Set(couleurs).size).toBe(4);
    for (const c of couleurs) {
      expect(c).toMatch(/^#[0-9A-Fa-f]{6}$/);
    }
  });

  it('le centre de l\'échelle est à 50 (échelle 0-100 renvoyée par le serveur)', () => {
    expect(CENTRE_ECHELLE).toBe(50);
  });
});
