import { CompteDto, MembreDto } from '../../core/models/api.models';
import { OptionChoix } from '../../shared/components/choix-cartes/option-choix.model';
import { normaliserCouleur } from '../../shared/utils/couleur.util';

/** Pastilles des membres rattachés à un compte (un compte joint en porte plusieurs). */
export function pastillesMembres(
  compte: CompteDto,
  membres: readonly MembreDto[],
): { couleur: string; libelle: string }[] {
  return membres
    .filter(m => compte.membreIds?.includes(m.id))
    .map(m => ({ couleur: normaliserCouleur(m.couleur), libelle: m.nom }));
}

/**
 * Cartes de comptes : chaque compte porte les pastilles et les noms des membres
 * qui y sont rattachés, pour distinguer d'un coup d'œil un compte personnel d'un
 * compte partagé.
 */
export function optionsComptes(
  comptes: readonly CompteDto[],
  membres: readonly MembreDto[],
  membreId?: string | null,
): OptionChoix<string>[] {
  const liste = membreId ? comptes.filter(c => c.membreIds?.includes(membreId)) : comptes;
  return liste.map(c => {
    const pastilles = pastillesMembres(c, membres);
    return {
      value: c.id,
      titre: c.libelle,
      sousTitre: pastilles.map(p => p.libelle).join(' · ') || undefined,
      pastilles,
    };
  });
}
