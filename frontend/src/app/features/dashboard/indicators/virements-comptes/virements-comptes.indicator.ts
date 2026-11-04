import { Indicator } from '../../shared/models/indicator.model';
import {
  GroupeListeGroupee,
  LigneListeGroupee,
  MembreListeGroupee,
} from '../../../../shared/components/indicateurs/liste-groupee/indicateur-liste-groupee.component';
import { CompteDto, MembreDto, VirementCompteDto } from '../../../../core/models/api.models';
import { VirementsComptesDrawerContentComponent } from './virements-comptes-drawer-content.component';
import { AppTranslations } from '../../../../core/i18n/i18n.types';
import { FormateurMontant } from '../visuel-indicateur.util';
import { enrichirComptes, grouperParCompteSource, resoudreVirements } from '../../shared/utils/virements-comptes.util';

/** Référentiels nécessaires pour signaler les comptes appartenant à un autre membre. */
export interface ContexteMembresVirements {
  comptes: readonly CompteDto[];
  membres: readonly MembreDto[];
  membreActuelId: string | null;
  initiales: (nom: string) => string;
}

/** Titulaires d'un compte, affichés en pastilles (initiales sur fond de leur couleur). */
function pastillesTitulaires(
  ctx: ContexteMembresVirements,
  proprietaires: readonly MembreDto[],
): MembreListeGroupee[] {
  return proprietaires.map((m) => ({ nom: m.nom, initiales: ctx.initiales(m.nom), couleur: m.couleur }));
}

/**
 * Construit la carte + drawer de l'indicateur "Virements des comptes" (vue membre, mois
 * ou année — mêmes données que l'onglet "Comptes"). Visuel : liste groupée par compte
 * source, reprenant la structure du tableau du drawer (en-tête = source + total à envoyer,
 * lignes = destinations + montant) ; badge = total des virements sortants.
 *
 * <p>Un clic sur une ligne de destination appelle `onVirementClick` avec la clé
 * `compteSourceId::compteDestinationId`, ce qui ouvre la popin de composition.</p>
 */
export function virementsComptesIndicator(
  cle: string,
  virements: VirementCompteDto[],
  formatMontant: FormateurMontant,
  t: AppTranslations,
  contexte: ContexteMembresVirements,
  onVirementClick?: (cleVirement: string) => void,
): Indicator {
  const total = virements.reduce((somme, v) => somme + v.montant, 0);
  const resolus = resoudreVirements(
    [...virements].filter((v) => v.montant > 0).sort((a, b) => b.montant - a.montant),
    enrichirComptes(contexte.comptes, contexte.membres),
  );

  const groupes: GroupeListeGroupee[] = grouperParCompteSource(resolus).map((groupe) => {
    const lignes: LigneListeGroupee[] = groupe.virements.map((v) => ({
      cle: v.cle,
      libelle: v.destination.libelle,
      membres: pastillesTitulaires(contexte, v.destination.proprietaires),
      valeurAffichee: formatMontant(v.montant),
    }));
    const nb = groupe.virements.length;
    return {
      cle: groupe.compteSource.id,
      libelle: groupe.compteSource.libelle,
      membres: pastillesTitulaires(contexte, groupe.compteSource.proprietaires),
      sousLibelle: `${nb} ${nb > 1
        ? t.dashboard.comptesTableVirementSortantPluriel
        : t.dashboard.comptesTableVirementSortantSingulier}`,
      totalAffiche: formatMontant(groupe.total),
      totalLibelle: t.dashboard.comptesTableAEnvoyer,
      lignes,
    };
  });

  return {
    key: cle,
    title: t.dashboard.indicateurVirementsComptesTitre,
    subtitle: t.dashboard.indicateurVirementsComptesSousTitre,
    badgeTexte: `${formatMontant(total)} ${t.dashboard.indicateurVirementsComptesInfoSousTitre}`,
    visuel: groupes.length
      ? { type: 'liste-groupee', groupes, onLigneClick: onVirementClick }
      : { type: 'vide', message: t.dashboard.aucunVirementPeriode },
    drawerContent: VirementsComptesDrawerContentComponent,
    sansBoutonDetail: true,
  };
}
