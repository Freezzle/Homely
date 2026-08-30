import { Params } from '@angular/router';
import {
  EtatFiltresPostes, ETAT_FILTRES_PAR_DEFAUT, CritereTri, CritereRegroupement, FiltreEtatPoste,
  triImposeParRegroupement, triDesactive,
} from './etat-filtres-postes.model';
import { NaturePoste } from '../../../core/models/api.models';

const CRITERES_TRI: CritereTri[] = ['DATE', 'CATEGORIE', 'DESCRIPTION'];
const REGROUPEMENTS: CritereRegroupement[] = ['DATE', 'CATEGORIE', 'DESCRIPTION', 'AUCUN'];
const ETATS: FiltreEtatPoste[] = ['ACTIF', 'A_VENIR', 'TERMINE'];
const NATURES: NaturePoste[] = ['EFFECTIF', 'ESTIMATION'];

function splitIds(v: string | undefined | null): string[] {
  return v ? v.split(',').filter(Boolean) : [];
}

/**
 * Reconstruit l'état des filtres à partir des `queryParams` de la route (§10 :
 * recharger la page ou revenir en arrière restitue exactement la même vue).
 * Toute valeur absente ou invalide retombe sur `ETAT_FILTRES_PAR_DEFAUT`. Le tri est
 * en plus corrigé s'il est incompatible avec le regroupement (§5, couplage tri/
 * regroupement) — protège contre une URL/favori obsolète.
 *
 * `filtreEtat` a un défaut non vide (`['ACTIF']`) : l'absence du paramètre `etat`
 * retombe donc sur ce défaut, tandis que la valeur spéciale `'AUCUN'` distingue le
 * choix explicite de l'utilisateur de tout désélectionner (aucun état filtré, tous
 * les postes affichés) — sans ce marqueur, les deux cas seraient indiscernables
 * dans l'URL (voir `etatFiltresVersQueryParams`).
 */
export function etatFiltresDepuisQueryParams(params: Params): EtatFiltresPostes {
  const regrouperPar = REGROUPEMENTS.includes(params['regrouper']) ? params['regrouper'] : ETAT_FILTRES_PAR_DEFAUT.regrouperPar;
  const triBrut = CRITERES_TRI.includes(params['tri']) ? params['tri'] : ETAT_FILTRES_PAR_DEFAUT.tri;
  const tri = triDesactive(triBrut, regrouperPar) ? (triImposeParRegroupement(regrouperPar) ?? triBrut) : triBrut;
  const filtreEtatParam = params['etat'];
  const filtreEtat = filtreEtatParam === 'AUCUN'
    ? []
    : typeof filtreEtatParam === 'string'
      ? splitIds(filtreEtatParam).filter((v): v is FiltreEtatPoste => (ETATS as string[]).includes(v))
      : ETAT_FILTRES_PAR_DEFAUT.filtreEtat;
  return {
    recherche: typeof params['q'] === 'string' ? params['q'] : ETAT_FILTRES_PAR_DEFAUT.recherche,
    tri,
    regrouperPar,
    filtreEtat,
    filtreNature: splitIds(params['nature']).filter((v): v is NaturePoste => (NATURES as string[]).includes(v)),
    filtreCategorieIds: splitIds(params['categories']),
    filtreCompteIds: splitIds(params['comptes']),
    filtreMembreIds: splitIds(params['membres']),
  };
}

/**
 * Sérialise l'état vers des `queryParams`. Les valeurs égales au défaut sont omises
 * (`null`) pour garder une URL propre.
 */
/**
 * Sérialise l'état vers des `queryParams`. Les valeurs égales au défaut sont omises
 * (`null`) pour garder une URL propre. `filtreEtat` utilise le marqueur `'AUCUN'`
 * quand l'utilisateur a explicitement désélectionné tous les états (défaut non vide,
 * voir `etatFiltresDepuisQueryParams`).
 */
export function etatFiltresVersQueryParams(etat: EtatFiltresPostes): Params {
  const filtreEtatEstDefaut = etat.filtreEtat.length === ETAT_FILTRES_PAR_DEFAUT.filtreEtat.length
    && etat.filtreEtat.every(v => ETAT_FILTRES_PAR_DEFAUT.filtreEtat.includes(v));
  return {
    q: etat.recherche || null,
    tri: etat.tri !== ETAT_FILTRES_PAR_DEFAUT.tri ? etat.tri : null,
    regrouper: etat.regrouperPar !== ETAT_FILTRES_PAR_DEFAUT.regrouperPar ? etat.regrouperPar : null,
    etat: filtreEtatEstDefaut ? null : (etat.filtreEtat.length ? etat.filtreEtat.join(',') : 'AUCUN'),
    nature: etat.filtreNature.length ? etat.filtreNature.join(',') : null,
    categories: etat.filtreCategorieIds.length ? etat.filtreCategorieIds.join(',') : null,
    comptes: etat.filtreCompteIds.length ? etat.filtreCompteIds.join(',') : null,
    membres: etat.filtreMembreIds.length ? etat.filtreMembreIds.join(',') : null,
  };
}

const CLE_LOCAL_STORAGE = 'homely.postes.affichage';

/** Préférences d'affichage mémorisées par utilisateur (tri/regroupement/densité), jamais les filtres (§10). */
export interface PreferencesAffichagePostes {
  tri: CritereTri;
  regrouperPar: CritereRegroupement;
  cacherDetails: boolean;
}

export function lirePreferencesAffichage(): PreferencesAffichagePostes | null {
  if (typeof localStorage === 'undefined') return null;
  try {
    const brut = localStorage.getItem(CLE_LOCAL_STORAGE);
    if (!brut) return null;
    const parse = JSON.parse(brut);
    if (!CRITERES_TRI.includes(parse.tri) || !REGROUPEMENTS.includes(parse.regrouperPar)) return null;
    return { ...parse, cacherDetails: !!parse.cacherDetails };
  } catch {
    return null;
  }
}

export function ecrirePreferencesAffichage(prefs: PreferencesAffichagePostes): void {
  if (typeof localStorage === 'undefined') return;
  localStorage.setItem(CLE_LOCAL_STORAGE, JSON.stringify(prefs));
}

/**
 * Corrige un état dont le tri serait incompatible avec le regroupement (§5, couplage
 * tri/regroupement) — utile après une combinaison des query params et des
 * préférences localStorage, chacun potentiellement partiel/obsolète.
 */
export function assurerCoherenceTri(etat: EtatFiltresPostes): EtatFiltresPostes {
  if (!triDesactive(etat.tri, etat.regrouperPar)) return etat;
  return { ...etat, tri: triImposeParRegroupement(etat.regrouperPar) ?? etat.tri };
}
