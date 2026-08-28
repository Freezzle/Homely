import { Indicator } from '../../shared/models/indicator.model';
import { IconColor } from '../../shared/models/icon-color.type';
import { VirementCompteDto } from '../../../../core/models/api.models';
import { VirementsComptesDrawerContentComponent } from './virements-comptes-drawer-content.component';
import { AppTranslations } from '../../../../core/i18n/i18n.types';

/**
 * Construit la déclaration de carte + drawer pour l'indicateur "Virements des comptes"
 * (vue membre uniquement, mois ou année — mêmes données que l'onglet "Comptes",
 * `virementsComptesDto()`/`virementsComptesAnnuelDto()`). Info = total des virements sortants
 * (somme des montants des paires source → destination).
 */
export function virementsComptesIndicator(cle: string, virements: VirementCompteDto[], totalFormate: string, t: AppTranslations): Indicator {
  return {
    key: cle,
    icon: 'pi pi-wallet',
    iconColor: 'gray',
    title: t.dashboard.indicateurVirementsComptesTitre,
    subtitle: t.dashboard.indicateurVirementsComptesSousTitre,
    info: totalFormate,
    infoColor: 'gray',
    infoSubtitle: t.dashboard.indicateurVirementsComptesInfoSousTitre,
    drawerContent: VirementsComptesDrawerContentComponent,
  };
}
