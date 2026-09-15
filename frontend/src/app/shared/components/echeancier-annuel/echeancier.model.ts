/**
 * Contrat public de `app-echeancier-annuel` — voir `docs/features/feature.md`.
 * Le composant décrit le rythme d'un poste (quand), jamais le montant (combien).
 */

export type ModeImputation = 'MENSUALISE' | 'PERIODIQUE';
export type MomentImputation = 'DEBUT_PERIODE' | 'FIN_PERIODE' | 'INCONNU';

/**
 * Sous-ensemble de Poste strictement nécessaire au dessin.
 * Aucun montant : le composant décrit un rythme, pas une somme.
 */
export interface PosteEcheancier {
  /** Périodicité en mois. 0 = ponctuel, 1 = mensuel, 12 = annuel. */
  readonly periodicite: number;
  readonly mode: ModeImputation;
  readonly moment: MomentImputation;
  /** ISO `yyyy-MM-dd`. Pour un ponctuel, c'est la date de référence. */
  readonly debut: string;
  /** ISO `yyyy-MM-dd`. Ignorée quand `periodicite === 0` (voir R4). */
  readonly fin: string | null;
}

export type Groupe = 2 | 3 | 4 | 6 | null;
export type IntensiteBulle = 'discrete' | 'accentuee' | 'forte';

/** Ce que dit la couleur du chiffre. */
export type EtatMois =
  | 'impute'
  | 'actif'
  | 'hors-validite';

/** Un seul repère par mois, jamais cumulé. */
export type Repere = 'debut' | 'fin' | 'ponctuel' | null;

export interface MoisVue {
  readonly mois: number;
  readonly etat: EtatMois;
  readonly repere: Repere;
  readonly gras: boolean;
  readonly impute: boolean;
  readonly echeance: boolean;
}

/** Pourquoi un bord de capsule est coupé. `null` = le cycle commence ou finit vraiment là. */
export type Coupe = null | 'annee' | 'validite';

export interface CapsuleVue {
  readonly du: number;
  readonly au: number;
  readonly capDu: 'arrondi' | 'droit';
  readonly capAu: 'arrondi' | 'droit';
  readonly coupeDu: Coupe;
  readonly coupeAu: Coupe;
  readonly style: 'pleine' | 'pointillee';
  readonly raison: 'provision' | 'imputation-pleine' | 'moment-inconnu';
}

export interface PerleVue {
  readonly mois: number;
  readonly forme: 'perle' | 'losange';
}

export interface EcheancierVue {
  readonly mois: readonly MoisVue[];
  readonly capsules: readonly CapsuleVue[];
  readonly perles: readonly PerleVue[];
  readonly debutMois: number | null;
  readonly finMois: number | null;
}
