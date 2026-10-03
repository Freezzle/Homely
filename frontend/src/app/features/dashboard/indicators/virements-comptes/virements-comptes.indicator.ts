import { Indicator } from '../../shared/models/indicator.model';
import { EtapeEntonnoir, MembreSegmentEntonnoir, SegmentEntonnoir } from '../../../../shared/components/indicateurs/entonnoir/indicateur-entonnoir.component';
import { CompteDto, MembreDto, VirementCompteDto } from '../../../../core/models/api.models';
import { VirementsComptesDrawerContentComponent } from './virements-comptes-drawer-content.component';
import { AppTranslations } from '../../../../core/i18n/i18n.types';
import { FormateurMontant } from '../visuel-indicateur.util';

/** Nombre maximal de virements détaillés sur la carte ; le surplus est regroupé en « Autres ». */
const NB_VIREMENTS_MAX = 5;

/** Référentiels nécessaires pour signaler les comptes appartenant à un autre membre. */
export interface ContexteMembresVirements {
  comptes: readonly CompteDto[];
  membres: readonly MembreDto[];
  membreActuelId: string | null;
  initiales: (nom: string) => string;
}

/** Titulaires d'un compte à afficher en avatar : aucun si le membre actuel en fait partie. */
function titulairesHorsMembreActuel(ctx: ContexteMembresVirements): (compteId: string) => MembreSegmentEntonnoir[] {
  const comptesParId = new Map(ctx.comptes.map((c) => [c.id, c]));
  const membresParId = new Map(ctx.membres.map((m) => [m.id, m]));
  return (compteId) => {
    const compte = comptesParId.get(compteId);
    if (!compte || ctx.membreActuelId == null || compte.membreIds.includes(ctx.membreActuelId)) return [];
    return compte.membreIds
      .map((id) => membresParId.get(id))
      .filter((m): m is MembreDto => !!m)
      .map((m) => ({ nom: m.nom, initiales: ctx.initiales(m.nom), couleur: m.couleur }));
  };
}

/**
 * Construit la carte + drawer de l'indicateur "Virements des comptes" (vue membre, mois
 * ou année — mêmes données que l'onglet "Comptes"). Visuel : entonnoir des virements
 * « source → destination » triés par montant décroissant (largeur relative au plus gros) ;
 * badge = total des virements sortants.
 */
export function virementsComptesIndicator(
  cle: string,
  virements: VirementCompteDto[],
  formatMontant: FormateurMontant,
  t: AppTranslations,
  contexte: ContexteMembresVirements,
): Indicator {
  const titulairesAutres = titulairesHorsMembreActuel(contexte);
  const total = virements.reduce((somme, v) => somme + v.montant, 0);
  const tries = [...virements].filter((v) => v.montant > 0).sort((a, b) => b.montant - a.montant);
  const lignes: { libelle: string; montant: number; segments?: SegmentEntonnoir[] }[] = tries.slice(0, NB_VIREMENTS_MAX).map((v) => ({
    libelle: `${v.libelleCompteSource} → ${v.libelleCompteDestination}`,
    montant: v.montant,
    segments: [
      { texte: v.libelleCompteSource, membres: titulairesAutres(v.compteSourceId) },
      { texte: '→' },
      { texte: v.libelleCompteDestination, membres: titulairesAutres(v.compteDestinationId) },
    ],
  }));
  const reste = tries.slice(NB_VIREMENTS_MAX).reduce((somme, v) => somme + v.montant, 0);
  if (reste > 0) lignes.push({ libelle: t.dashboard.repartitionCategoriesAutres, montant: reste });

  const max = Math.max(...lignes.map((l) => l.montant), 0);
  const etapes: EtapeEntonnoir[] = lignes.map((l) => ({
    libelle: l.libelle,
    segments: l.segments,
    valeurAffichee: formatMontant(l.montant),
    largeurPourcent: max > 0 ? (l.montant / max) * 100 : 0,
    ton: 'info',
  }));

  return {
    key: cle,
    title: t.dashboard.indicateurVirementsComptesTitre,
    subtitle: t.dashboard.indicateurVirementsComptesSousTitre,
    badgeTexte: `${formatMontant(total)} ${t.dashboard.indicateurVirementsComptesInfoSousTitre}`,
    visuel: etapes.length
      ? { type: 'entonnoir', etapes }
      : { type: 'vide', message: t.dashboard.aucunVirementPeriode },
    drawerContent: VirementsComptesDrawerContentComponent,
  };
}
