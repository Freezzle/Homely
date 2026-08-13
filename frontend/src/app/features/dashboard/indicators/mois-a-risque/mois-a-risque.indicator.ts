import { Indicator } from '../../shared/models/indicator.model';
import { MoisARisqueDrawerContentComponent } from './mois-a-risque-drawer-content.component';
import { AppTranslations } from '../../../../core/i18n/i18n.types';

/**
 * Construit la déclaration de carte + drawer pour l'indicateur "Mois à risque" — reprend
 * le compteur de mois à risque (solde disponible sous le seuil), auparavant porté par le
 * `app-stat-grid` du haut de la vue annuelle, ainsi que l'anneau "mois positifs vs
 * négatifs" (`app-metric-ring`, repris tel quel dans le drawer — voir
 * `MoisARisqueDrawerContentComponent`). `info` = nombre de mois à risque (texte simple,
 * pas de projection riche dans la carte).
 */
export function moisARisqueIndicator(nombreMoisARisque: number, t: AppTranslations): Indicator {
  return {
    key: 'mois-a-risque',
    icon: 'pi pi-exclamation-triangle',
    // Icône fixe : représente le symbole de l'indicateur, indépendante du nombre de mois
    // à risque courant. La couleur de zone est portée par `infoColor` (le compteur).
    iconColor: 'gray',
    title: t.dashboard.indicateurMoisARisqueTitre,
    subtitle: t.dashboard.indicateurMoisARisqueSousTitre,
    info: String(nombreMoisARisque),
    infoColor: nombreMoisARisque > 0 ? 'red' : 'pos',
    infoSubtitle: t.dashboard.indicateurMoisARisqueInfoSousTitre,
    drawerContent: MoisARisqueDrawerContentComponent,
  };
}
