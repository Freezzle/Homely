import { Indicator } from '../../shared/models/indicator.model';
import { TauxEffortCardData, TauxEffortZone, TON_PAR_ZONE_EFFORT } from '../../../../shared/components/taux-effort-card/taux-effort-card.component';
import { TauxEffortMembreDrawerContentComponent } from './taux-effort-membre-drawer-content.component';
import { AppTranslations } from '../../../../core/i18n/i18n.types';
import { SeuilsDashboardDto } from '../../../../core/models/api.models';
import { formatTaux } from '../../../../shared/utils/format-taux.util';
import { FormateurMontant } from '../visuel-indicateur.util';

type TauxEffortIndicatorSeuils = Pick<SeuilsDashboardDto, 'tauxEffortCorrect' | 'tauxEffortTendu' | 'tauxEffortSature'>;

function zoneDe(tauxEffort: number, seuils: TauxEffortIndicatorSeuils): TauxEffortZone {
  if (tauxEffort < seuils.tauxEffortCorrect) return 'CONFORTABLE';
  if (tauxEffort < seuils.tauxEffortTendu) return 'CORRECT';
  if (tauxEffort < seuils.tauxEffortSature) return 'TENDU';
  return 'SATURE';
}

/**
 * Construit la carte + drawer de l'indicateur "Taux d'effort" d'un membre, à partir des
 * données déjà résolues (`TauxEffortCardData`, mensuel ou annuel). Visuel : barre de
 * progression `charges + réserves` / `revenus`, **colorée selon la zone**
 * (`TON_PAR_ZONE_EFFORT` : vert → jaune → orange → rouge), part restante dans le gris
 * « restant ». Le badge porte le taux d'effort et reprend exactement le même ton, comme
 * les 3 jauges du drawer.
 */
export function tauxEffortMembreIndicator(
  data: TauxEffortCardData,
  t: AppTranslations,
  seuils: TauxEffortIndicatorSeuils,
  formatMontant: FormateurMontant,
): Indicator {
  const disponible = data.revenusTotal > 0;
  const effort = data.chargesTotal + data.reservesTotal;
  const tauxEffort = disponible ? (effort / data.revenusTotal) * 100 : 0;
  const reste = Math.max(0, data.revenusTotal - effort);
  const ton = TON_PAR_ZONE_EFFORT[zoneDe(tauxEffort, seuils)];

  return {
    key: `taux-effort-${data.membre.id}`,
    title: `${t.projection.effortCardTitreSansNom} · ${data.membre.nom}`,
    subtitle: t.projection.effortCardSousTitre,
    badgeTexte: disponible ? `${formatTaux(tauxEffort)}% ${t.dashboard.sectionTauxEffortInfoSousTitre}` : t.projection.effortCardNA,
    badgeTon: disponible ? ton : undefined,
    visuel: disponible
      ? {
          type: 'progression',
          actuel: effort,
          cible: data.revenusTotal,
          ton,
          // Revenus intégralement absorbés : la zone est de toute façon SATURE.
          tonAtteint: 'danger',
          tonPiste: 'neutre',
          actuelAffiche: formatMontant(effort),
          cibleAffichee: formatMontant(data.revenusTotal),
          resteAffiche: formatMontant(reste),
          libelleAtteint: t.projection.effortCardRevenusDepasses,
        }
      : { type: 'vide', message: t.projection.effortCardNaRaison },
    drawerContent: TauxEffortMembreDrawerContentComponent,
  };
}
