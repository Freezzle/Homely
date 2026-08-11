import { Indicator } from '../../shared/models/indicator.model';
import { IconColor } from '../../shared/models/icon-color.type';
import { PostesAOptimiserDrawerContentComponent } from './postes-a-optimiser-drawer-content.component';
import { AppTranslations } from '../../../../core/i18n/i18n.types';

const SEUIL_SCORE = 35;

/** Teinte de l'info (nombre de postes à optimiser) selon la sévérité, alignée sur les seuils
 *  déjà utilisés pour la matrice budgétaire (couleurPourScore). */
function infoColorPourCount(count: number): IconColor {
  if (count === 0) return 'pos';
  if (count < 5) return 'yellow';
  return 'red';
}

/**
 * Construit la déclaration de carte + drawer pour l'indicateur "Postes à optimiser". Annuel
 * uniquement (la matrice budgétaire n'existe que dans l'onglet Graphiques annuel). Info =
 * nombre de postes dont le score ≥ 35 (seuil « à réviser »).
 */
export function postesAOptimiserIndicator(postes: PostePositionneDtoLike[], t: AppTranslations): Indicator {
  const count = postes.filter((p) => p.score >= SEUIL_SCORE).length;

  return {
    key: 'postes-a-optimiser',
    icon: 'pi pi-wrench',
    iconColor: 'gray',
    title: t.dashboard.indicateurPostesAOptimiserTitre,
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
