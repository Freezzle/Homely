import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { ContexteService } from '../../core/services/contexte.service';

/** Détecte les 4 chiffres d'une année (rétrocompat des anciennes URLs). */
const estAnneeNumerique = (v: string | null | undefined): boolean =>
  !!v && /^\d{4}$/.test(v);

/**
 * Redirige les URLs de dashboard incomplètes vers `.../dashboard/<sujet>/<anneeCourante>` :
 * - `/f/:foyerId/dashboard`               → `.../dashboard/foyer/<annee>`
 * - `/f/:foyerId/dashboard/:sujetId`      → `.../dashboard/:sujetId/<annee>` ou, si `sujetId`
 *   est une année (URL héritée), `.../dashboard/foyer/<annee>`.
 * Les query params sont conservés (ex. `scenarioId`).
 */
export const redirectToCurrentYearGuard: CanActivateFn = (route) => {
  const router = inject(Router);
  const contexte = inject(ContexteService);
  const foyerId = route.parent?.paramMap.get('foyerId') ?? contexte.foyerId();
  const sujetIdParam = route.paramMap.get('sujetId');
  const anneeCourante = new Date().getFullYear();

  let sujet: string;
  let annee: string;

  if (!sujetIdParam) {
    sujet = 'foyer';
    annee = String(anneeCourante);
  } else if (estAnneeNumerique(sujetIdParam)) {
    // URL héritée /dashboard/<annee>
    sujet = 'foyer';
    annee = sujetIdParam;
  } else {
    sujet = sujetIdParam;
    annee = String(anneeCourante);
  }

  return router.createUrlTree(['f', foyerId, 'dashboard', sujet, annee], {
    queryParamsHandling: 'preserve',
  });
};

/**
 * Sur les routes `dashboard/:sujetId/:annee[/:mois]`, redirige l'URL héritée
 * `dashboard/<annee>[/<mois>]` (où `sujetId` est en fait une année) vers
 * `dashboard/foyer/<annee>[/<mois>]`. Sinon, laisse le composant s'activer.
 */
export const dashboardLegacyRedirectGuard: CanActivateFn = (route) => {
  const router = inject(Router);
  const contexte = inject(ContexteService);
  const sujetIdParam = route.paramMap.get('sujetId');
  const anneeParam = route.paramMap.get('annee');
  const moisParam = route.paramMap.get('mois');

  if (!estAnneeNumerique(sujetIdParam)) {
    return true;
  }
  const foyerId = route.parent?.paramMap.get('foyerId') ?? contexte.foyerId();
  const segments = ['f', foyerId, 'dashboard', 'foyer', sujetIdParam!];
  if (anneeParam) segments.push(anneeParam);
  if (moisParam) segments.push(moisParam);
  return router.createUrlTree(segments, { queryParamsHandling: 'preserve' });
};
