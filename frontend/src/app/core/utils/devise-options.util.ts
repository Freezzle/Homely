import { Signal, signal, effect } from '@angular/core';
import { AbstractControl } from '@angular/forms';
import { ContexteService } from '../services/contexte.service';
import { TauxChangeService } from '../services/referentiel.service';
import { buildConfiguredCurrencyOptions } from '../constants/devises.constants';

/**
 * Construit un signal réactif exposant les devises disponibles pour le foyer courant
 * (devise de base + devises pour lesquelles un taux de change est configuré), et
 * verrouille automatiquement `controleDevise` sur la devise de base si sa valeur
 * devient invalide (changement de foyer, devise retirée des taux configurés, etc.).
 *
 * Mutualise un bloc auparavant dupliqué à l'identique dans les écrans comptes, actifs
 * et postes (formulaires avec un champ `devise` dépendant des taux de change du foyer).
 *
 * ⚠️ À appeler uniquement depuis un contexte d'injection (ex. initialiseur de champ
 * d'un composant, après la déclaration du `FormGroup` concerné) : cette fonction
 * utilise `effect()` en interne.
 */
export function creerDevisesDisponibles(
  contexte: ContexteService,
  tauxChangeSvc: TauxChangeService,
  controleDevise: AbstractControl | null,
): Signal<string[]> {
  const devises = signal<string[]>([contexte.deviseBase()]);

  effect(() => {
    const foyerId = contexte.foyerId();
    const deviseBase = contexte.deviseBase();

    devises.set([deviseBase]);
    if (!controleDevise?.value) {
      controleDevise?.setValue(deviseBase, { emitEvent: false });
    }

    if (!foyerId) {
      return;
    }

    tauxChangeSvc.lister(foyerId).subscribe({
      next: taux => {
        if (contexte.foyerId() !== foyerId) {
          return;
        }

        const devisesDisponibles = buildConfiguredCurrencyOptions(
          deviseBase,
          taux.map(item => item.devise),
        );

        devises.set(devisesDisponibles);
        if (!devisesDisponibles.includes((controleDevise?.value as string | null) ?? '')) {
          controleDevise?.setValue(deviseBase, { emitEvent: false });
        }
      },
      error: () => {
        if (contexte.foyerId() !== foyerId) {
          return;
        }

        devises.set([deviseBase]);
        controleDevise?.setValue(deviseBase, { emitEvent: false });
      },
    });
  });

  return devises.asReadonly();
}
