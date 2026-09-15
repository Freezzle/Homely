import { CategorieDto, ModeComptabilisation, MomentPeriode, NaturePoste, PosteDto, TypePoste } from '../../../core/models/api.models';

/** Périmètre de l'écran : le foyer entier, ou l'id d'un membre actif. */
export type Perimetre = 'foyer' | string;

/** Agrégat mensuel enrichi du détail brut/poche (doc 01 §1/§7) — reconstitué côté
 *  front à partir du **seul** `ProjectionAnnuelleDto`. RàV et Poche sont dérivés du
 *  même agrégat (`ravBrut = revenus − charges − reserves`,
 *  `argentPoche = ravBrut − soldeDisponible`) pour que la cascade budgétaire (§7)
 *  reste arithmétiquement cohérente par construction — voir `enrichir()` dans
 *  `comparaison-scenarios.util.ts`. */
export interface MoisAgregatEnrichi {
  revenus: number;
  charges: number;
  reserves: number;
  /** Net = déjà retranché de l'argent de poche (valeur du back, non recalculée). */
  soldeDisponible: number;
  /** Argent de poche du mois, dérivé du même agrégat (`ravBrut − soldeDisponible`)
   *  pour préserver l'identité `RàV − Poche = Solde` dans la cascade. */
  argentPoche: number;
  /** Reste à vivre brut = revenus − charges − reserves (doc 01 §1). */
  ravBrut: number;
}

/** Données déjà agrégées d'un scénario pour l'année/périmètre sélectionnés — aucune
 *  logique moteur, uniquement les réponses du back combinées/indexées pour l'affichage. */
export interface ScenarioComparaisonData {
  moisAgregats: MoisAgregatEnrichi[]; // 12 entrées, index 0 = janvier
  totalAnnuel: MoisAgregatEnrichi;
  /** Total annuel par catégorie (déjà scopé au périmètre demandé). */
  parCategorie: Record<string, number>;
  postes: PosteDto[];
}

/** Sens de l'effet d'un indicateur sur le solde disponible :
 *  `1`  = « plus haut est mieux » (revenus, RàV, solde), sens du prototype.
 *  `-1` = « plus haut est pire »  (charges, réserves, poche).
 *  `0`  = neutre (aucune couleur favorable/défavorable — ex. réserves si l'on
 *         considère qu'un mouvement interne n'a pas de « bon » sens). */
export type SensFavorable = 1 | -1 | 0;

export interface IndicateurEcart {
  cle: string;
  label: string;
  valeurA: number;
  valeurB: number;
  sensFavorable: SensFavorable;
  note?: string;
}

export interface CascadeEtape {
  cle: 'revenus' | 'charges' | 'reserves' | 'rav' | 'argentPoche' | 'soldeDisponible';
  label: string;
  valeurA: number;
  valeurB: number;
  /** Sens favorable de la colonne (feature_5_bis §7 ligne « Écart »). */
  sensFavorable: 1 | -1;
  /** Opérateur affiché avant l'en-tête de colonne (`−`, `=`), ou `''` pour la
   *  première colonne. */
  operateur: '' | '−' | '=';
  /** Colonne "résultat" (Reste à vivre, Solde disponible) → séparateur en tirets. */
  estResultat: boolean;
  /** Couleur de la barre (token PrimeNG) hors cas de valeur négative. */
  couleurBarre: string;
}

export interface CategorieEcartRow {
  categorieId: string;
  libelle: string;
  type: TypePoste;
  totalA: number;
  totalB: number;
  ecart: number;
  /** Sens de l'effet sur le solde disponible (`1` REVENU, `-1` CHARGE/RESERVE). */
  impact: 1 | -1;
  /** Effet net sur le solde disponible = `impact × ecart` (feature_5_bis §6). */
  effet: number;
}

export type StatutDiffPoste = 'AJOUTE' | 'SUPPRIME' | 'MODIFIE' | 'INCHANGE';
/** Valeurs de filtre (feature_5_bis §9). `CHANGES` = tout sauf INCHANGE. */
export type FiltrePostesDiff = 'CHANGES' | 'AJOUT' | 'SUPPR' | 'MODIF' | 'TOUS';

export interface PosteDiffRow {
  cle: string;
  description: string;
  categorieLibelle?: string;
  type: TypePoste;
  periodiciteMois: number;
  mode: ModeComptabilisation;
  moment: MomentPeriode;
  nature: NaturePoste;
  debut?: string;
  fin?: string;
  devise?: string;
  statut: StatutDiffPoste;
  /** Un des deux côtés (ou les deux) fait partie d'une chaîne de révision de montant. */
  estRevision: boolean;
  montantAnnuelA: number | null;
  montantAnnuelB: number | null;
  /** Ancien/nouveau montant unitaire (pour l'affichage « montant X → Y » sur MODIFIE). */
  montantAvant: number | null;
  montantApres: number | null;
  /** Effet net signé sur le solde disponible (positif = améliore B vs A). */
  effetNet: number;
}

export interface HeatmapLigne {
  cle: string;
  libelle: string;
  /** 12 valeurs (janvier → décembre), effet signé de l'écart B-A sur le solde disponible. */
  valeursParMois: number[];
}

export interface CategorieResolue extends CategorieDto {
  id: string;
}

