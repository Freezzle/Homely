import { LigneRoutagePocheDto } from '../../../core/models/api.models';

/**
 * Routage d'un versement d'argent de poche tel que saisi dans l'UI.
 *
 * Rappel métier : le versement part du **compte pivot** (la source qui le finance)
 * vers N **comptes de poche** crédités, au sens REVENU. Une contrepartie confondue
 * avec le pivot est un auto-routage : aucun virement n'est simulé.
 */
export interface LignePocheSaisie {
  compteId: string | null;
  /** Part du versement, en pourcentage (somme = 100). */
  part: number;
}

/** Tolérance d'arrondi sur un total de pourcentages saisi à la main. */
const TOLERANCE_PCT = 0.5;

export function arrondirPourcentage(valeur: number): number {
  return Math.round(valeur * 100) / 100;
}

/** Ligne unique à 100 % — forme du mode simple (un seul compte crédité). */
export function lignePocheUnique(compteId: string | null): LignePocheSaisie[] {
  return [{ compteId, part: 100 }];
}

export function sommePoche(lignes: readonly LignePocheSaisie[] | undefined): number {
  return arrondirPourcentage((lignes ?? []).reduce((s, l) => s + (l.part ?? 0), 0));
}

/** Routage valide : au moins une ligne, toutes avec un compte distinct, total 100 %. */
export function routagePocheValide(lignes: readonly LignePocheSaisie[] | undefined): boolean {
  if (!lignes?.length) return false;
  if (lignes.some(l => !l.compteId)) return false;
  const comptes = new Set(lignes.map(l => l.compteId));
  if (comptes.size !== lignes.length) return false;
  return Math.abs(sommePoche(lignes) - 100) <= TOLERANCE_PCT;
}

/** DTO API → état de saisie. */
export function routagePocheDepuisDto(
  routage: readonly LigneRoutagePocheDto[] | undefined,
): LignePocheSaisie[] {
  const lignes = (routage ?? []).map(l => ({
    compteId: l.compteId,
    part: arrondirPourcentage((l.quotePart ?? 1) * 100),
  }));
  return lignes.length ? lignes : lignePocheUnique(null);
}

/**
 * État de saisie → `routage` de la requête API. Les quotes-parts sont renormalisées
 * pour sommer exactement à 1 (absorbe les arrondis d'affichage, que le backend
 * refuserait au-delà de 1e-6).
 */
export function routagePocheVersDto(
  lignes: readonly LignePocheSaisie[] | undefined,
): LigneRoutagePocheDto[] {
  const retenues = (lignes ?? []).filter(l => !!l.compteId && l.part > 0);
  const total = retenues.reduce((s, l) => s + l.part, 0);
  if (!retenues.length || total <= 0) return [];
  const out: LigneRoutagePocheDto[] = [];
  let cumul = 0;
  retenues.forEach((l, i) => {
    // La dernière ligne absorbe le reliquat d'arrondi : Σ quotePart == 1 exactement.
    const quotePart = i === retenues.length - 1
      ? Math.round((1 - cumul) * 1e6) / 1e6
      : Math.round((l.part / total) * 1e6) / 1e6;
    cumul += quotePart;
    out.push({ compteId: l.compteId!, quotePart });
  });
  return out;
}
