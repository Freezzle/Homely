import { CategorieDto, PosteDto, ProjectionAnnuelleDto, VentilationAnnuelleDto } from '../../../core/models/api.models';
import {
  anneesCommunes, construireCategoriesEcart, construireDonneesScenario,
  construireHeatmap, construirePostesDiff, filtrerPostesDiff,
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

  describe('construireDonneesScenario — cascade budgétaire arithmétiquement cohérente', () => {
    function agregat(revenus: number, charges: number, reserves: number, soldeDisponible: number) {
      return { revenus, charges, reserves, soldeDisponible };
    }

    function projectionFoyer(total: { revenus: number; charges: number; reserves: number; soldeDisponible: number }): ProjectionAnnuelleDto {
      const moisAgregat = { revenus: total.revenus / 12, charges: total.charges / 12, reserves: total.reserves / 12, soldeDisponible: total.soldeDisponible / 12 };
      const mois = Array.from({ length: 12 }, (_, i) => ({ numero: i + 1, agregat: moisAgregat }));
      return {
        annee: 2027,
        mois,
        moisReel: mois,
        totalAnnuel: total,
        parMembre: {},
        moisParMembre: {},
        moisParMembreReel: {},
      };
    }

    const ventilationVide: VentilationAnnuelleDto = {
      annee: 2027, agregat: agregat(0, 0, 0, 0),
      parMembre: {}, parCategorie: {}, parCategorieMembre: {}, parCompteMembre: {}, parMembreSplit: {},
    };

    it('garantit RàV = Rev − Ch − Res et Solde = RàV − Poche même si le solde du back diffère de Rev − Ch − Res − Poche(résolution)', () => {
      // Reproduit le cas rapporté (« Dylan 80 % ») : Rev − Ch − Res = 25 798 mais
      // soldeDisponible = 11 878 (donc poche implicite du moteur = 13 920, alors qu'une
      // résolution séparée donnerait 16 320). La cascade doit rester cohérente en
      // utilisant l'agrégat de projection comme source unique.
      const projection = projectionFoyer({ revenus: 120430, charges: 86232, reserves: 8400, soldeDisponible: 11878 });
      const donnees = construireDonneesScenario(projection, ventilationVide, [] as PosteDto[], 'foyer');

      const t = donnees.totalAnnuel;
      expect(t.revenus).toBe(120430);
      expect(t.charges).toBe(86232);
      expect(t.reserves).toBe(8400);
      // RàV strictement = Rev − Ch − Res
      expect(t.ravBrut).toBeCloseTo(25798, 6);
      // Poche dérivée = RàV − Solde (jamais reprise d'un endpoint tiers)
      expect(t.argentPoche).toBeCloseTo(13920, 6);
      expect(t.soldeDisponible).toBe(11878);
      // Identités arithmétiques de la cascade (§7)
      expect(t.revenus - t.charges - t.reserves).toBeCloseTo(t.ravBrut, 6);
      expect(t.ravBrut - t.argentPoche).toBeCloseTo(t.soldeDisponible, 6);
    });

    it('respecte les mêmes identités pour chaque mois', () => {
      const projection = projectionFoyer({ revenus: 12000, charges: 6000, reserves: 1200, soldeDisponible: 3600 });
      const donnees = construireDonneesScenario(projection, ventilationVide, [] as PosteDto[], 'foyer');
      for (const m of donnees.moisAgregats) {
        expect(m.revenus - m.charges - m.reserves).toBeCloseTo(m.ravBrut, 6);
        expect(m.ravBrut - m.argentPoche).toBeCloseTo(m.soldeDisponible, 6);
      }
    });
  });
});
