import { Indicator } from '../../shared/models/indicator.model';
import { IconColor } from '../../shared/models/icon-color.type';
import { PostesAOptimiserDrawerContentComponent } from './postes-a-optimiser-drawer-content.component';
import { AppTranslations } from '../../../../core/i18n/i18n.types';
import { SeuilsDashboardDto } from '../../../../core/models/api.models';

/** Teinte de l'info (nombre de postes à optimiser) selon la sévérité, alignée sur les seuils
 *  déjà utilisés pour la matrice budgétaire (couleurPourScore). */
function infoColorPourCount(count: number): IconColor {
  if (count === 0) return 'pos';
  if (count < 5) return 'yellow';
  return 'red';
}

/**
 * Construit la déclaration de carte + drawer pour l'indicateur "Postes à optimiser".
 * Réutilisée pour la variante annuelle et la variante mensuelle (`cle` distincte pour
 * éviter toute collision de clé entre les deux). Info = nombre de postes dont le score
 * ≥ 35 (seuil « à réviser »).
 */
type PostesAOptimiserIndicatorSeuils = Pick<SeuilsDashboardDto, 'posteAOptimiserScore'>;

export function postesAOptimiserIndicator(
  cle: string,
  postes: PostePositionneDtoLike[],
  t: AppTranslations,
  seuils: PostesAOptimiserIndicatorSeuils,
): Indicator {
  const count = postes.filter((p) => p.score >= seuils.posteAOptimiserScore).length;

  return {
    key: cle,
    icon: 'pi pi-wrench',
    iconColor: 'gray',
    title: t.dashboard.indicateurPostesAOptimiserTitre,
    subtitle: t.dashboard.indicateurPostesAOptimiserSousTitre,
    info: String(count),
    infoColor: infoColorPourCount(count),
    infoSubtitle: t.dashboard.indicateurPostesAOptimiserInfoSousTitre,
    drawerContent: PostesAOptimiserDrawerContentComponent,
  };
}

/** Sous-ensemble minimal requis pour calculer le count — évite un import circulaire lourd. */
interface PostePositionneDtoLike {
  score: number;
}
