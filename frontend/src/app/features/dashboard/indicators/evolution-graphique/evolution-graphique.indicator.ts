import { Indicator } from '../../shared/models/indicator.model';
import { EvolutionGraphiqueDrawerContentComponent } from './evolution-graphique-drawer-content.component';
import { AppTranslations } from '../../../../core/i18n/i18n.types';

const NOMBRE_GRAPHIQUES = 3;

/**
 * Construit la déclaration de carte + drawer pour l'indicateur "Évolution graphique". Annuel
 * uniquement (la vue mensuelle n'a pas d'onglet Graphiques). Info = nombre de graphiques
 * disponibles (fixe, ne dépend pas des données) — pas de zone/sévérité ici, indicateur neutre.
 */
export function evolutionGraphiqueIndicator(t: AppTranslations): Indicator {
  return {
    key: 'evolution-graphique',
    icon: 'pi pi-chart-line',
    iconColor: 'gray',
    title: t.dashboard.indicateurEvolutionGraphiqueTitre,
    info: String(NOMBRE_GRAPHIQUES),
    infoColor: 'gray',
    infoSubtitle: t.dashboard.indicateurEvolutionGraphiqueInfoSousTitre,
    drawerContent: EvolutionGraphiqueDrawerContentComponent,
  };
}
