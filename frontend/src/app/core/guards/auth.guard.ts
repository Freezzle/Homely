import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { map, catchError, of } from 'rxjs';
import { AuthService } from '../services/auth.service';
import { ContexteService } from '../services/contexte.service';
import { FoyerService } from '../services/referentiel.service';

/**
 * T9.1 — Guard d'authentification.
 * Si le token d'accès est en mémoire → laisser passer immédiatement.
 * Sinon, tente une restauration silencieuse de la session via le refresh token
 * (cookie httpOnly `rt`, non lisible en JS) AVANT d'activer la route — évite la
 * race condition de multiples 401 au démarrage. En l'absence de cookie valide,
 * l'appel /refresh échoue simplement (401) et on redirige vers /login.
 */
export const authGuard: CanActivateFn = () => {
  const auth = inject(AuthService);
  const router = inject(Router);

  // Token valide en mémoire → accès direct
  if (auth.estConnecte()) return true;

  // Restauration silencieuse : on obtient un nouvel access token AVANT d'activer la route.
  // Le cookie httpOnly est envoyé automatiquement (withCredentials) ; si absent/expiré,
  // le serveur répond 401 et on redirige vers /login.
  return auth.rafraichirToken().pipe(
    map(() => true as const),
    catchError(() => of(router.createUrlTree(['/login']))),
  );
};

/** Vérifie qu'un rôle satisfait le rôle minimum requis (hiérarchie OWNER > EDITOR > VIEWER). */
function satisfaitRole(role: string | null | undefined, roleMinimum: 'OWNER' | 'EDITOR' | 'VIEWER'): boolean {
  if (!role) return false;
  if (roleMinimum === 'VIEWER') return true;
  if (roleMinimum === 'EDITOR') return role === 'EDITOR' || role === 'OWNER';
  return role === 'OWNER';
}

/**
 * Guard de rôle : bloque l'accès direct par URL si le rôle de l'utilisateur dans le
 * foyer ciblé est insuffisant (ex. /acces réservé à OWNER). Le masquage du menu ne
 * suffit pas à lui seul — un accès direct par URL doit aussi être refusé.
 *
 * Le contexte foyer (et donc `monRole`) est chargé de façon asynchrone par le
 * `ShellComponent` en réaction à l'URL ; sur une navigation directe (deep-link/refresh),
 * il peut ne pas encore être disponible au moment où le guard s'exécute. Dans ce cas,
 * on recharge le foyer nous-mêmes pour connaître le rôle AVANT d'activer la route
 * (le ShellComponent le rechargera aussi ensuite, sans effet de bord).
 */
export const roleGuard = (roleMinimum: 'OWNER' | 'EDITOR' | 'VIEWER'): CanActivateFn => {
  return (route) => {
    const contexte = inject(ContexteService);
    const foyerSvc = inject(FoyerService);
    const router = inject(Router);

    const foyerId = route.paramMap.get('foyerId') ?? route.parent?.paramMap.get('foyerId');
    if (!foyerId) return true; // pas de foyer dans l'URL : rien à vérifier ici

    const acces = router.createUrlTree(['/f', foyerId, 'dashboard-mensuel']);

    if (contexte.foyerId() === foyerId) {
      return satisfaitRole(contexte.monRole(), roleMinimum) ? true : acces;
    }

    return foyerSvc.obtenir(foyerId).pipe(
      map(f => (satisfaitRole(f.monRole, roleMinimum) ? true : acces)),
      catchError(() => of(router.createUrlTree(['/foyers']))),
    );
  };
};
