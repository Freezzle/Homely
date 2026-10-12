import { MembreDto, TypeRepartition } from '../../../../../core/models/api.models';

/** Arrondi au centième de point, comme le reste des quotes-parts du formulaire. */
export const arrondirPart = (v: number): number => Math.round(v * 100) / 100;

/**
 * Quotes-parts (en %) dérivées d'une sélection de membres et d'un type de
 * répartition. AUTO / REVERSE_AUTO reprennent les parts du scénario (affichage
 * informatif : elles ne sont jamais envoyées à l'API), CUSTOM part d'une
 * répartition égale entre les membres sélectionnés.
 *
 * Fonction pure, partagée par `app-poste-repartition` et par le conteneur qui
 * initialise la saisie — pour que les deux ne divergent jamais.
 */
export function calculerParts(
  membres: readonly MembreDto[],
  selection: readonly string[],
  type: TypeRepartition,
  partsAuto: Readonly<Record<string, number>>,
): Record<string, number> {
  const parts: Record<string, number> = {};
  for (const m of membres) parts[m.id] = 0;

  const n = selection.length;
  if (n === 0) return parts;

  if (n === 1) {
    parts[selection[0]] = 100;
    return parts;
  }

  if (type === 'CUSTOM') {
    const part = arrondirPart(100 / n);
    const reste = arrondirPart(100 - part * (n - 1));
    selection.forEach((id, i) => { parts[id] = i === n - 1 ? reste : part; });
    return parts;
  }

  selection.forEach(id => {
    const base = partsAuto[id] ?? 1 / n;
    const effective = type === 'REVERSE_AUTO' ? (1 - base) / (n - 1) : base;
    parts[id] = arrondirPart(effective * 100);
  });
  return parts;
}
