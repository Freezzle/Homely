import { besoinsPlaisirsIndicator } from './besoins-plaisirs/besoins-plaisirs.indicator';
import { postesAOptimiserIndicator } from './postes-a-optimiser/postes-a-optimiser.indicator';
import { tauxEffortMembreIndicator } from './taux-effort-membre/taux-effort-membre.indicator';

const t = {
  projection: {
    effortCardTitreSansNom: 'Taux d\'effort',
    effortCardNA: 'N/A',
  },
  dashboard: {
    sectionTauxEffortInfoSousTitre: 'charges + réserves',
    indicateurBesoinsPlaisirsTitre: 'Besoins vs plaisirs',
    indicateurBesoinsPlaisirsSousTitre: 'Budget',
    besoinsPlaisirsNA: 'N/A',
    indicateurBesoinsPlaisirsInfoSousTitre: 'besoins',
    indicateurPostesAOptimiserTitre: 'Postes à optimiser',
    indicateurPostesAOptimiserSousTitre: 'Priorités',
    indicateurPostesAOptimiserInfoSousTitre: 'postes',
  },
} as any;

describe('dashboard indicators', () => {
  it('formats taux d\'effort info without integer-only rounding and uses dynamic thresholds', () => {
    const indicator = tauxEffortMembreIndicator({
      membre: { id: 'm1', nom: 'Alex' },
      revenusTotal: 300,
      chargesTotal: 100,
      reservesTotal: 1,
      chargesTotalPireCas: 100,
      reservesTotalPireCas: 1,
      argentPocheTotal: 0,
      argentPocheTotalPireCas: 0,
    }, t, {
      tauxEffortCorrect: 30,
      tauxEffortTendu: 40,
      tauxEffortSature: 50,
    });

    expect(indicator.info).toBe('33.7%');
    expect(indicator.infoColor).toBe('blue');
  });

  it('marks besoins/plaisirs indicator as red above backend threshold', () => {
    const indicator = besoinsPlaisirsIndicator('bp', {
      montantBesoins: 320,
      montantPlaisirs: 80,
      revenusTotal: 500,
      devise: 'CHF',
      postesBesoins: [],
    }, t, { besoinsPlaisirsBudget: 60 });

    expect(indicator.info).toBe('64%');
    expect(indicator.infoColor).toBe('red');
  });

  it('keeps besoins/plaisirs indicator positive below backend threshold', () => {
    const indicator = besoinsPlaisirsIndicator('bp', {
      montantBesoins: 250,
      montantPlaisirs: 50,
      revenusTotal: 500,
      devise: 'CHF',
      postesBesoins: [],
    }, t, { besoinsPlaisirsBudget: 60 });

    expect(indicator.infoColor).toBe('pos');
  });

  it('counts postes à optimiser with backend score threshold', () => {
    const indicator = postesAOptimiserIndicator('po', [
      { score: 64 },
      { score: 66 },
      { score: 82 },
    ], t, { posteAOptimiserScore: 66 });

    expect(indicator.info).toBe('2');
    expect(indicator.infoColor).toBe('yellow');
  });
});
