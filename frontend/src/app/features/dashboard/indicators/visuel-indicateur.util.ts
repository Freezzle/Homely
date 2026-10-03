import { SegmentBarreEmpilee } from '../../../shared/components/indicateurs/barre-empilee/indicateur-barre-empilee.component';
import { TonIndicateur } from '../../../shared/components/indicateurs/tons';

/** Formateur de montant (devise du foyer) injecté par la façade dans les indicateurs. */
export type FormateurMontant = (montant: number) => string;

export interface LigneMontant {
  libelle: string;
  montant: number;
  ton: TonIndicateur;
}

/**
 * Convertit des montants en segments de barre empilée exprimés en % d'une base (ex. les
 * revenus de la période). Si la somme des montants dépasse la base (période déficitaire),
 * la somme sert de base pour que la barre reste bornée à 100 %. Les montants négatifs ou
 * nuls sont ignorés ; l'infobulle porte le montant exact.
 */
export function segmentsProportionnels(
  lignes: LigneMontant[],
  base: number,
  formatMontant: FormateurMontant,
): SegmentBarreEmpilee[] {
  const positives = lignes.filter((l) => l.montant > 0);
  const somme = positives.reduce((acc, l) => acc + l.montant, 0);
  const denominateur = Math.max(base, somme);
  if (denominateur <= 0) return [];
  return positives.map((l) => ({
    libelle: l.libelle,
    valeur: (l.montant / denominateur) * 100,
    ton: l.ton,
    infobulle: `${l.libelle} · ${formatMontant(l.montant)}`,
  }));
}
