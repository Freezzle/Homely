import { HttpInterceptorFn, HttpRequest, HttpHandlerFn, HttpErrorResponse } from '@angular/common/http';
import { inject } from '@angular/core';
import { catchError, switchMap, throwError } from 'rxjs';
import { AuthService } from '../services/auth.service';

/**
 * T9.1 — Interceptor JWT : ajoute le Bearer token + refresh transparent sur 401.
 * Le verrou anti-double-refresh est géré par AuthService.rafraichirToken() (shareReplay) :
 * si plusieurs requêtes arrivent simultanément avec un token expiré, un seul appel
 * /refresh est fait et toutes les requêtes en attente repartent avec le nouveau token.
 */
export const jwtInterceptor: HttpInterceptorFn = (
  req: HttpRequest<unknown>,
  next: HttpHandlerFn
) => {
  const auth = inject(AuthService);
  const token = auth.token();

  const reqWithToken = token
    ? req.clone({ setHeaders: { Authorization: `Bearer ${token}` } })
    : req;

  return next(reqWithToken).pipe(
    catchError((err: HttpErrorResponse) => {
      // Refresh transparent sur 401 (sauf endpoints d'auth eux-mêmes)
      if (err.status === 401 && !req.url.includes('/api/auth/')) {
        return auth.rafraichirToken().pipe(
          switchMap(res => {
            const retried = req.clone({ setHeaders: { Authorization: `Bearer ${res.accessToken}` } });
            return next(retried);
          })
        );
      }
      return throwError(() => err);
    })
  );
};
