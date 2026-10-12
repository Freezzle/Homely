import { TypeRepartition } from '../../../../../core/models/api.models';

/**
 * État de saisie de la répartition d'un poste, tel que manipulé par
 * `app-poste-repartition`. Le conteneur le projette ensuite dans le `FormArray`
 * `repartitions` (le contrat envoyé à l'API, lui, ne change pas).
 */
export interface RepartitionSaisie {
  /** AUTO / REVERSE_AUTO suivent le scénario ; seul CUSTOM porte des parts fixes. */
  readonly typeRepartition: TypeRepartition;
  /** Membres effectivement concernés par le poste. */
  readonly selection: readonly string[];
  /** membreId → quote-part en % (0–100). Informatif hors CUSTOM. */
  readonly parts: Readonly<Record<string, number>>;
  /** membreId → compte de ventilation. */
  readonly comptes: Readonly<Record<string, string | null>>;
  /** UI seulement : un compte par personne plutôt qu'un compte commun. */
  readonly comptesSepares: boolean;
}
