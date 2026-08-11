import { Indicator } from '../../shared/models/indicator.model';
import { IconColor } from '../../shared/models/icon-color.type';
import { TauxEffortCardData, TauxEffortZone } from '../../../../shared/components/taux-effort-card/taux-effort-card.component';
import { TauxEffortMembreDrawerContentComponent } from './taux-effort-membre-drawer-content.component';
import { AppTranslations } from '../../../../core/i18n/i18n.types';

/** Zone → couleur du texte de l'info (le taux %) — mêmes zones que `TauxEffortCardComponent`. */
const INFO_COLOR_PAR_ZONE: Record<TauxEffortZone, IconColor> = {
  CONFORTABLE: 'pos',
  CORRECT: 'blue',
  TENDU: 'yellow',
  SATURE: 'red',
};

function zoneDe(tauxEffort: number): TauxEffortZone {
  if (tauxEffort < 75) return 'CONFORTABLE';
  if (tauxEffort < 90) return 'CORRECT';
  if (tauxEffort < 95) return 'TENDU';
  return 'SATURE';
}

/**
 * Construit la déclaration de carte + drawer pour l'indicateur "Taux d'effort", à
 * partir des données déjà résolues (`TauxEffortCardData`) — mêmes données que celles
 * utilisées par `TauxEffortCardComponent` ailleurs dans le dashboard, pas de nouvel
 * appel service. Réutilisée telle quelle pour le mensuel et l'annuel. Le titre de la
 * carte est générique ("Taux d'effort" — toutes les cartes de la section partagent le
 * même libellé) ; le nom du membre distingue les cartes entre elles en sous-titre.
 */
export function tauxEffortMembreIndicator(data: TauxEffortCardData, t: AppTranslations): Indicator {
  const tauxEffort = data.revenusTotal > 0
    ? ((data.chargesTotal + data.reservesTotal) / data.revenusTotal) * 100
    : 0;
  const zone = zoneDe(tauxEffort);

  return {
    key: `taux-effort-${data.membre.id}`,
    icon: 'pi pi-gauge',
    // Icône fixe : représente le symbole de l'indicateur "Taux d'effort", indépendante
    // de la zone courante. La couleur de zone est portée par `infoColor` (le %).
    iconColor: 'gray',
    title: t.projection.effortCardTitreSansNom,
    subtitle: data.membre.nom,
    info: data.revenusTotal > 0 ? `${Math.round(tauxEffort)}%` : t.projection.effortCardNA,
    infoColor: data.revenusTotal > 0 ? INFO_COLOR_PAR_ZONE[zone] : 'gray',
    infoSubtitle: t.dashboard.sectionTauxEffortInfoSousTitre,
    drawerContent: TauxEffortMembreDrawerContentComponent,
  };
}
