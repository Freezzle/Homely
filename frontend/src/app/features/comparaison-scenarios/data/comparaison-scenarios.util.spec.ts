import { CategorieDto, PosteDto } from '../../../core/models/api.models';
import {
  anneesCommunes, construireCategoriesEcart, construireHeatmap, construirePostesDiff, filtrerPostesDiff,
} from './comparaison-scenarios.util';

function poste(overrides: Partial<PosteDto>): PosteDto {
  return {
    id: overrides.id ?? 'id',
    type: 'CHARGE',
    description: 'Loyer',
    categorieId: 'cat-logement',
    montant: 1000,
    montantMensualise: 1000,
    devise: 'CHF',
    periodiciteMois: 1,
    debut: '2026-01-01',
    fin: undefined,
    mode: 'MENSUALISE',
    moment: 'DEBUT_PERIODE',
    nature: 'EFFECTIF',
    estimPourcentage: undefined,
    typeRepartition: 'AUTO',
    ordre: 0,
    importance: 3,
    potentielOptimisation: 3,
    repartitions: [],
    ventilations: [],
    posteOrigineId: undefined,
    posteSuivantId: undefined,
    inclureProrataTheorique: true,
    ...overrides,
  };
}

describe('comparaison-scenarios.util', () => {
  describe('anneesCommunes', () => {
    it('retourne l\'intersection des deux horizons', () => {
      const a = { anneeDepart: 2025, horizonAnnees: 5 }; // 2025-2029
      const b = { anneeDepart: 2027, horizonAnnees: 3 }; // 2027-2029
      expect(anneesCommunes(a, b)).toEqual([2027, 2028, 2029]);
    });

    it('retourne un tableau vide si les horizons ne se chevauchent pas', () => {
      const a = { anneeDepart: 2020, horizonAnnees: 2 }; // 2020-2021
      const b = { anneeDepart: 2025, horizonAnnees: 2 }; // 2025-2026
      expect(anneesCommunes(a, b)).toEqual([]);
    });
  });

  describe('construireCategoriesEcart', () => {
    const categories: CategorieDto[] = [
      { id: 'cat-1', libelle: 'Logement', typePoste: 'CHARGE', actif: true },
      { id: 'cat-2', libelle: 'Salaire', typePoste: 'REVENU', actif: true },
    ];

    it('calcule l\'écart B-A pour chaque catégorie, y compris à 0', () => {
      const rows = construireCategoriesEcart(categories, { 'cat-1': 1200 }, { 'cat-1': 1500, 'cat-2': 100 });
      expect(rows).toEqual([
        { categorieId: 'cat-1', libelle: 'Logement', type: 'CHARGE', totalA: 1200, totalB: 1500, ecart: 300, impact: -1, effet: -300 },
        { categorieId: 'cat-2', libelle: 'Salaire', type: 'REVENU', totalA: 0, totalB: 100, ecart: 100, impact: 1, effet: 100 },
      ]);
    });
  });

  describe('construirePostesDiff / filtrerPostesDiff', () => {
    const categoriesParId: Record<string, CategorieDto> = {
      'cat-logement': { id: 'cat-logement', libelle: 'Logement', typePoste: 'CHARGE', actif: true },
    };

    it('détecte ajout, suppression, modification et postes inchangés', () => {
      const inchange = poste({ id: 'a1', description: 'Assurance', montant: 200, montantMensualise: 200 });
      const modifieA = poste({ id: 'a2', description: 'Loyer', montant: 1000, montantMensualise: 1000 });
      const modifieB = poste({ id: 'b2', description: 'Loyer', montant: 1200, montantMensualise: 1200 });
      const supprime = poste({ id: 'a3', description: 'Vieil abonnement', montant: 50, montantMensualise: 50 });
      const ajoute = poste({ id: 'b4', description: 'Nouvelle charge', montant: 80, montantMensualise: 80 });

      const lignes = construirePostesDiff(
        [inchange, modifieA, supprime],
        [{ ...inchange, id: 'a1-b' }, modifieB, ajoute],
        categoriesParId,
      );

      const parDescription = Object.fromEntries(lignes.map(l => [l.description, l]));
      expect(parDescription['Assurance'].statut).toBe('INCHANGE');
      expect(parDescription['Loyer'].statut).toBe('MODIFIE');
      expect(parDescription['Loyer'].montantAnnuelA).toBe(1000 * 12);
      expect(parDescription['Loyer'].montantAnnuelB).toBe(1200 * 12);
      expect(parDescription['Vieil abonnement'].statut).toBe('SUPPRIME');
      expect(parDescription['Nouvelle charge'].statut).toBe('AJOUTE');
    });

    it('filtre "changements" exclut les postes inchangés', () => {
      const inchange = poste({ id: 'a1', description: 'Assurance' });
      const ajoute = poste({ id: 'b1', description: 'Nouveau' });
      const lignes = construirePostesDiff([inchange], [{ ...inchange, id: 'a1-b' }, ajoute], categoriesParId);

      expect(filtrerPostesDiff(lignes, 'TOUS').length).toBe(2);
      expect(filtrerPostesDiff(lignes, 'CHANGES')).toEqual(lignes.filter(l => l.statut !== 'INCHANGE'));
      expect(filtrerPostesDiff(lignes, 'AJOUT').every(l => l.statut === 'AJOUTE')).toBe(true);
    });

    it('marque estRevision quand un des deux côtés porte un chaînage de révision', () => {
      const posteA = poste({ id: 'a1', description: 'Loyer', posteSuivantId: 'a2' });
      const posteB = poste({ id: 'a2', description: 'Loyer', posteOrigineId: 'a1', montant: 1300, montantMensualise: 1300 });
      const lignes = construirePostesDiff([posteA], [posteB], categoriesParId);
      expect(lignes[0].estRevision).toBe(true);
    });
  });

  describe('construireHeatmap', () => {
    const categories: CategorieDto[] = [
      { id: 'cat-1', libelle: 'Logement', typePoste: 'CHARGE', actif: true },
      { id: 'cat-2', libelle: 'Loisirs', typePoste: 'CHARGE', actif: true },
    ];

    function ventilationMois(parCategorie: Record<string, number>): any {
      return { annee: 2026, mois: 1, agregat: {}, parMembre: {}, parCategorie, parCategorieMembre: {}, parCompteMembre: {}, parMembreSplit: {} };
    }

    it('omet les catégories sans écart significatif et calcule le signe correct', () => {
      const mensuelA = Array.from({ length: 12 }, () => ventilationMois({ 'cat-1': 1000, 'cat-2': 50 }));
      const mensuelB = Array.from({ length: 12 }, () => ventilationMois({ 'cat-1': 1200, 'cat-2': 50 }));
      const lignes = construireHeatmap(categories, mensuelA, mensuelB, new Array(12).fill(0), new Array(12).fill(0), 'foyer', 'Argent de poche');

      expect(lignes.map(l => l.cle)).toEqual(['cat-1']);
      // Charge qui augmente de 200 => effet négatif sur le solde disponible.
      expect(lignes[0].valeursParMois[0]).toBe(-200);
    });
  });
});
