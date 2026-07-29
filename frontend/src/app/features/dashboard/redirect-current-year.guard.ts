import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { ContexteService } from '../../core/services/contexte.service';

/**
 * Redirige `/f/:foyerId/dashboard` (sans année) vers l'année courante,
 * en conservant les query params (ex. `scenarioId`) — voir docs/refactor/06-routing-urls.md.
 */
export const redirectToCurrentYearGuard: CanActivateFn = (route) => {
  const router = inject(Router);
  const contexte = inject(ContexteService);
  const foyerId = route.parent?.paramMap.get('foyerId') ?? contexte.foyerId();
  const anneeCourante = new Date().getFullYear();
  return router.createUrlTree(['f', foyerId, 'dashboard', String(anneeCourante)], {
    queryParamsHandling: 'preserve',
  });
};
