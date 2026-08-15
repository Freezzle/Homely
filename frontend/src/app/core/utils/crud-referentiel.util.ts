import { Signal, signal } from '@angular/core';
import { toObservable, takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { Observable, combineLatest, of } from 'rxjs';
import { switchMap, catchError } from 'rxjs/operators';
import { MessageService } from 'primeng/api';
import { ContexteService } from '../services/contexte.service';
import { notifierSucces, notifierErreur } from './toast.util';

/**
 * Contrat minimal attendu d'un service HTTP référentiel pour être mutualisé par
 * `creerCrudReferentiel` (voir `RestCrudService` dans `referentiel.service.ts`, dont
 * `MembreService`/`CompteService` héritent).
 */
export interface ServiceCrudReferentiel<T, TReq> {
  lister(foyerId: string): Observable<T[]>;
  creer(foyerId: string, req: TReq): Observable<T>;
  modifier(foyerId: string, id: string, req: TReq): Observable<T>;
  supprimer(foyerId: string, id: string): Observable<void>;
}

/** Libellés minimaux nécessaires aux toasts de succès/erreur, indépendants des clés i18n exactes de l'appelant. */
export interface LibellesCrudReferentiel {
  succes: string;
  erreur: string;
  suppressionImpossible: string;
}

export interface CrudReferentiel<T, TReq> {
  /** Liste courante (lecture seule), tenue à jour par `charger()`. */
  items: Signal<T[]>;
  /** Vrai pendant le chargement de la liste. */
  chargement: Signal<boolean>;
  /** (Re)charge la liste pour le foyer courant. Déjà appelé automatiquement à chaque changement de foyer. */
  charger(): void;
  /** Crée (si `idEnEdition` est `null`) ou modifie l'item `idEnEdition`, puis recharge la liste. */
  enregistrer(idEnEdition: string | null, req: TReq, onSuccess?: () => void): void;
  /** Supprime l'item `id`, puis recharge la liste. */
  supprimer(id: string, onSuccess?: () => void): void;
}

/**
 * Mutualise la plomberie commune aux écrans CRUD référentiels (categories, comptes,
 * membres, taux, ...) : chargement réactif sur le foyer courant, création/
 * modification, suppression, toasts de succès/erreur. Chaque composant garde son
 * propre `FormGroup` et son propre template — seule la logique de liste/mutation est
 * mutualisée ici.
 *
 * Le chargement réagit à `contexte.foyerId()` via `toObservable(...) + switchMap` (et non
 * un simple `effect()` + `subscribe()`) : si le foyer change avant la fin d'une requête en
 * vol, celle-ci est annulée. Sans cela, une réponse tardive du foyer précédent pourrait
 * écraser les données déjà affichées du foyer nouvellement sélectionné — une fuite
 * d'informations inter-foyers, contraire à la règle multi-tenant du projet (voir
 * `AccesComponent`, qui appliquait déjà ce correctif de façon isolée).
 *
 * ⚠️ À appeler uniquement depuis un contexte d'injection (ex. initialiseur de champ
 * d'un composant) : cette fonction utilise `toObservable`/`takeUntilDestroyed` en interne.
 */
export function creerCrudReferentiel<T, TReq>(
  contexte: ContexteService,
  service: ServiceCrudReferentiel<T, TReq>,
  toast: MessageService,
  libelles: LibellesCrudReferentiel,
): CrudReferentiel<T, TReq> {
  const items = signal<T[]>([]);
  const chargement = signal(false);
  const _refreshTrigger = signal(0);

  combineLatest([toObservable(contexte.foyerId), toObservable(_refreshTrigger)])
    .pipe(
      switchMap(([foyerId]) => {
        if (!foyerId) {
          items.set([]);
          return of(null);
        }
        chargement.set(true);
        return service.lister(foyerId).pipe(catchError(() => of(null)));
      }),
      takeUntilDestroyed(),
    )
    .subscribe(v => {
      chargement.set(false);
      if (v) items.set(v);
    });

  /** (Re)charge la liste via le flux réactif unique ci-dessus (annule toute requête en vol). */
  function charger(): void {
    _refreshTrigger.update(v => v + 1);
  }

  function enregistrer(idEnEdition: string | null, req: TReq, onSuccess?: () => void): void {
    const foyerId = contexte.foyerId()!;
    const obs = idEnEdition ? service.modifier(foyerId, idEnEdition, req) : service.creer(foyerId, req);
    obs.subscribe({
      next: () => {
        notifierSucces(toast, libelles.succes);
        charger();
        onSuccess?.();
      },
      error: (e) => notifierErreur(toast, libelles.erreur, e),
    });
  }

  function supprimer(id: string, onSuccess?: () => void): void {
    const foyerId = contexte.foyerId()!;
    service.supprimer(foyerId, id).subscribe({
      next: () => {
        notifierSucces(toast, libelles.succes);
        charger();
        onSuccess?.();
      },
      error: () => toast.add({ severity: 'error', summary: libelles.suppressionImpossible }),
    });
  }

  return { items: items.asReadonly(), chargement: chargement.asReadonly(), charger, enregistrer, supprimer };
}

/**
 * Variante de `ServiceCrudReferentiel` pour les ressources scopées **foyer + scénario**
 * (`postes`, politiques ou allocations scopées scénario, etc.).
 */
export interface ServiceCrudReferentielScenario<T, TReq> {
  lister(foyerId: string, scenarioId: string): Observable<T[]>;
  creer(foyerId: string, scenarioId: string, req: TReq): Observable<T>;
  modifier(foyerId: string, scenarioId: string, id: string, req: TReq): Observable<T>;
  supprimer(foyerId: string, scenarioId: string, id: string): Observable<void>;
}

/**
 * Équivalent de `creerCrudReferentiel` pour les ressources scopées foyer + scénario
 * : réagit à `contexte.foyerId()` **et** `contexte.scenarioId()`
 * via `switchMap`, ce qui annule toute requête en vol dès que l'un des deux change (même
 * garde-fou anti-fuite inter-foyers/inter-scénarios que `creerCrudReferentiel`).
 *
 * ⚠️ À appeler uniquement depuis un contexte d'injection.
 */
export function creerCrudReferentielScenario<T, TReq>(
  contexte: ContexteService,
  service: ServiceCrudReferentielScenario<T, TReq>,
  toast: MessageService,
  libelles: LibellesCrudReferentiel,
): CrudReferentiel<T, TReq> {
  const items = signal<T[]>([]);
  const chargement = signal(false);
  const _refreshTrigger = signal(0);

  combineLatest([toObservable(contexte.foyerId), toObservable(contexte.scenarioId), toObservable(_refreshTrigger)])
    .pipe(
      switchMap(([foyerId, scenarioId]) => {
        if (!foyerId || !scenarioId) {
          items.set([]);
          return of(null);
        }
        chargement.set(true);
        return service.lister(foyerId, scenarioId).pipe(catchError(() => of(null)));
      }),
      takeUntilDestroyed(),
    )
    .subscribe(v => {
      chargement.set(false);
      if (v) items.set(v);
    });

  function charger(): void {
    _refreshTrigger.update(v => v + 1);
  }

  function enregistrer(idEnEdition: string | null, req: TReq, onSuccess?: () => void): void {
    const foyerId = contexte.foyerId()!;
    const scenarioId = contexte.scenarioId()!;
    const obs = idEnEdition
      ? service.modifier(foyerId, scenarioId, idEnEdition, req)
      : service.creer(foyerId, scenarioId, req);
    obs.subscribe({
      next: () => {
        notifierSucces(toast, libelles.succes);
        charger();
        onSuccess?.();
      },
      error: (e) => notifierErreur(toast, libelles.erreur, e),
    });
  }

  function supprimer(id: string, onSuccess?: () => void): void {
    const foyerId = contexte.foyerId()!;
    const scenarioId = contexte.scenarioId()!;
    service.supprimer(foyerId, scenarioId, id).subscribe({
      next: () => {
        notifierSucces(toast, libelles.succes);
        charger();
        onSuccess?.();
      },
      error: () => toast.add({ severity: 'error', summary: libelles.suppressionImpossible }),
    });
  }

  return { items: items.asReadonly(), chargement: chargement.asReadonly(), charger, enregistrer, supprimer };
}
