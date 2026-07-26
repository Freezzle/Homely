import { Injectable, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Router } from '@angular/router';
import { Observable, tap, catchError, throwError, finalize, shareReplay } from 'rxjs';
import { LoginRequest, RegisterRequest, AuthResponse, MoiResponse } from '../models/api.models';
import { ContexteService } from './contexte.service';

/**
 * T9.1 — Service d'authentification.
 * accessToken : signal en mémoire (effacé au refresh navigateur).
 * refreshToken : jamais lu ni stocké en JavaScript. Il est transmis par le
 * backend via un cookie httpOnly/Secure/SameSite=Strict (`rt`, scope
 * `/api/auth`) : le navigateur l'envoie automatiquement sur les requêtes
 * `withCredentials` vers `/api/auth/*`, sans qu'aucun code JS n'y accède —
 * protection contre l'exfiltration XSS (cf. consignes sécurité du projet).
 * Verrou _refreshObservable : une seule requête refresh à la fois (shareReplay),
 * évite la race condition de multiples 401 simultanés au redémarrage.
 */
@Injectable({ providedIn: 'root' })
export class AuthService {
  private readonly _token = signal<string | null>(null);
  readonly token = this._token.asReadonly();
  readonly estConnecte = () => this._token() !== null;

  /** Verrou anti-double-refresh : toutes les requêtes concurrentes partagent le même appel. */
  private _refreshObservable: Observable<AuthResponse> | null = null;

  constructor(private http: HttpClient, private router: Router, private contexte: ContexteService) {}

  login(req: LoginRequest) {
    // Evite d'afficher l'ancien contexte pendant le switch de compte.
    this.contexte.reset();
    // withCredentials : indispensable pour que le navigateur accepte/renvoie
    // le cookie httpOnly du refresh token (jamais lu depuis le JS).
    return this.http.post<AuthResponse>('/api/auth/login', req, { withCredentials: true }).pipe(
      tap(res => this._token.set(res.accessToken))
    );
  }

  register(req: RegisterRequest) {
    return this.http.post<MoiResponse>('/api/auth/register', req);
  }

  moi() {
    return this.http.get<MoiResponse>('/api/auth/moi');
  }

  /**
   * Rafraîchit le token d'accès à partir du refresh token porté par le cookie
   * httpOnly (envoyé automatiquement par le navigateur, jamais lu en JS).
   * Si un refresh est déjà en cours, retourne le même Observable (shareReplay)
   * pour éviter de multiples appels simultanés au backend.
   */
  rafraichirToken(): Observable<AuthResponse> {
    if (this._refreshObservable) {
      return this._refreshObservable;
    }

    this._refreshObservable = this.http
      .post<AuthResponse>('/api/auth/refresh', {}, { withCredentials: true })
      .pipe(
        tap(res => this._token.set(res.accessToken)),
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
    // Best-effort : invalide le refresh token côté serveur et efface le cookie.
    this.http.post('/api/auth/logout', {}, { withCredentials: true })
      .subscribe({ error: () => {} });
    this._token.set(null);
    this.contexte.reset();
    this.router.navigate(['/login']);
  }
}
