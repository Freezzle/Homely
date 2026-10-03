import { Indicator } from '../../shared/models/indicator.model';
import { BesoinsPlaisirsCardData } from '../../../../shared/components/besoins-plaisirs-card/besoins-plaisirs-card.component';
import { formatTaux } from '../../../../shared/utils/format-taux.util';
import { BesoinsPlaisirsDrawerContentComponent } from './besoins-plaisirs-drawer-content.component';
import { AppTranslations } from '../../../../core/i18n/i18n.types';
import { SeuilsDashboardDto } from '../../../../core/models/api.models';
import { FormateurMontant, segmentsProportionnels } from '../visuel-indicateur.util';

type BesoinsPlaisirsIndicatorSeuils = Pick<SeuilsDashboardDto, 'besoinsPlaisirsBudget'>;

/**
 * Construit la carte + drawer de l'indicateur "Plaisirs vs Besoins", à partir des données
 * déjà résolues (`BesoinsPlaisirsCardData`, auto-scopées foyer/membre). Visuel : barre
 * empilée du revenu (Besoins / Plaisirs / Reste du budget). Badge = **taux budget**
 * (Besoins / revenus totaux), en `danger` au-delà du seuil `besoinsPlaisirsBudget`.
 */
export function besoinsPlaisirsIndicator(
  cle: string,
  data: BesoinsPlaisirsCardData,
  t: AppTranslations,
  seuils: BesoinsPlaisirsIndicatorSeuils,
  formatMontant: FormateurMontant,
): Indicator {
  const total = data.montantBesoins + data.montantPlaisirs;
  const tauxBesoinsBudget = data.revenusTotal > 0 ? (data.montantBesoins / data.revenusTotal) * 100 : 0;
  const segments = segmentsProportionnels(
    [
      { libelle: t.dashboard.besoinsPlaisirsBesoins, montant: data.montantBesoins, ton: 'charge' },
      { libelle: t.dashboard.besoinsPlaisirsPlaisirs, montant: data.montantPlaisirs, ton: 'argent-poche' },
      { libelle: t.dashboard.besoinsPlaisirsResteBudget, montant: data.revenusTotal - total, ton: 'neutre' },
    ],
    data.revenusTotal,
    formatMontant,
  );

  return {
    key: cle,
    title: t.dashboard.indicateurBesoinsPlaisirsTitre,
    subtitle: t.dashboard.indicateurBesoinsPlaisirsSousTitre,
    badgeTexte: total > 0 ? `${formatTaux(tauxBesoinsBudget)}% ${t.dashboard.indicateurBesoinsPlaisirsInfoSousTitre}` : t.dashboard.besoinsPlaisirsNA,
    badgeTon: total > 0 ? (tauxBesoinsBudget > seuils.besoinsPlaisirsBudget ? 'danger' : 'succes') : undefined,
    visuel: total > 0 && segments.length
      ? { type: 'barre-empilee', segments }
      : { type: 'vide', message: t.dashboard.besoinsPlaisirsNaRaison },
    drawerContent: BesoinsPlaisirsDrawerContentComponent,
  };
}
