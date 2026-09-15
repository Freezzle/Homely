import { TestBed } from '@angular/core/testing';
import { EcheancierMultiAnneesComponent } from './echeancier-multi-annees.component';
import { PosteEcheancier } from './echeancier.model';

/** Rendu léger : on instancie le composant et on lit son signal `segments()`. */
function creer(poste: PosteEcheancier | null): EcheancierMultiAnneesComponent {
  TestBed.configureTestingModule({ imports: [EcheancierMultiAnneesComponent] });
  const fixture = TestBed.createComponent(EcheancierMultiAnneesComponent);
  fixture.componentRef.setInput('poste', poste);
  fixture.detectChanges();
  return fixture.componentInstance;
}

// Accès direct au computed `segments` (protected) pour les assertions.
function segments(c: EcheancierMultiAnneesComponent): ReadonlyArray<{ annee: number; label: string; marqueurs: boolean }> {
  return (c as unknown as { segments: () => Array<{ annee: number; label: string; marqueurs: boolean }> }).segments();
}

const poste = (o: Partial<PosteEcheancier>): PosteEcheancier => ({
  periodicite: 1, mode: 'MENSUALISE', moment: 'DEBUT_PERIODE',
  debut: '2026-03-01', fin: null, ...o,
});

describe('EcheancierMultiAnnees — segments()', () => {
  it('null → 1 segment vide sur année courante', () => {
    const s = segments(creer(null));
    expect(s).toHaveLength(1);
    expect(s[0].annee).toBe(new Date().getFullYear());
    expect(s[0].marqueurs).toBe(true);
  });

  it('ponctuel → 1 segment sur année de la date de référence', () => {
    const s = segments(creer(poste({ periodicite: 0, debut: '2026-05-01' })));
    expect(s).toHaveLength(1);
    expect(s[0].annee).toBe(2026);
  });

  it('seul debut → 1 segment', () => {
    const s = segments(creer(poste({ debut: '2026-03-01' })));
    expect(s).toHaveLength(1);
    expect(s[0].annee).toBe(2026);
  });

  it('même année → 1 segment', () => {
    const s = segments(creer(poste({ debut: '2026-03-01', fin: '2026-11-30' })));
    expect(s).toHaveLength(1);
    expect(s[0].annee).toBe(2026);
  });

  it('fin < debut → 1 segment (celui de debut)', () => {
    const s = segments(creer(poste({ debut: '2026-03-01', fin: '2024-11-30' })));
    expect(s).toHaveLength(1);
    expect(s[0].annee).toBe(2026);
  });

  it('Δ = 1 → 2 segments (debut, fin)', () => {
    const s = segments(creer(poste({ debut: '2026-03-01', fin: '2027-05-31' })));
    expect(s.map((x) => x.annee)).toEqual([2026, 2027]);
    expect(s.every((x) => x.marqueurs)).toBe(true);
  });

  it('Δ = 2 → 3 segments, boucle « 1 an » sans embouts', () => {
    const s = segments(creer(poste({ debut: '2026-03-01', fin: '2028-05-31' })));
    expect(s).toHaveLength(3);
    expect(s[0].annee).toBe(2026);
    expect(s[2].annee).toBe(2028);
    expect(s[1].marqueurs).toBe(false);
    expect(s[1].label).toContain('1');
  });

  it('Δ = 5 → 3 segments, boucle « 4 ans »', () => {
    const s = segments(creer(poste({ debut: '2026-03-01', fin: '2031-05-31' })));
    expect(s).toHaveLength(3);
    expect(s[1].label).toContain('4');
  });
});
