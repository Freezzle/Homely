import { Indicator } from '../../shared/models/indicator.model';
import { EvolutionGraphiqueDrawerContentComponent } from './evolution-graphique-drawer-content.component';
import { AppTranslations } from '../../../../core/i18n/i18n.types';
import { FormateurMontant } from '../visuel-indicateur.util';

/**
 * Construit la carte + drawer de l'indicateur "Évolution graphique" (annuel uniquement).
 * Visuel : sparkline de la trésorerie cumulée prévue sur les 12 mois ; valeur = trésorerie
 * en fin d'année, variation vs la fin de l'année précédente (masquée à 0 si inconnue).
 */
export function evolutionGraphiqueIndicator(
  tresorerieCumulee: number[],
  tresorerieFinAnneePrecedente: number | null,
  formatMontant: FormateurMontant,
  t: AppTranslations,
): Indicator {
  const fin = tresorerieCumulee.length ? tresorerieCumulee[tresorerieCumulee.length - 1] : 0;
  const reference = tresorerieFinAnneePrecedente;
  const delta = reference ? (fin - reference) / Math.abs(reference) : 0;
  const debut = tresorerieCumulee[0] ?? 0;

  return {
    key: 'evolution-graphique',
    title: t.dashboard.indicateurEvolutionGraphiqueTitre,
    subtitle: t.dashboard.indicateurEvolutionGraphiqueSousTitre,
    badgeTexte: t.dashboard.tresorerieTitle,
    visuel: tresorerieCumulee.length
      ? {
          type: 'sparkline',
          serie: tresorerieCumulee,
          valeur: formatMontant(fin),
          delta,
          // Sans référence N-1, la couleur suit la pente de l'année plutôt que le delta (nul).
          ton: reference ? undefined : (fin >= debut ? 'succes' : 'danger'),
        }
      : { type: 'vide', message: t.dashboard.indicateurAucuneDonnee },
    drawerContent: EvolutionGraphiqueDrawerContentComponent,
  };
}
