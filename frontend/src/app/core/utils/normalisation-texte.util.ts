/**
 * Normalisation de texte pour la recherche insensible aux accents et à la casse
 * (impératif pour une application francophone — voir docs/features/feature_3.md §4).
 * Utilisé par `postes-liste.component.ts` pour filtrer sur la description, la
 * catégorie et le compte sans que l'utilisateur ait à taper les accents exacts.
 */

/** `impots` doit matcher `Impôts`, `creche` doit matcher `Crèche`. */
export function normaliserPourRecherche(texte: string): string {
  return texte
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim();
}

/**
 * Cherche `requete` (normalisée) dans `texte` (normalisé pour la comparaison, mais
 * les indices retournés portent sur `texte` d'origine — les deux chaînes ont la même
 * longueur car la suppression des diacritiques ne change pas le nombre de caractères).
 * Retourne `null` si aucune correspondance.
 */
export function trouverPlage(texte: string, requete: string): { debut: number; fin: number } | null {
  const requeteNormalisee = normaliserPourRecherche(requete);
  if (!requeteNormalisee) return null;

  const texteNormalise = normaliserPourRecherche(texte);
  const index = texteNormalise.indexOf(requeteNormalisee);
  if (index < 0) return null;

  return { debut: index, fin: index + requeteNormalisee.length };
}

/** Vrai si `texte` contient `requete`, comparaison insensible aux accents/casse. */
export function contientInsensibleAccents(texte: string, requete: string): boolean {
  return trouverPlage(texte, requete) !== null;
}

/**
 * Construit un HTML sûr (texte source échappé, `requete` non interprétée) où la
 * première occurrence de `requete` dans `texte` est enveloppée dans `<mark>`, pour
 * le surlignage des résultats de recherche. Retourne le texte échappé tel quel si
 * aucune correspondance.
 */
export function surlignerFragment(texte: string, requete: string): string {
  const echapper = (s: string): string => s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');

  const plage = trouverPlage(texte, requete);
  if (!plage) return echapper(texte);

  const avant = echapper(texte.slice(0, plage.debut));
  const trouve = echapper(texte.slice(plage.debut, plage.fin));
  const apres = echapper(texte.slice(plage.fin));
  return `${avant}<mark>${trouve}</mark>${apres}`;
}
