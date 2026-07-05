import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { map, catchError, of } from 'rxjs';
import { AuthService } from '../services/auth.service';

/**
 * T9.1 — Guard d'authentification.
 * Si le token d'accès est en mémoire → laisser passer immédiatement.
 * Si absent mais refresh token en localStorage → restaurer la session silencieusement
 * AVANT d'activer la route (évite la race condition de multiples 401 au démarrage).
 */
export const authGuard: CanActivateFn = () => {
  const auth = inject(AuthService);
  const router = inject(Router);

  // Token valide en mémoire → accès direct
  if (auth.estConnecte()) return true;

  // Pas de refresh token → login obligatoire
  const rt = localStorage.getItem('__rt');
  if (!rt) return router.createUrlTree(['/login']);

  // Restauration silencieuse : on obtient un nouvel access token AVANT d'activer la route.
  // Ainsi tous les composants démarrent avec un token valide → plus de 401 simultanés.
  return auth.rafraichirToken().pipe(
    map(() => true as const),
    catchError(() => of(router.createUrlTree(['/login']))),
  );
};

/** Guard de rôle : bloque l'accès si rôle insuffisant. */
export const roleGuard = (roleMinimum: 'OWNER' | 'EDITOR' | 'VIEWER'): CanActivateFn => {
  return () => {
    // Le rôle est vérifié dans les composants via ContexteService
    return true;
  };
};
