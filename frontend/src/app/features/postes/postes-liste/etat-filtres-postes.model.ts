import { NaturePoste } from '../../../core/models/api.models';

/** Critère de tri et de regroupement des postes (voir docs/features/feature_3.md §5). */
export type CritereTri = 'DATE' | 'CATEGORIE' | 'DESCRIPTION';

/** Regroupement indépendant du tri (§5) ; 'AUCUN' désactive les séparateurs de groupe. */
export type CritereRegroupement = CritereTri | 'AUCUN';

/** État d'activité d'un poste dérivé de sa fenêtre de validité (§6, section "État"). */
export type FiltreEtatPoste = 'ACTIF' | 'A_VENIR' | 'TERMINE';

/**
 * État unifié de la barre filtres/tri (§10) : un seul objet, synchronisé avec l'URL
 * (queryParams) pour rendre le retour arrière du navigateur cohérent et permettre le
 * partage d'une vue. `recherche` et les 5 tableaux de `filtres.*` ne sont jamais
 * mémorisés au-delà de l'URL courante ; `tri`/`regrouperPar` peuvent en plus
 * être mémorisés par utilisateur en localStorage (préférences d'affichage, pas de
 * donnée métier). Le regroupement fait foi : le tri s'applique au sein de chaque
 * groupe, pas sur la liste entière (voir `comparerParGroupe` dans le composant).
 */
export interface EtatFiltresPostes {
  recherche: string;
  tri: CritereTri;
  regrouperPar: CritereRegroupement;
  filtreEtat: FiltreEtatPoste[];
  filtreNature: NaturePoste[];
  filtreCategorieIds: string[];
  filtreCompteIds: string[];
  filtreMembreIds: string[];
}

export const ETAT_FILTRES_PAR_DEFAUT: EtatFiltresPostes = {
  recherche: '',
  tri: 'DESCRIPTION',
  regrouperPar: 'CATEGORIE',
  filtreEtat: [],
  filtreNature: [],
  filtreCategorieIds: [],
  filtreCompteIds: [],
  filtreMembreIds: [],
};

/**
 * Couplage tri/regroupement (§5, demande utilisateur du 2026-08-29) : le critère de
 * regroupement impose un critère de tri par défaut (redondant avec le regroupement,
 * donc sans intérêt comme critère de tri secondaire) — `null` si le regroupement est
 * 'AUCUN' (tri libre, aucune contrainte).
 * - `regrouperPar==='DATE'` (« Grouper par mois ») : tri par défaut DESCRIPTION (les
 *   critères DESCRIPTION et CATEGORIE restent sélectionnables, voir `triDesactive`).
 * - `regrouperPar==='DESCRIPTION'` (« Groupé par Alphabet ») : tri par défaut DATE.
 * - `regrouperPar==='CATEGORIE'` (« Groupé par catégorie ») : tri par défaut DESCRIPTION.
 */
export function triImposeParRegroupement(regrouperPar: CritereRegroupement): CritereTri | null {
  switch (regrouperPar) {
    case 'DATE': return 'DESCRIPTION';
    case 'DESCRIPTION': return 'DATE';
    case 'CATEGORIE': return 'DESCRIPTION';
    default: return null;
  }
}

/**
 * Un critère de tri est désactivé dans le menu Trier s'il est redondant avec le
 * regroupement actuel (même critère) — les deux autres critères restent toujours
 * sélectionnables, quel que soit le regroupement (§5).
 */
export function triDesactive(critere: CritereTri, regrouperPar: CritereRegroupement): boolean {
  return critere === regrouperPar;
}

/** Nombre de filtres actifs affiché sur le bouton « Filtres » (§6). Recherche et tri exclus. */
export function compterFiltresActifs(etat: EtatFiltresPostes): number {
  return etat.filtreEtat.length
    + etat.filtreNature.length
    + etat.filtreCategorieIds.length
    + etat.filtreCompteIds.length
    + etat.filtreMembreIds.length;
}

/** Une facette avec son volume (nombre de postes qui matcheraient si elle était sélectionnée). */
export interface OptionFacette {
  id: string;
  label: string;
  count: number;
}
