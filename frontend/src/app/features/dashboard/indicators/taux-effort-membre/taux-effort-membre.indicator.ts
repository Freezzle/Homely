import { Indicator } from '../../shared/models/indicator.model';
import { TonCarte } from '../../../../shared/components/indicateurs/tons';
import { TauxEffortCardData, TauxEffortZone } from '../../../../shared/components/taux-effort-card/taux-effort-card.component';
import { TauxEffortMembreDrawerContentComponent } from './taux-effort-membre-drawer-content.component';
import { AppTranslations } from '../../../../core/i18n/i18n.types';
import { SeuilsDashboardDto } from '../../../../core/models/api.models';
import { formatTaux } from '../../../../shared/utils/format-taux.util';
import { FormateurMontant } from '../visuel-indicateur.util';

/** Zone → ton du badge (le taux %) — mêmes zones que `TauxEffortCardComponent`. */
const TON_PAR_ZONE: Record<TauxEffortZone, TonCarte> = {
  CONFORTABLE: 'succes',
  CORRECT: 'info',
  TENDU: 'attention',
  SATURE: 'danger',
};

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
 * progression `charges + réserves` / `revenus` — part consommée en rouge « charges »,
 * part restante dans le gris « restant » (deux couleurs, jamais de ton de zone). Le badge
 * porte le taux d'effort (charges + réserves) / revenus, teinté selon la zone.
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

  return {
    key: `taux-effort-${data.membre.id}`,
    title: `${t.projection.effortCardTitreSansNom} · ${data.membre.nom}`,
    subtitle: t.projection.effortCardSousTitre,
    badgeTexte: disponible ? `${formatTaux(tauxEffort)}% ${t.dashboard.sectionTauxEffortInfoSousTitre}` : t.projection.effortCardNA,
    badgeTon: disponible ? TON_PAR_ZONE[zoneDe(tauxEffort, seuils)] : undefined,
    visuel: disponible
      ? {
          type: 'progression',
          actuel: effort,
          cible: data.revenusTotal,
          ton: 'charge',
          tonAtteint: 'charge',
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
