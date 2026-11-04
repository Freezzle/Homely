import { TypeRepartition } from '../../../../../core/models/api.models';

/**
 * Une ligne de **routage** : un compte contrepartie et son poids, en pourcentage de la
 * part du membre (0–100). Le sens est déduit du type de poste côté moteur
 * (`docs/01-principes-et-moteur.md` §8 bis).
 */
export interface LigneRoutage {
  readonly compteId: string | null;
  /** Part dans la part du membre, en % (somme = 100 par membre). */
  readonly part: number;
}

/**
 * État de saisie de la répartition d'un poste, tel que manipulé par
 * `app-poste-repartition`. Le conteneur le projette ensuite dans le `FormArray`
 * `repartitions` puis dans le contrat API (`comptePivotId` + `ventilations`).
 */
export interface RepartitionSaisie {
  /** AUTO / REVERSE_AUTO suivent le scénario ; seul CUSTOM porte des parts fixes. */
  readonly typeRepartition: TypeRepartition;
  /** Membres effectivement concernés par le poste. */
  readonly selection: readonly string[];
  /** membreId → quote-part en % (0–100). Informatif hors CUSTOM. */
  readonly parts: Readonly<Record<string, number>>;
  /**
   * Compte **pivot** : celui où la transaction a physiquement lieu (débité pour une
   * CHARGE/RESERVE, crédité pour un REVENU). `null` → résolu côté serveur.
   */
  readonly comptePivot: string | null;
  /** membreId → comptes contreparties et leurs poids (le routage). */
  readonly routage: Readonly<Record<string, readonly LigneRoutage[]>>;
  /** UI seulement : saisie détaillée (plusieurs comptes par membre, avec %). */
  readonly routageAvance: boolean;
}
