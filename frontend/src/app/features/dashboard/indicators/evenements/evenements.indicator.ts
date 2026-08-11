import { Indicator } from '../../shared/models/indicator.model';
import { EvenementsDrawerContentComponent } from './evenements-drawer-content.component';
import { AppTranslations } from '../../../../core/i18n/i18n.types';

/**
 * Construit la déclaration de carte + drawer pour l'indicateur "Les événements du
 * mois/de l'année", à partir du nombre d'événements déjà résolu
 * (`evenementsMois()/evenementsAnnee()`). Info = compteur neutre (pas de zone/sévérité).
 */
export function evenementsIndicator(cle: string, titre: string, count: number, t: AppTranslations): Indicator {
  return {
    key: cle,
    icon: 'pi pi-calendar',
    iconColor: 'gray',
    title: titre,
    subtitle: t.dashboard.indicateurEvenementsSousTitre,
    info: String(count),
    infoColor: 'gray',
    infoSubtitle: t.dashboard.indicateurEvenementsInfoSousTitre,
    drawerContent: EvenementsDrawerContentComponent,
  };
}
