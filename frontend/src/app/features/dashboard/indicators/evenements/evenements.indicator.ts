import { Indicator } from '../../shared/models/indicator.model';
import { EvenementsDrawerContentComponent } from './evenements-drawer-content.component';
import { AppTranslations } from '../../../../core/i18n/i18n.types';

/**
 * Construit la carte + drawer de l'indicateur "Les événements du mois/de l'année", à
 * partir des événements déjà résolus (`evenementsMois()/evenementsAnnee()`) : visuel
 * « nombre + tendance » (nombre d'événements de la période + écart en nombre vs période
 * précédente, ton neutre : plus d'événements n'est ni bon ni mauvais) ; badge = répartition
 * favorables / défavorables (impact budgétaire signé).
 *
 * @param nbPrecedent nombre d'événements de la période précédente, `null` si inconnu
 *   (avant le début du scénario ou en cours de chargement) — le badge de variation est
 *   alors masqué.
 * @param libelleComparaison libellé de la période de référence (ex. « vs févr. 2026 »).
 */
export function evenementsIndicator(
  cle: string,
  titre: string,
  evenements: readonly { favorable?: boolean }[],
  nbPrecedent: number | null,
  libelleComparaison: string,
  locale: string,
  t: AppTranslations,
): Indicator {
  const total = evenements.length;
  const favorables = evenements.filter((e) => e.favorable).length;
  const defavorables = total - favorables;
  const formatEcart = (ecart: number) =>
    new Intl.NumberFormat(locale, { maximumFractionDigits: 0, signDisplay: 'exceptZero' }).format(ecart);

  return {
    key: cle,
    title: titre,
    subtitle: t.dashboard.indicateurEvenementsSousTitre,
    badgeTexte: total > 0
      ? `${favorables} ${t.dashboard.evenementsFavorables.toLowerCase()} · ${defavorables} ${t.dashboard.evenementsDefavorables.toLowerCase()}`
      : undefined,
    visuel: {
      type: 'nombre-tendance',
      valeur: `${total}`,
      unite: t.dashboard.indicateurEvenementsInfoSousTitre,
      delta: nbPrecedent === null ? null : total - nbPrecedent,
      deltaNeutre: true,
      formateurDelta: formatEcart,
      libelleComparaison: nbPrecedent === null ? '' : libelleComparaison,
    },
    drawerContent: EvenementsDrawerContentComponent,
  };
}
