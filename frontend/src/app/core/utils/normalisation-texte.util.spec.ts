import { normaliserPourRecherche, trouverPlage, contientInsensibleAccents, surlignerFragment } from './normalisation-texte.util';

describe('normalisation-texte.util', () => {
  describe('normaliserPourRecherche', () => {
    it('supprime les accents et met en minuscule', () => {
      expect(normaliserPourRecherche('Impôts')).toBe('impots');
      expect(normaliserPourRecherche('Crèche')).toBe('creche');
      expect(normaliserPourRecherche('Élodie')).toBe('elodie');
    });

    it('retire les espaces superflus', () => {
      expect(normaliserPourRecherche('  Santé  ')).toBe('sante');
    });
  });

  describe('contientInsensibleAccents', () => {
    it('trouve "impots" dans "Acompte impôts"', () => {
      expect(contientInsensibleAccents('Acompte impôts', 'impots')).toBeTrue();
    });

    it('trouve "creche" dans "Crèche"', () => {
      expect(contientInsensibleAccents('Crèche', 'creche')).toBeTrue();
    });

    it('ne trouve rien si absent', () => {
      expect(contientInsensibleAccents('Loyer', 'impots')).toBeFalse();
    });

    it('retourne faux pour une requête vide', () => {
      expect(contientInsensibleAccents('Loyer', '')).toBeFalse();
    });
  });

  describe('trouverPlage', () => {
    it('retourne les indices dans le texte original (accentué)', () => {
      const plage = trouverPlage('Acompte impôts', 'impots');
      expect(plage).toEqual({ debut: 8, fin: 14 });
    });

    it('retourne null si aucune correspondance', () => {
      expect(trouverPlage('Loyer', 'impots')).toBeNull();
    });
  });

  describe('surlignerFragment', () => {
    it('entoure le fragment trouvé de <mark> en conservant les accents', () => {
      expect(surlignerFragment('Acompte impôts', 'impots')).toBe('Acompte <mark>impôts</mark>');
    });

    it('échappe le HTML pour éviter toute injection', () => {
      expect(surlignerFragment('<script>alert(1)</script>', 'alert')).toBe(
        '&lt;script&gt;<mark>alert</mark>(1)&lt;/script&gt;',
      );
    });

    it('retourne le texte échappé sans <mark> si aucune correspondance', () => {
      expect(surlignerFragment('Loyer', 'impots')).toBe('Loyer');
    });
  });
});
