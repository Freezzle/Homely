import { inject } from '@angular/core';
import { CanActivateFn, Router, UrlTree } from '@angular/router';
import { Observable, of } from 'rxjs';
import { catchError, map } from 'rxjs/operators';
import { ContexteService } from '../../core/services/contexte.service';
import { MembreService } from '../../core/services/referentiel.service';
import { MembreDto } from '../../core/models/api.models';

/** Détecte les 4 chiffres d'une année (rétrocompat des anciennes URLs). */
const estAnneeNumerique = (v: string | null | undefined): boolean =>
  !!v && /^\d{4}$/.test(v);

/**
 * Résout le sujet effectif à partir du sujet demandé et des membres connus du foyer.
 * La vue "foyer" (agrégée) n'a de sens qu'à partir de 2 membres : en mono-membre, on
 * force systématiquement le dashboard du membre unique, quel que soit le sujet demandé.
 */
const resoudreSujet = (sujetDemande: string, membres: MembreDto[]): string =>
  membres.length === 1 ? membres[0].id : sujetDemande;

/** Récupère les membres connus du contexte, ou les charge via l'API si absents. */
const obtenirMembres = (
  contexte: ContexteService,
  membreSvc: MembreService,
  foyerId: string | null,
): Observable<MembreDto[]> => {
  const membresConnus = contexte.membres();
  if (membresConnus.length > 0) return of(membresConnus);
  if (!foyerId) return of([]);
  return membreSvc.lister(foyerId).pipe(catchError(() => of([])));
};

/**
 * Redirige les URLs de dashboard incomplètes vers `.../dashboard/<sujet>/<annee>/<mois>` :
 * - `/f/:foyerId/dashboard`               → `.../dashboard/<sujet>/<anneeCourante>/<moisCourant>`,
 *   où `<sujet>` vaut l'id du membre unique du foyer (mono-membre) ou `foyer` sinon.
 * - `/f/:foyerId/dashboard/:sujetId`      → `.../dashboard/:sujetId/<anneeCourante>/<moisCourant>` ou,
 *   si `sujetId` est une année (URL héritée), `.../dashboard/foyer/<annee>`.
 * Les query params sont conservés (ex. `scenarioId`).
 */
export const redirectToCurrentYearGuard: CanActivateFn = (
  route,
): Observable<UrlTree> => {
  const router = inject(Router);
  const contexte = inject(ContexteService);
  const membreSvc = inject(MembreService);
  const foyerId = route.parent?.paramMap.get('foyerId') ?? contexte.foyerId();
  const sujetIdParam = route.paramMap.get('sujetId');
  const maintenant = new Date();
  const anneeCourante = String(maintenant.getFullYear());
  const moisCourant = String(maintenant.getMonth() + 1);
  const estLegacyAnnee = estAnneeNumerique(sujetIdParam);

  return obtenirMembres(contexte, membreSvc, foyerId).pipe(
    map((membres) => {
      if (estLegacyAnnee) {
        // URL héritée /dashboard/<annee> : on conserve l'année demandée (pas de mois connu).
        const sujet = resoudreSujet('foyer', membres);
        return router.createUrlTree(['f', foyerId, 'dashboard', sujet, sujetIdParam!], {
          queryParamsHandling: 'preserve',
        });
      }
      const sujet = resoudreSujet(sujetIdParam ?? 'foyer', membres);
      return router.createUrlTree(['f', foyerId, 'dashboard', sujet, anneeCourante, moisCourant], {
        queryParamsHandling: 'preserve',
      });
    }),
  );
};

/**
 * Sur les routes `dashboard/:sujetId/:annee[/:mois]`, redirige l'URL héritée
 * `dashboard/<annee>[/<mois>]` (où `sujetId` est en fait une année) vers
 * `dashboard/foyer/<annee>[/<mois>]` (ou vers le membre unique en mono-membre).
 * Sinon, laisse le composant s'activer.
 */
export const dashboardLegacyRedirectGuard: CanActivateFn = (route) => {
  const router = inject(Router);
  const contexte = inject(ContexteService);
  const membreSvc = inject(MembreService);
  const sujetIdParam = route.paramMap.get('sujetId');
  const anneeParam = route.paramMap.get('annee');
  const moisParam = route.paramMap.get('mois');

  if (!estAnneeNumerique(sujetIdParam)) {
    return true;
  }
  const foyerId = route.parent?.paramMap.get('foyerId') ?? contexte.foyerId();
  return obtenirMembres(contexte, membreSvc, foyerId).pipe(
    map((membres) => {
      const sujet = resoudreSujet('foyer', membres);
      const segments = ['f', foyerId, 'dashboard', sujet, sujetIdParam!];
      if (anneeParam) segments.push(anneeParam);
      if (moisParam) segments.push(moisParam);
      return router.createUrlTree(segments, { queryParamsHandling: 'preserve' });
    }),
  );
};
