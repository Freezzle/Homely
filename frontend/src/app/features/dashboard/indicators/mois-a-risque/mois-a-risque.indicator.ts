import { Indicator } from '../../shared/models/indicator.model';
import { CelluleHeatmap } from '../../../../shared/components/indicateurs/heatmap/indicateur-heatmap.component';
import { TonIndicateur } from '../../../../shared/components/indicateurs/tons';
import { MoisARisqueDrawerContentComponent } from './mois-a-risque-drawer-content.component';
import { AppTranslations } from '../../../../core/i18n/i18n.types';
import { FormateurMontant } from '../visuel-indicateur.util';
import { niveauSanteMois } from '../../shared/utils/sante-mois.util';

export interface SoldeMois {
  /** Libellé complet du mois (ex. « Janvier »). */
  label: string;
  soldeDisponible: number;
  /** Revenus du mois, base du seuil de santé (5 % du revenu). */
  revenus: number;
}

/** Même règle que `monthsHealth` : négatif / sous 5 % du revenu / confortable. */
function tonDuMois(mois: SoldeMois): TonIndicateur {
  switch (niveauSanteMois(mois.soldeDisponible, mois.revenus)) {
    case 'low':
      return 'danger';
    case 'mid':
      return 'attention';
    default:
      return 'succes';
  }
}

/**
 * Construit la carte + drawer de l'indicateur "Mois à risque" (vue année) : heatmap des
 * 12 mois colorés selon leur solde disponible rapporté au revenu du mois (vert ≥ 5 %,
 * jaune entre 0 % et 5 %, rouge si négatif) ; badge = nombre de mois à solde négatif.
 */
export function moisARisqueIndicator(
  mois: SoldeMois[],
  formatMontant: FormateurMontant,
  t: AppTranslations,
): Indicator {
  const nombreMoisARisque = mois.filter((m) => m.soldeDisponible < 0).length;
  const cellules: CelluleHeatmap[] = mois.map((m) => ({
    libelle: m.label.charAt(0).toUpperCase(),
    ton: tonDuMois(m),
    infobulle: `${m.label} · ${formatMontant(m.soldeDisponible)}`,
  }));

  return {
    key: 'mois-a-risque',
    title: t.dashboard.indicateurMoisARisqueTitre,
    subtitle: t.dashboard.indicateurMoisARisqueSousTitre,
    badgeTexte: mois.length ? `${nombreMoisARisque} ${t.dashboard.indicateurMoisARisqueInfoSousTitre}` : '',
    badgeTon: nombreMoisARisque > 0 ? 'danger' : 'succes',
    visuel: mois.length
      ? {
          type: 'heatmap',
          cellules,
          legende: [
            { libelle: t.dashboard.legendeMoisARisque, ton: 'danger' },
            { libelle: t.dashboard.legendeMoisASurveiller, ton: 'attention' },
            { libelle: t.dashboard.legendeMoisConfortable, ton: 'succes' },
          ],
        }
      : { type: 'vide', message: t.dashboard.indicateurAucuneDonnee },
    drawerContent: MoisARisqueDrawerContentComponent,
  };
}
