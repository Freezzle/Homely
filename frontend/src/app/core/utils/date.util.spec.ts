import { toIsoDateLocal, parseIsoDateLocal } from './date.util';

describe('date.util', () => {
  describe('toIsoDateLocal', () => {
    it("formate une Date locale en YYYY-MM-DD sans décalage (minuit local)", () => {
      const d = new Date(2026, 9, 1); // 1er octobre 2026, minuit local
      expect(toIsoDateLocal(d)).toBe('2026-10-01');
    });

    it('remplit les zéros pour les mois/jours à un seul chiffre', () => {
      const d = new Date(2026, 0, 5); // 5 janvier 2026
      expect(toIsoDateLocal(d)).toBe('2026-01-05');
    });

    it("ignore l'heure éventuelle (ne prend que Y/M/D)", () => {
      const d = new Date(2026, 9, 1, 23, 59, 59);
      expect(toIsoDateLocal(d)).toBe('2026-10-01');
    });
  });

  describe('parseIsoDateLocal', () => {
    it('parse "YYYY-MM-DD" en Date locale à minuit du même jour', () => {
      const d = parseIsoDateLocal('2026-10-01');
      expect(d.getFullYear()).toBe(2026);
      expect(d.getMonth()).toBe(9);
      expect(d.getDate()).toBe(1);
      expect(d.getHours()).toBe(0);
    });
  });

  it('round-trip toIsoDateLocal(parseIsoDateLocal(s)) === s', () => {
    const s = '2026-12-31';
    expect(toIsoDateLocal(parseIsoDateLocal(s))).toBe(s);
  });
});
