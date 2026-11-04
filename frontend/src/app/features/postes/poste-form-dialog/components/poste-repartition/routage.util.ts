import { VentilationCompteDto } from '../../../../../core/models/api.models';
import { LigneRoutage } from './repartition-saisie.model';

/**
 * Conversions entre le **routage** d'un poste tel que saisi dans l'UI
 * (`membreId → lignes (compte, part en %)`) et le contrat API
 * (`ventilations: {membreId, compteId, quotePart}` avec `quotePart` ∈ [0,1]).
 *
 * Rappel métier (`docs/01-principes-et-moteur.md` §8 bis) : `quotePart` est la part
 * **dans la part du membre**, donc sa somme vaut 1 **par membre**.
 */

/** Tolérance d'arrondi sur un total de pourcentages saisi à la main. */
const TOLERANCE_PCT = 0.5;

export function arrondirPourcentage(valeur: number): number {
  return Math.round(valeur * 100) / 100;
}

/** Ligne unique à 100 % — forme du mode simple (un seul compte par membre). */
export function ligneUnique(compteId: string | null): LigneRoutage[] {
  return [{ compteId, part: 100 }];
}

export function sommeRoutage(lignes: readonly LigneRoutage[] | undefined): number {
  return arrondirPourcentage((lignes ?? []).reduce((s, l) => s + (l.part ?? 0), 0));
}

/** Un membre est correctement routé s'il a au moins une ligne, toutes avec un compte, et un total de 100 %. */
export function routageMembreValide(lignes: readonly LigneRoutage[] | undefined): boolean {
  if (!lignes?.length) return false;
  if (lignes.some(l => !l.compteId)) return false;
  // Deux lignes ne peuvent pas pointer le même compte (unique (poste, membre, compte) en base).
  const comptes = new Set(lignes.map(l => l.compteId));
  if (comptes.size !== lignes.length) return false;
  return Math.abs(sommeRoutage(lignes) - 100) <= TOLERANCE_PCT;
}

/** Compte du mode simple : défini seulement si le membre n'a qu'une ligne. */
export function compteUniqueDe(
  routage: Readonly<Record<string, readonly LigneRoutage[]>>,
  membreId: string,
): string | null {
  const lignes = routage[membreId];
  return lignes?.length === 1 ? lignes[0].compteId : null;
}

/** Vrai dès qu'un membre porte plusieurs comptes : la saisie doit rester en mode avancé. */
export function routageMultiComptes(
  routage: Readonly<Record<string, readonly LigneRoutage[]>>,
  selection: readonly string[],
): boolean {
  return selection.some(id => (routage[id]?.length ?? 0) > 1);
}

/** `PosteDto.ventilations` → état de saisie. Les lignes sont triées à l'identique du serveur. */
export function routageDepuisDto(
  ventilations: readonly VentilationCompteDto[] | undefined,
  membreIds: readonly string[],
): Record<string, LigneRoutage[]> {
  const out: Record<string, LigneRoutage[]> = {};
  for (const id of membreIds) {
    const lignes = (ventilations ?? [])
      .filter(v => v.membreId === id)
      .map(v => ({ compteId: v.compteId, part: arrondirPourcentage((v.quotePart ?? 1) * 100) }));
    if (lignes.length) out[id] = lignes;
  }
  return out;
}

/**
 * État de saisie → `PosteRequest.ventilations`. Seuls les membres porteurs d'une part
 * sont routés ; les quotes-parts sont renormalisées pour sommer exactement à 1 par membre
 * (absorbe les arrondis d'affichage, que le backend refuserait au-delà de 1e-6).
 */
export function routageVersDto(
  routage: Readonly<Record<string, readonly LigneRoutage[]>>,
  selection: readonly string[],
  parts: Readonly<Record<string, number>>,
): { membreId: string; compteId: string; quotePart: number }[] {
  const out: { membreId: string; compteId: string; quotePart: number }[] = [];
  for (const membreId of selection) {
    if ((parts[membreId] ?? 0) <= 0) continue;
    const lignes = (routage[membreId] ?? []).filter(l => !!l.compteId && l.part > 0);
    const total = lignes.reduce((s, l) => s + l.part, 0);
    if (!lignes.length || total <= 0) continue;
    let cumul = 0;
    lignes.forEach((l, i) => {
      // La dernière ligne absorbe le reliquat d'arrondi : Σ quotePart == 1 exactement.
      const quotePart = i === lignes.length - 1
        ? Math.round((1 - cumul) * 1e6) / 1e6
        : Math.round((l.part / total) * 1e6) / 1e6;
      cumul += quotePart;
      out.push({ membreId, compteId: l.compteId!, quotePart });
    });
  }
  return out;
}
