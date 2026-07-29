import { Signal, signal, effect } from '@angular/core';
import { Observable } from 'rxjs';
import { MessageService } from 'primeng/api';
import { ContexteService } from '../services/contexte.service';

/**
 * Contrat minimal attendu d'un service HTTP référentiel pour être mutualisé par
 * `creerCrudReferentiel` (voir `RestCrudService` dans `referentiel.service.ts`, dont
 * `MembreService`/`CompteService`/`ActifService` héritent).
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
 * membres, taux, actifs, ...) : chargement réactif sur le foyer courant, création/
 * modification, suppression, toasts de succès/erreur. Chaque composant garde son
 * propre `FormGroup` et son propre template — seule la logique de liste/mutation est
 * mutualisée ici.
 *
 * ⚠️ À appeler uniquement depuis un contexte d'injection (ex. initialiseur de champ
 * d'un composant) : cette fonction utilise `effect()` en interne.
 */
export function creerCrudReferentiel<T, TReq>(
  contexte: ContexteService,
  service: ServiceCrudReferentiel<T, TReq>,
  toast: MessageService,
  libelles: LibellesCrudReferentiel,
): CrudReferentiel<T, TReq> {
  const items = signal<T[]>([]);
  const chargement = signal(false);

  function charger(): void {
    const foyerId = contexte.foyerId();
    if (!foyerId) return;
    chargement.set(true);
    service.lister(foyerId).subscribe({
      next: v => { items.set(v); chargement.set(false); },
      error: () => chargement.set(false),
    });
  }

  effect(() => {
    if (contexte.foyerId()) charger();
  });

  function enregistrer(idEnEdition: string | null, req: TReq, onSuccess?: () => void): void {
    const foyerId = contexte.foyerId()!;
    const obs = idEnEdition ? service.modifier(foyerId, idEnEdition, req) : service.creer(foyerId, req);
    obs.subscribe({
      next: () => {
        toast.add({ severity: 'success', summary: libelles.succes });
        charger();
        onSuccess?.();
      },
      error: (e) => toast.add({ severity: 'error', summary: libelles.erreur, detail: e?.error?.message }),
    });
  }

  function supprimer(id: string, onSuccess?: () => void): void {
    const foyerId = contexte.foyerId()!;
    service.supprimer(foyerId, id).subscribe({
      next: () => {
        toast.add({ severity: 'success', summary: libelles.succes });
        charger();
        onSuccess?.();
      },
      error: () => toast.add({ severity: 'error', summary: libelles.suppressionImpossible }),
    });
  }

  return { items: items.asReadonly(), chargement: chargement.asReadonly(), charger, enregistrer, supprimer };
}
