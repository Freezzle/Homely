import { Indicator } from '../../shared/models/indicator.model';
import { IconColor } from '../../shared/models/icon-color.type';
import { CompteRecapMensuelDto } from '../../../../core/models/api.models';
import { VirementsComptesDrawerContentComponent } from './virements-comptes-drawer-content.component';
import { AppTranslations } from '../../../../core/i18n/i18n.types';

/**
 * Construit la déclaration de carte + drawer pour l'indicateur "Virements des comptes"
 * (vue membre uniquement, mois ou année — mêmes données que l'onglet "Comptes",
 * `comptesRecapDto()`/`comptesRecapAnnuelDto()`). Info = total des virements sortants sur
 * tous les comptes.
 */
export function virementsComptesIndicator(cle: string, recaps: CompteRecapMensuelDto[], totalFormate: string, t: AppTranslations): Indicator {
  const infoColor: IconColor = recaps.some((r) => r.soldeRestant < 0) ? 'red' : 'gray';

  return {
    key: cle,
    icon: 'pi pi-wallet',
    iconColor: 'gray',
    title: t.dashboard.indicateurVirementsComptesTitre,
    subtitle: t.dashboard.indicateurVirementsComptesSousTitre,
    info: totalFormate,
    infoColor,
    infoSubtitle: t.dashboard.indicateurVirementsComptesInfoSousTitre,
    drawerContent: VirementsComptesDrawerContentComponent,
  };
}
