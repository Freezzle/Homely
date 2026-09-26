import { toPercent } from './to-percent.util';

describe('toPercent', () => {
  it('projette une valeur médiane sur l\'échelle', () => {
    expect(toPercent(5, 0, 10)).toBe(50);
    expect(toPercent(15, 10, 20)).toBe(50);
  });

  it('borne à 0 lorsque la valeur est sous le minimum', () => {
    expect(toPercent(-3, 0, 10)).toBe(0);
  });

  it('borne à 100 lorsque la valeur dépasse le maximum', () => {
    expect(toPercent(42, 0, 10)).toBe(100);
  });

  it('renvoie 0 quand min === max (échelle dégénérée)', () => {
    expect(toPercent(5, 10, 10)).toBe(0);
  });

  it('renvoie 0 pour NaN', () => {
    expect(toPercent(Number.NaN, 0, 10)).toBe(0);
  });

  it('renvoie 0 pour Infinity et -Infinity', () => {
    expect(toPercent(Number.POSITIVE_INFINITY, 0, 10)).toBe(0);
    expect(toPercent(Number.NEGATIVE_INFINITY, 0, 10)).toBe(0);
  });

  it('accepte une plage inversée en gardant le bornage [0, 100]', () => {
    const p = toPercent(5, 10, 0);
    expect(p).toBeGreaterThanOrEqual(0);
    expect(p).toBeLessThanOrEqual(100);
  });
});
