import { Indicator } from '../../shared/models/indicator.model';
import { IconColor } from '../../shared/models/icon-color.type';
import { VentilationPostesDrawerContentComponent } from './ventilation-postes-drawer-content.component';
import { AppTranslations } from '../../../../core/i18n/i18n.types';

/**
 * Construit la déclaration de carte + drawer pour l'indicateur "Ventilations des postes",
 * à partir du solde restant déjà calculé (`agregatMoisCourant()/agregatAnneeCourant()`).
 * `soldeRestantFormate` doit déjà être formaté avec la devise (réutilise `formatMontant` du
 * dashboard) pour éviter de dupliquer la logique de formatage ici.
 */
export function ventilationPostesIndicator(
  cle: string,
  soldeRestant: number,
  soldeRestantFormate: string,
  t: AppTranslations,
): Indicator {
  const infoColor: IconColor = soldeRestant >= 0 ? 'pos' : 'red';

  return {
    key: cle,
    icon: 'pi pi-chart-pie',
    iconColor: 'gray',
    title: t.dashboard.indicateurVentilationPostesTitre,
    info: soldeRestantFormate,
    infoColor,
    infoSubtitle: t.dashboard.soldeRestant,
    drawerContent: VentilationPostesDrawerContentComponent,
  };
}
