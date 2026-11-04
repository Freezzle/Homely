import { CompteDto, MembreDto, VirementCompteDto } from '../../../../core/models/api.models';

/** Compte enrichi de ses propriétaires effectifs (résolus depuis `comptes`/`membres`). */
export interface CompteAvecProprietaires {
  id: string;
  libelle: string;
  proprietaires: MembreDto[];
}

/** Un virement résolu : comptes source/destination enrichis + clé stable. */
export interface VirementResolu {
  /** Clé stable `compteSourceId::compteDestinationId` (il n'existe pas d'id serveur). */
  cle: string;
  source: CompteAvecProprietaires;
  destination: CompteAvecProprietaires;
  montant: number;
}

/** Virements sortants d'un même compte source, avec leur total. */
export interface GroupeVirementsSource {
  compteSource: CompteAvecProprietaires;
  virements: VirementResolu[];
  total: number;
}

/** Clé stable d'un virement — la paire source/destination l'identifie. */
export function cleVirement(v: Pick<VirementCompteDto, 'compteSourceId' | 'compteDestinationId'>): string {
  return `${v.compteSourceId}::${v.compteDestinationId}`;
}

/** Décompose une clé de virement en ses deux identifiants de comptes. */
export function decomposerCleVirement(cle: string): { compteSourceId: string; compteDestinationId: string } {
  const [compteSourceId, compteDestinationId] = cle.split('::');
  return { compteSourceId, compteDestinationId };
}

/** Index des comptes du foyer enrichis de leurs co-titulaires. */
export function enrichirComptes(
  comptes: readonly CompteDto[],
  membres: readonly MembreDto[],
): Map<string, CompteAvecProprietaires> {
  const membresParId = new Map(membres.map((m) => [m.id, m]));
  const map = new Map<string, CompteAvecProprietaires>();
  for (const c of comptes) {
    map.set(c.id, {
      id: c.id,
      libelle: c.libelle,
      proprietaires: c.membreIds.map((id) => membresParId.get(id)).filter((m): m is MembreDto => !!m),
    });
  }
  return map;
}

/** Résout les comptes d'un virement, en retombant sur les libellés du DTO si le référentiel
 *  ne les connaît pas (compte désactivé entre-temps). */
export function resoudreVirements(
  virements: readonly VirementCompteDto[],
  comptesEnrichis: Map<string, CompteAvecProprietaires>,
): VirementResolu[] {
  return virements.map((v) => ({
    cle: cleVirement(v),
    source: comptesEnrichis.get(v.compteSourceId)
      ?? { id: v.compteSourceId, libelle: v.libelleCompteSource, proprietaires: [] },
    destination: comptesEnrichis.get(v.compteDestinationId)
      ?? { id: v.compteDestinationId, libelle: v.libelleCompteDestination, proprietaires: [] },
    montant: v.montant,
  }));
}

/**
 * Groupe les virements par compte source (1 source → N destinations) avec le total sortant.
 * L'ordre des groupes suit celui des virements reçus (le tri se fait en amont, côté service),
 * pour que la carte du dashboard et le tableau du drawer racontent la même histoire.
 */
export function grouperParCompteSource<T extends VirementResolu>(virements: readonly T[]): GroupeVirementsSource[] {
  const parSource = new Map<string, GroupeVirementsSource>();
  for (const v of virements) {
    let groupe = parSource.get(v.source.id);
    if (!groupe) {
      groupe = { compteSource: v.source, virements: [], total: 0 };
      parSource.set(v.source.id, groupe);
    }
    groupe.virements.push(v);
    groupe.total += v.montant;
  }
  return [...parSource.values()];
}
