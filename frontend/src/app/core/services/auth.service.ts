import { Injectable, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Router } from '@angular/router';
import { Observable, tap, catchError, throwError, finalize, shareReplay } from 'rxjs';
import { LoginRequest, RegisterRequest, TokensResponse, MoiResponse } from '../models/api.models';
import { ContexteService } from './contexte.service';

/**
 * T9.1 — Service d'authentification.
 * accessToken : signal en mémoire (effacé au refresh navigateur).
 * refreshToken : localStorage (persiste après fermeture navigateur/nouvel onglet).
 * Verrou _refreshObservable : une seule requête refresh à la fois (shareReplay),
 * évite la race condition de multiples 401 simultanés au redémarrage.
 */
@Injectable({ providedIn: 'root' })
export class AuthService {
  private readonly _token = signal<string | null>(null);
  readonly token = this._token.asReadonly();
  readonly estConnecte = () => this._token() !== null;

  /** Verrou anti-double-refresh : toutes les requêtes concurrentes partagent le même appel. */
  private _refreshObservable: Observable<TokensResponse> | null = null;

  constructor(private http: HttpClient, private router: Router, private contexte: ContexteService) {}

  login(req: LoginRequest) {
    // Evite d'afficher l'ancien contexte pendant le switch de compte.
    this.contexte.reset();
    return this.http.post<TokensResponse>('/api/auth/login', req).pipe(
      tap(res => {
        this._token.set(res.accessToken);
        localStorage.setItem('__rt', res.refreshToken);
      })
    );
  }

  register(req: RegisterRequest) {
    return this.http.post<MoiResponse>('/api/auth/register', req);
  }

  moi() {
    return this.http.get<MoiResponse>('/api/auth/moi');
  }

  /**
   * Rafraîchit le token d'accès.
   * Si un refresh est déjà en cours, retourne le même Observable (shareReplay)
   * pour éviter de multiples appels simultanés au backend.
   */
  rafraichirToken(): Observable<TokensResponse> {
    if (this._refreshObservable) {
      return this._refreshObservable;
    }
    const rt = localStorage.getItem('__rt');
    if (!rt) return throwError(() => new Error('No refresh token'));

    this._refreshObservable = this.http
      .post<TokensResponse>('/api/auth/refresh', { refreshToken: rt })
      .pipe(
        tap(res => {
          this._token.set(res.accessToken);
          localStorage.setItem('__rt', res.refreshToken);
        }),
        catchError(err => {
          this.deconnecter();
          return throwError(() => err);
        }),
        finalize(() => { this._refreshObservable = null; }),
        shareReplay(1),
      );

    return this._refreshObservable;
  }

  deconnecter(): void {
    const rt = localStorage.getItem('__rt');
    if (rt) {
      // Best-effort : invalider le refresh token côté serveur
      this.http.post('/api/auth/logout', { refreshToken: rt })
        .subscribe({ error: () => {} });
    }
    this._token.set(null);
    localStorage.removeItem('__rt');
    this.contexte.reset();
    this.router.navigate(['/login']);
  }
}
