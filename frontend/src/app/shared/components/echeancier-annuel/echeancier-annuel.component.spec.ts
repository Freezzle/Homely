import { EcheancierAnnuelComponent } from './echeancier-annuel.component';
import { PosteEcheancier } from './echeancier.model';
import { cycles, imputations, vueEcheancier } from './echeancier.util';

describe('EcheancierAnnuel — smoke', () => {
  const poste = (o: Partial<PosteEcheancier>): PosteEcheancier => ({
    periodicite: 1, mode: 'MENSUALISE', moment: 'DEBUT_PERIODE',
    debut: '2022-01-01', fin: null, ...o,
  });

  it('classe EcheancierAnnuelComponent est exportée', () => {
    expect(EcheancierAnnuelComponent).toBeTruthy();
  });

  it('vueEcheancier retourne toujours 12 mois (R1)', () => {
    const v = vueEcheancier(poste({ fin: '2025-11-30' }), 2026);
    expect(v.mois).toHaveLength(12);
    expect(v.mois.every((m) => m.etat === 'hors-validite')).toBe(true);
  });

  it('un poste ponctuel produit un unique losange sur son mois de référence (R4/R6)', () => {
    const v = vueEcheancier(poste({ periodicite: 0, debut: '2026-04-01' }), 2026);
    expect(v.capsules).toHaveLength(0);
    expect(v.perles).toEqual([{ mois: 4, forme: 'losange' }]);
    expect([v.debutMois, v.finMois]).toEqual([null, null]);
  });

  it('mensualisé trimestriel : imputé partout, échéances sur les occurrences (R5)', () => {
    const { impute, echeance } = imputations(
      poste({ periodicite: 3, debut: '2023-02-01' }),
      2026,
    );
    expect(impute.every(Boolean)).toBe(true);
    expect(echeance.map((e, i) => (e ? i + 1 : 0)).filter(Boolean)).toEqual([2, 5, 8, 11]);
  });

  it('cycles couvrent tous les mois imputés (R7)', () => {
    const p = poste({ periodicite: 6, debut: '2020-05-01' });
    const couverts = new Set<number>();
    for (const c of cycles(p, 2026)) {
      for (let m = c.du; m <= c.au; m++) couverts.add(m);
    }
    const imputes = vueEcheancier(p, 2026).mois.filter((m) => m.impute).map((m) => m.mois);
    expect(imputes.every((m) => couverts.has(m))).toBe(true);
  });
});
