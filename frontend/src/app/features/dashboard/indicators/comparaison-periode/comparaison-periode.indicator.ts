import { Indicator } from '../../shared/models/indicator.model';
import { ComparaisonPeriodeDrawerContentComponent } from './comparaison-periode-drawer-content.component';
import { AppTranslations } from '../../../../core/i18n/i18n.types';

/**
 * Construit la déclaration de carte + drawer pour l'indicateur "Comparaison" — remplace
 * les anciens chips "Diff. du mois passé" / "Diff. année passée" auparavant portés par
 * `kpisMoisTop`/`kpisAnneeTop`. Le montant affiché sur la carte est la même diff de
 * reste à vivre (`differenceTresorerieMois`/`differenceTresorerieAnnuelle`, déjà
 * calculée par le dashboard) ; pas de sous-titre sur la carte (uniquement titre + info +
 * infoSubtitle), le détail (revenus/charges/réserves/argent de poche) est réservé au
 * drawer (voir `ComparaisonPeriodeDrawerContentComponent`).
 */
export function comparaisonPeriodeIndicator(
  cle: string,
  periode: 'mois' | 'annee',
  diffPrincipal: number | null,
  formatMontant: (v: number) => string,
  t: AppTranslations,
): Indicator {
  return {
    key: cle,
    icon: 'pi pi-history',
    iconColor: 'gray',
    title: periode === 'mois' ? t.dashboard.comparaisonMoisPasseTitre : t.dashboard.comparaisonAnneePasseeTitre,
    info: diffPrincipal !== null
      ? `${diffPrincipal >= 0 ? '+' : ''}${formatMontant(diffPrincipal)}`
      : '-',
    infoColor: diffPrincipal === null ? 'gray' : diffPrincipal >= 0 ? 'pos' : 'red',
    infoSubtitle: t.dashboard.comparaisonInfoSousTitre,
    drawerContent: ComparaisonPeriodeDrawerContentComponent,
  };
}
