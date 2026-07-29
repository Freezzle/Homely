import { PosteDto } from '../models/api.models';
import { parseIsoDateLocal } from './date.util';

/**
 * Helpers purs de périodicité/clôture pour les postes, extraits de
 * `postes-liste.component.ts` (dialogs révision/clôture/décalage). Aucune dépendance à
 * une instance de composant : uniquement des fonctions `PosteDto -> Date/boolean`, pour
 * pouvoir être réutilisées telles quelles dans les sous-composants dédiés.
 *
 * ⚠️ Logique business-critique (ancrage de la périodicité, doc 01 §3.4) : ne pas modifier
 * le comportement, seulement le lieu où ces fonctions vivent.
 */

/** Dernier jour du mois contenant la date donnée. */
export function finDeMois(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth() + 1, 0);
}

/** Vrai si le poste ne débute qu'à partir d'un mois strictement postérieur au mois courant. */
export function posteDebuteApresMoisCourant(p: PosteDto, maintenant: Date = new Date()): boolean {
  if (!p.debut) return false;
  const debut = parseIsoDateLocal(p.debut);
  return debut.getFullYear() * 12 + debut.getMonth() > maintenant.getFullYear() * 12 + maintenant.getMonth();
}

/**
 * Mois retenu par l'option « Terminer ce mois-ci » : le mois courant, sauf si le poste
 * ne débute que plus tard, auquel cas on retient son mois de début (impossible de
 * clôturer un poste avant même qu'il ait commencé).
 */
export function moisEffectifCloture(p: PosteDto, maintenant: Date = new Date()): Date {
  if (!p.debut) return maintenant;
  const debut = parseIsoDateLocal(p.debut);
  return debut.getFullYear() * 12 + debut.getMonth() > maintenant.getFullYear() * 12 + maintenant.getMonth() ? debut : maintenant;
}

/**
 * Reproduit l'ancre de périodicité du moteur (doc 01 §3.4) : trouve, en index de mois
 * global (année*12+mois), le premier mois strictement après le mois courant qui tombe
 * sur le cycle du poste (ancré sur son mois de début), c-à-d le prochain mois où le
 * poste aurait normalement généré une contribution.
 */
export function prochainMoisPeriodique(p: PosteDto, maintenant: Date = new Date()): Date {
  const d = p.periodiciteMois;
  const debut = p.debut ? parseIsoDateLocal(p.debut) : maintenant;
  const ancreGlobal = debut.getFullYear() * 12 + debut.getMonth();
  let candidat = maintenant.getFullYear() * 12 + maintenant.getMonth() + 1;
  while (((candidat - ancreGlobal) % d + d) % d !== 0) {
    candidat++;
  }
  return new Date(Math.floor(candidat / 12), (candidat % 12) - 1, 1);
}
