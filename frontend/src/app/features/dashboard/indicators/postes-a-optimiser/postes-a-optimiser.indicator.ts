import { Indicator } from '../../shared/models/indicator.model';
import { TonCarte } from '../../../../shared/components/indicateurs/tons';
import { PALIERS_SCORE } from '../../../../shared/components/matrice-budgetaire/matrice-budgetaire.utils';
import { PostesAOptimiserDrawerContentComponent } from './postes-a-optimiser-drawer-content.component';
import { AppTranslations } from '../../../../core/i18n/i18n.types';
import { SeuilsDashboardDto } from '../../../../core/models/api.models';

type PostesAOptimiserIndicatorSeuils = Pick<SeuilsDashboardDto, 'posteAOptimiserScore'>;

/** Sous-ensemble minimal requis pour classer les postes — évite un import circulaire lourd. */
interface PostePositionneDtoLike {
  score: number;
}

/** Score sous lequel un poste est « à garder » : premier palier de la matrice budgétaire. */
const SEUIL_A_SURVEILLER = PALIERS_SCORE[0].seuil;

/** Teinte du badge selon le nombre de postes à optimiser — même échelle à 3 niveaux que
 *  les segments de la gaufre et les paliers de la matrice budgétaire. */
function tonPourCount(count: number): TonCarte {
  if (count === 0) return 'succes';
  if (count < 5) return 'alerte';
  return 'danger';
}

/**
 * Construit la carte + drawer de l'indicateur "Postes à optimiser" (variantes mois et
 * année, `cle` distincte). Visuel : gaufre à un point par poste classé (top N serveur),
 * coloré selon son score : à optimiser (≥ `posteAOptimiserScore`), à surveiller, à garder.
 * Les 3 tons reprennent exactement les paliers de `PALIERS_SCORE` (neutre → alerte →
 * danger), pour qu'un poste ait la même couleur ici et dans la matrice budgétaire.
 * Badge = nombre de postes à optimiser.
 */
export function postesAOptimiserIndicator(
  cle: string,
  postes: PostePositionneDtoLike[],
  t: AppTranslations,
  seuils: PostesAOptimiserIndicatorSeuils,
): Indicator {
  const seuil = seuils.posteAOptimiserScore;
  const aOptimiser = postes.filter((p) => p.score >= seuil).length;
  const aSurveiller = postes.filter((p) => p.score < seuil && p.score >= SEUIL_A_SURVEILLER).length;
  const aGarder = postes.length - aOptimiser - aSurveiller;

  return {
    key: cle,
    title: t.dashboard.indicateurPostesAOptimiserTitre,
    subtitle: t.dashboard.indicateurPostesAOptimiserSousTitre,
    badgeTexte: `${aOptimiser} ${t.dashboard.indicateurPostesAOptimiserInfoSousTitre}`,
    badgeTon: tonPourCount(aOptimiser),
    visuel: postes.length
      ? {
          type: 'gaufre',
          total: postes.length,
          segments: [
            { libelle: t.dashboard.postesZoneAOptimiser, compte: aOptimiser, ton: 'danger' },
            { libelle: t.dashboard.postesZoneASurveiller, compte: aSurveiller, ton: 'alerte' },
            { libelle: t.dashboard.postesZoneAEnvisager, compte: aGarder, ton: 'neutre' },
          ],
        }
      : { type: 'vide', message: t.dashboard.matriceAucunPoste },
    drawerContent: PostesAOptimiserDrawerContentComponent,
  };
}
