import { Indicator } from '../../shared/models/indicator.model';
import { IconColor } from '../../shared/models/icon-color.type';
import { BesoinsPlaisirsCardData } from '../../../../shared/components/besoins-plaisirs-card/besoins-plaisirs-card.component';
import { formatTaux } from '../../../../shared/utils/format-taux.util';
import { BesoinsPlaisirsDrawerContentComponent } from './besoins-plaisirs-drawer-content.component';
import { AppTranslations } from '../../../../core/i18n/i18n.types';

/** Seuil (%) du taux "budget" (Besoins parmi les revenus totaux) au-delà duquel le
 *  taux de charges nécessaires est jugé élevé — même seuil que
 *  `BesoinsPlaisirsCardComponent.SEUIL_ZONE_ELEVEE_BUDGET`, dupliqué ici pour éviter une
 *  dépendance du module d'indicateur au composant riche du drawer. Le taux "charges"
 *  (28 %, besoins vs plaisirs) n'est utilisé que dans le donut du drawer, pas ici. */
const SEUIL_ZONE_ELEVEE_BUDGET = 50;

/**
 * Construit la déclaration de carte + drawer pour l'indicateur "Plaisirs vs Besoins", à
 * partir des données déjà résolues (`BesoinsPlaisirsCardData`) — mêmes données que
 * celles utilisées par `BesoinsPlaisirsCardComponent`, pas de nouvel appel. Réutilisée
 * telle quelle pour le mensuel et l'annuel : la donnée d'entrée est déjà auto-scopée
 * foyer/membre par le composant appelant (voir `agregatMoisCourant`/`agregatAnneeCourant`).
 *
 * L'info affichée est le **taux budget** (Besoins / revenus totaux, seuil 50 %) — pas
 * le taux charges-vs-charges (besoins vs plaisirs, seuil 28 %, réservé au donut du
 * drawer) : c'est la lecture la plus parlante pour l'utilisateur ("quelle part de mon
 * revenu part dans mes charges de nécessité ?").
 */
export function besoinsPlaisirsIndicator(cle: string, data: BesoinsPlaisirsCardData, t: AppTranslations): Indicator {
  const total = data.montantBesoins + data.montantPlaisirs;
  const tauxBesoinsBudget = data.revenusTotal > 0 ? (data.montantBesoins / data.revenusTotal) * 100 : 0;
  const infoColor: IconColor = tauxBesoinsBudget > SEUIL_ZONE_ELEVEE_BUDGET ? 'red' : 'pos';

  return {
    key: cle,
    icon: 'pi pi-heart',
    // Icône fixe : représente le symbole de l'indicateur, indépendante du taux courant.
    // La couleur de zone est portée par `infoColor` (le %).
    iconColor: 'gray',
    title: t.dashboard.indicateurBesoinsPlaisirsTitre,
    subtitle: t.dashboard.indicateurBesoinsPlaisirsSousTitre,
    info: total > 0 ? `${formatTaux(tauxBesoinsBudget)}%` : t.dashboard.besoinsPlaisirsNA,
    infoColor: total > 0 ? infoColor : 'gray',
    infoSubtitle: t.dashboard.indicateurBesoinsPlaisirsInfoSousTitre,
    drawerContent: BesoinsPlaisirsDrawerContentComponent,
  };
}
