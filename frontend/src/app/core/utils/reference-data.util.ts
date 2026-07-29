import { Signal, signal } from '@angular/core';
import { toObservable, takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { Observable, combineLatest, of } from 'rxjs';
import { switchMap, catchError } from 'rxjs/operators';

export interface ChargementReactif<T> {
  /** Dernière valeur chargée (ou `null` tant qu'aucune donnée n'a encore été reçue, ou si la clé est devenue nulle). */
  donnees: Signal<T | null>;
  /** Vrai pendant le chargement. */
  chargement: Signal<boolean>;
  /** Force un rechargement avec la clé courante (ex. après une mutation ailleurs dans l'app). */
  recharger(): void;
}

/**
 * Mutualise le chargement réactif en lecture seule d'une clé dérivée du contexte
 * (ex. `{ foyerId, scenarioId }`) — utilisé pour les données de référence auxiliaires
 * (catégories/comptes/postes/objectifs) rechargées à chaque changement de foyer ou de
 * scénario, auparavant dupliquées quasi à l'identique (bloc `forkJoin` + `effect`) dans
 * `DashboardMensuelComponent`, `DashboardAnnuelComponent`, `ObjectifsComponent`.
 *
 * `cleSignal` doit être un signal (souvent `computed`) qui retourne `null` tant que les
 * prérequis (foyerId, scénario...) ne sont pas réunis, et une valeur non nulle sinon.
 * `chargeur` reçoit cette clé non nulle et renvoie l'observable des données (ex. un
 * `forkJoin` de plusieurs listes). Implémenté avec `switchMap` : toute requête en vol est
 * annulée dès que la clé change, pour éviter qu'une réponse tardive n'écrase des données
 * devenues obsolètes (ex. changement rapide de foyer) — même garde-fou anti-fuite
 * inter-foyers que `creerCrudReferentiel`.
 *
 * ⚠️ À appeler uniquement depuis un contexte d'injection (ex. initialiseur de champ d'un
 * composant) : cette fonction utilise `toObservable`/`takeUntilDestroyed` en interne.
 */
export function creerChargementReactif<K, T>(
  cleSignal: Signal<K | null>,
  chargeur: (cle: K) => Observable<T>,
): ChargementReactif<T> {
  const donnees = signal<T | null>(null);
  const chargement = signal(false);
  const _refreshTrigger = signal(0);

  combineLatest([toObservable(cleSignal), toObservable(_refreshTrigger)])
    .pipe(
      switchMap(([cle]) => {
        if (cle === null || cle === undefined) {
          donnees.set(null);
          return of(null);
        }
        chargement.set(true);
        return chargeur(cle).pipe(catchError(() => of(null)));
      }),
      takeUntilDestroyed(),
    )
    .subscribe(v => {
      chargement.set(false);
      if (v !== null) donnees.set(v);
    });

  function recharger(): void {
    _refreshTrigger.update(v => v + 1);
  }

  return { donnees: donnees.asReadonly(), chargement: chargement.asReadonly(), recharger };
}
