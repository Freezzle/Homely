import { Signal, computed } from '@angular/core';
import { rxResource } from '@angular/core/rxjs-interop';
import { Observable } from 'rxjs';

export interface ChargementReactif<T> {
  /** Dernière valeur chargée (ou `null` tant qu'aucune donnée n'a encore été reçue, ou si la clé est devenue nulle). */
  donnees: Signal<T | null>;
  /** Vrai pendant le chargement (premier chargement ou rechargement). */
  chargement: Signal<boolean>;
  /** Dernière erreur rencontrée (`undefined` si aucune, ou si un chargement ultérieur a réussi). */
  erreur: Signal<Error | undefined>;
  /** Force un rechargement avec la clé courante (ex. après une mutation ailleurs dans l'app). */
  recharger(): void;
}

/**
 * Mutualise le chargement réactif en lecture seule d'une clé dérivée du contexte
 * (ex. `{ foyerId, scenarioId }`) — utilisé pour les données de référence auxiliaires
 * (catégories/comptes/postes/objectifs) rechargées à chaque changement de foyer ou de
 * scénario, auparavant dupliquées quasi à l'identique (bloc `forkJoin` + `effect`) dans
 * `DashboardComponent`, `ObjectifsComponent`, `TauxComponent`.
 *
 * Implémenté avec l'API native Angular `rxResource()` (stable depuis Angular 22) : chaque
 * changement de `cleSignal` annule automatiquement la requête en vol et relance le
 * `chargeur` avec la nouvelle clé — même garde-fou anti-fuite inter-foyers qu'avant
 * (ex. changement rapide de foyer), mais sans réimplémenter `switchMap`/`combineLatest` à
 * la main. `isLoading`/`error` sont également gérés nativement par la resource.
 *
 * `cleSignal` doit être un signal (souvent `computed`) qui retourne `null` tant que les
 * prérequis (foyerId, scénario...) ne sont pas réunis : dans ce cas la resource reste à
 * l'état `idle` et `chargeur` n'est pas appelé. `chargeur` reçoit la clé non nulle et
 * renvoie l'observable des données (ex. un `forkJoin` de plusieurs listes).
 *
 * ⚠️ À appeler uniquement depuis un contexte d'injection (ex. initialiseur de champ d'un
 * composant) : `rxResource` utilise `inject()` en interne.
 */
export function creerChargementReactif<K, T>(
  cleSignal: Signal<K | null>,
  chargeur: (cle: K) => Observable<T>,
): ChargementReactif<T> {
  const ressource = rxResource<T, K | undefined>({
    // `undefined` (et non `null`) fait passer la resource à l'état `idle` sans appeler `chargeur`.
    params: () => cleSignal() ?? undefined,
    stream: ({ params }) => chargeur(params as K),
  });

  function recharger(): void {
    ressource.reload();
  }

  return {
    donnees: computed(() => ressource.value() ?? null),
    chargement: ressource.isLoading,
    erreur: ressource.error,
    recharger,
  };
}
