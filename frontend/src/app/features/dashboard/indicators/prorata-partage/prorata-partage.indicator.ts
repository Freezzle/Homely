import { Indicator } from '../../shared/models/indicator.model';
import { ProrataPartageMembreDto } from '../../../../core/models/api.models';
import { ProrataPartageDrawerContentComponent } from './prorata-partage-drawer-content.component';
import { AppTranslations } from '../../../../core/i18n/i18n.types';
import { formatTaux } from '../../../../shared/utils/format-taux.util';

/** Vrai si au moins un membre a des postes CHARGE/RESERVE partagés sur la période —
 *  utilisé par le dashboard pour masquer entièrement l'indicateur sinon (ex. foyer
 *  mono-membre, ou aucun poste partagé défini). */
export function aDesDonneesProrataPartage(dtos: ProrataPartageMembreDto[] | null | undefined): boolean {
  return (dtos ?? []).some((d) => d.aDesPostesPartages);
}

/**
 * Construit la déclaration de carte + drawer pour l'indicateur "Prorata des postes
 * partagés", à partir des données déjà résolues (`ProrataPartageMembreDto[]`). Carte :
 * un tag coloré par membre (couleur du membre) affichant son % de prorata moyen
 * appliqué. Drawer : tableau détaillé prorata appliqué / prorata théorique-revenu /
 * écart par membre.
 */
export function prorataPartageIndicator(cle: string, dtos: ProrataPartageMembreDto[], t: AppTranslations): Indicator {
  const tags = dtos
    .filter((d) => d.aDesPostesPartages && d.prorataMoyenApplique != null)
    .map((d) => ({
      label: `${d.nomMembre ?? ''} · ${formatTaux(d.prorataMoyenApplique! * 100)}%`,
      couleur: d.couleurMembre ?? '#9CA3AF',
    }));

  return {
    key: cle,
    icon: 'pi pi-percentage',
    // Icône fixe : représente le symbole de l'indicateur, indépendante des valeurs
    // courantes (chaque membre a déjà sa propre couleur dans les tags).
    iconColor: 'gray',
    title: t.dashboard.indicateurProrataPartageTitre,
    subtitle: t.dashboard.indicateurProrataPartageSousTitre,
    tags,
    drawerContent: ProrataPartageDrawerContentComponent,
  };
}
