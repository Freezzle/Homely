// ── Auth ──────────────────────────────────────────────────────────────────────
export interface LoginRequest { email: string; motDePasse: string; }
export interface RegisterRequest { email: string; motDePasse: string; nomComplet: string; }
/**
 * Réponse login/refresh : ne contient jamais le refresh token (transmis
 * exclusivement via un cookie httpOnly géré par le navigateur, jamais lu ni
 * stocké en JavaScript — voir AuthService).
 */
export interface AuthResponse { accessToken: string; expiresIn: number; }
export interface MoiResponse { id: string; email: string; nomComplet: string; }

// ── Foyer & accès ────────────────────────────────────────────────────────────
export type RoleFoyer = 'OWNER' | 'EDITOR' | 'VIEWER';

export interface FoyerDto { id: string; nom: string; deviseBase: string; monRole: RoleFoyer; }
export interface FoyerRequest {
  nom: string;
  deviseBase: string;
  membres?: { nom: string; couleur?: string }[];
}

/** DTO du wizard d'onboarding — créé en une seule transaction côté serveur. */
export interface FoyerOnboardingRequest {
  nom: string;
  deviseBase: string;
  membres: { nom: string; couleur?: string }[];
  comptes: { libelle: string; soldeInitial: number; membreOrdres: number[]; membresPrimaireOrdres?: number[] }[];
  categories: { libelle: string; typePoste: TypeCategorie }[];
  scenario: {
    nom: string;
    anneeDepart: number;
    tresorerieInitiale: number;
    repartitions: { membreOrdre: number; quotePart: number }[];
  };
}
export interface FoyerOnboardingResponse { foyer: FoyerDto; scenarioId: string; }

export interface AccesFoyerDto {
  id: string; utilisateurId: string; email: string; nomComplet: string; role: RoleFoyer;
}
export interface InviterAccesRequest { email: string; role: RoleFoyer; }
export interface ChangerRoleRequest { role: RoleFoyer; }

// ── Référentiels ─────────────────────────────────────────────────────────────
export interface MembreDto { id: string; nom: string; couleur: string; actif: boolean; compteIdPrimaire: string | null; }
export interface MembreRequest { nom: string; couleur: string; }
export interface ComptePrimaireRequest { compteId: string | null; }

export interface CompteDto { id: string; libelle: string; soldeInitial: number; devise: string; actif: boolean; membreIds: string[]; membresPrimaireIds: string[]; }
export interface CompteRequest { libelle: string; soldeInitial: number; devise?: string; membreIds: string[]; }

export type TypeCategorie = 'REVENU' | 'CHARGE' | 'RESERVE';
export interface CategorieDto { id: string; libelle: string; typePoste: TypeCategorie; actif: boolean; }
export interface CategorieRequest { libelle: string; typePoste: TypeCategorie; }

export interface TauxChangeDto { id: string; devise: string; tauxVersBase: number; }
export interface TauxChangeRequest { devise: string; tauxVersBase: number; }

// ── Scénario ─────────────────────────────────────────────────────────────────
export interface RepartitionDefautDto { membreId: string; nomMembre: string; quotePart: number; }
export interface RepartitionPeriodePartDto { membreId: string; nomMembre: string; couleurMembre?: string; quotePart: number; ordre: number; }
export interface RepartitionPeriodeDto { id: string; debut?: string; fin?: string; parts: RepartitionPeriodePartDto[]; }
export interface RepartitionPeriodeRequest { debut?: string; fin?: string; parts: { membreId: string; quotePart: number; }[]; }

export interface ScenarioDto {
  id: string; nom: string; estReference: boolean; anneeDepart: number;
  tresorerieInitiale: number; horizonAnnees: number;
  repartitions: RepartitionDefautDto[];
  periodes: RepartitionPeriodeDto[];
  dateModification: string;
}
export interface ScenarioRequest {
  nom: string; anneeDepart: number; tresorerieInitiale: number; horizonAnnees: number;
  repartitions: { membreId: string; quotePart: number; }[];
}

// ── Postes ────────────────────────────────────────────────────────────────────
export type TypePoste = 'REVENU' | 'CHARGE' | 'RESERVE';
export type ModeComptabilisation = 'MENSUALISE' | 'PERIODIQUE';
export type MomentPeriode = 'DEBUT_PERIODE' | 'FIN_PERIODE' | 'INCONNU';
export type NaturePoste = 'EFFECTIF' | 'ESTIMATION';
export type TypeRepartition = 'AUTO' | 'REVERSE_AUTO' | 'CUSTOM';

export interface RepartitionPosteDto { membreId: string; nomMembre: string; quotePart: number; }
export interface VentilationCompteDto { membreId: string; compteId: string; libelleCompte: string; }

export interface PosteDto {
  id: string; type: TypePoste; description: string; categorieId?: string;
  montant: number; montantMensualise: number; devise?: string;
  periodiciteMois: number; debut?: string; fin?: string;
  mode: ModeComptabilisation; moment: MomentPeriode; nature: NaturePoste;
  estimPourcentage?: number;  // Pourcentage d'estimation (nullable si nature=EFFECTIF)
  typeRepartition: TypeRepartition;
  ordre: number;
  importance: number;  // 1 (non vital) à 5 (vital)
  potentielOptimisation: number;  // 1 (non optimisable) à 5 (très optimisable)
  repartitions: RepartitionPosteDto[];
  ventilations: VentilationCompteDto[];
  posteOrigineId?: string;   // Poste dont ce poste est issu par révision de montant
  posteSuivantId?: string;   // Poste qui a remplacé celui-ci par révision de montant (calculé)
}
export interface PosteRequest {
  type: TypePoste; description: string; categorieId?: string;
  montant: number; devise?: string; periodiciteMois: number;
  debut?: string; fin?: string;
  mode: ModeComptabilisation; moment: MomentPeriode; nature: NaturePoste;
  estimPourcentage?: number;  // Obligatoire si nature=ESTIMATION
  typeRepartition?: TypeRepartition;
  ordre: number;
  importance?: number;  // 1 (non vital) à 5 (vital), défaut 3
  potentielOptimisation?: number;  // 1 (non optimisable) à 5 (très optimisable), défaut 3
  repartitions?: { membreId: string; quotePart: number; }[];
  ventilations?: { membreId: string; compteId: string; }[];
}
export interface PosteRevisionRequest {
  nouveauMontant: number;
  dateEffet: string;
}
export interface PosteRevisionResponse {
  posteCloture: PosteDto;
  posteCree: PosteDto;
}
export interface PosteClotureRequest {
  fin: string;
}
export interface PosteDecalerDateEffetRequest {
  nouvelleDateEffet: string;
}
export interface PosteDecalerDateEffetResponse {
  postePrecedent: PosteDto;
  posteEdite: PosteDto;
}

// ── Postes "à optimiser en priorité" (dashboard annuel) ──
// Tout le calcul (montant annualisé, score unique 0-100, tri, troncature au top 30)
// est fait côté serveur — voir MatriceBudgetaireService.
export interface PostePositionneDto {
  id: string; nom: string; type: TypePoste;
  montantMensuel: number; montantAnnuel: number;
  necessite: number; optimisable: number;
  score: number; rang: number;
}

// ── Indicateur dashboard "Plaisirs vs Besoins" ──
// Répartition des charges (nécessité 1-3 = Plaisirs, 4-5 = Besoins) — voir
// BesoinsPlaisirsService. Le taux de plaisirs est calculé côté frontend, pas ici.
export interface PosteBesoinDto {
  id: string;
  description: string;
  necessite: number;
  montant: number;
}

export interface BesoinsPlaisirsDto {
  montantBesoins: number;
  montantPlaisirs: number;
  postesBesoins: PosteBesoinDto[];
}

// ── Actions groupées sur postes ────────────────────────────────────────────
export type ChampGroupable = 'CATEGORIE' | 'IMPORTANCE' | 'POTENTIEL_OPTIMISATION';

export interface PosteActionGroupeeRequest {
  ids: string[];
  champ: ChampGroupable;
  categorieId?: string | null;      // requis si champ=CATEGORIE (null = désélection)
  importance?: number;              // requis si champ=IMPORTANCE
  potentielOptimisation?: number;   // requis si champ=POTENTIEL_OPTIMISATION
}

export interface PosteSuppressionGroupeeRequest {
  ids: string[];
}

// ── Événements budgétaires ("ce qui change") ───────────────────────────────
export type TypeEvenement = 'DEBUT' | 'FIN' | 'REVISION';
export interface EvenementDto {
  mois: number;
  type: TypeEvenement;
  posteId: string;
  description: string;
  categorieId?: string;
  typePoste: TypePoste;
  nature: NaturePoste;
  /** Montant signé brut (plein pour DEBUT/FIN, delta pour REVISION) — non mensualisé. */
  montant: number;
  periodiciteMois: number;
  mode: ModeComptabilisation;
  /** Uniquement pour REVISION (origine résolue) : valeurs du poste avant révision, pour
   *  un affichage "avant → après". Absent pour DEBUT/FIN. */
  montantOrigine?: number;
  periodiciteMoisOrigine?: number;
  modeOrigine?: ModeComptabilisation;
  /** Quote-part effective du membre demandé (1 par défaut en vue foyer). Les montants
   *  ci-dessus sont déjà proratisés en conséquence par le backend. */
  quotePart?: number;
}

// ── Indicateur 04 — Taux d'effort du membre ────────────────────────────────
/** Revenus/charges/réserves d'un membre pour un mois donné, normal + "pire cas"
 *  (postes CHARGE/RESERVE de nature ESTIMATION majorés de leur estimPourcentage). */
export interface TauxEffortMembreDto {
  membreId: string;
  nomMembre?: string;
  couleurMembre?: string;
  revenusTotal: number;
  chargesTotal: number;
  reservesTotal: number;
  chargesTotalPireCas: number;
  reservesTotalPireCas: number;
  /** Argent de poche résolu pour ce membre (n'est pas un poste, absent de
   *  chargesTotal/reservesTotal) — alimente la 3ᵉ jauge "charges + réserves + argent
   *  de poche" de `<app-taux-effort-card>`. */
  argentPocheTotal: number;
  argentPocheTotalPireCas: number;
}

// ── Indicateur — Prorata des postes partagés ───────────────────────────────
/** Compare, pour un membre et une période (mois ou année), le prorata moyen
 *  réellement appliqué sur les postes CHARGE/RESERVE partagés (pondéré par montant)
 *  au prorata théorique selon le poids de ses revenus dans le total du foyer. */
export interface ProrataPartageMembreDto {
  membreId: string;
  nomMembre?: string;
  couleurMembre?: string;
  /** ∈ [0,1], null si aDesPostesPartages === false. */
  prorataMoyenApplique: number | null;
  /** ∈ [0,1], null si le foyer n'a aucun revenu sur la période. */
  prorataTheoriqueRevenu: number | null;
  /** false si aucun poste CHARGE/RESERVE partagé n'a de contribution non nulle sur la
   *  période — permet de masquer l'indicateur. */
  aDesPostesPartages: boolean;
}

// ── Argent de poche ───────────────────────────────────────────────────────────
export type ModePolitiqueArgentPoche = 'VARIABLE' | 'FIXE';
export type SourceArgentPoche = 'ALLOCATION' | 'POLITIQUE' | 'AUCUNE';

export interface PolitiqueArgentPocheDto {
  id: string;
  scenarioId: string;
  membreId: string;
  compteId: string;
  nom: string;
  /** Mois de début inclus, format ISO "YYYY-MM". */
  dateDebut: string;
  /** Mois de fin inclus, format ISO "YYYY-MM" ou `null` (politique ouverte). */
  dateFin?: string;
  mode: ModePolitiqueArgentPoche;
  socle?: number;
  pourcentage?: number;
  plafond?: number;
  montantFixe?: number;
}
export interface PolitiqueArgentPocheRequest {
  membreId: string;
  compteId: string;
  nom: string;
  dateDebut: string;
  dateFin?: string;
  mode: ModePolitiqueArgentPoche;
  socle?: number;
  pourcentage?: number;
  plafond?: number;
  montantFixe?: number;
}

export interface AllocationArgentPocheDto {
  id: string;
  scenarioId: string;
  membreId: string;
  compteId: string;
  mois: string;
  montant: number;
  raison?: string;
}
export interface AllocationArgentPocheRequest {
  membreId: string;
  compteId: string;
  mois: string;
  montant: number;
  raison?: string;
}

export interface ResolutionArgentPocheDto {
  montant: number;
  source: SourceArgentPoche;
  politiqueId?: string;
  allocationId?: string;
  rav: number;
}

/** RàV brut d'un membre pour un mois — indépendant de toute politique/allocation
 *  persistée (voir {@link RavBrutMoisDto} côté backend). Utilisé pour l'aperçu
 *  "6 prochains mois" de la popin politique. */
export interface RavBrutMoisDto {
  mois: number;
  rav: number;
}

export interface ResolutionArgentPocheMembreMoisDto {
  membreId: string;
  montant: number;
  source: SourceArgentPoche;
}

/** Résolution d'argent de poche agrégée à l'échelle du foyer pour un mois —
 *  somme des résolutions de tous les membres actifs du scénario. */
export interface ResolutionArgentPocheFoyerMoisDto {
  mois: number;
  total: number;
  parMembre: ResolutionArgentPocheMembreMoisDto[];
}

// ── Projection ────────────────────────────────────────────────────────────────
export interface AggregatDto { revenus: number; charges: number; reserves: number; soldeDisponible: number; }
export interface MoisDto { numero: number; agregat: AggregatDto; }
export interface ProjectionAnnuelleDto {
  annee: number; mois: MoisDto[]; moisReel: MoisDto[]; totalAnnuel: AggregatDto;
  parMembre: Record<string, AggregatDto>;
  moisParMembre: Record<string, AggregatDto[]>;
  moisParMembreReel: Record<string, AggregatDto[]>;
}
export interface TresorerieCumuleeDto {
  annee: number;
  mensualise: Array<number | string>;
  reel: Array<number | string>;
}
export interface EntreeTresorerieDto { annee: number; soldeAnnuel: number; tresorerieDebutAnnee: number; tresorerieFinAnnee: number; }
export interface MoisCourbeDto { annee: number; mois: number; tresorerie: number; }
export interface TresorerieDto { annees: EntreeTresorerieDto[]; courbe: MoisCourbeDto[]; }
export interface VentilationAggregatDto { revenus: number; charges: number; reserves: number; soldeDisponible: number; }
/** Décomposition perso/partagé d'un membre pour un mois donné, par type de poste (calculée par le moteur backend). */
export interface VentilationSplitDto {
  revenusPerso: number; revenusPartage: number;
  chargesPerso: number; chargesPartage: number;
  reservesPerso: number; reservesPartage: number;
}
export interface VentilationsDto {
  annee: number; mois: number;
  agregat: VentilationAggregatDto;
  parMembre: Record<string, VentilationAggregatDto>;
  parCategorie: Record<string, number>;
  parCategorieMembre: Record<string, Record<string, number>>;
  parCompteMembre: Record<string, Record<string, number>>;
  parMembreSplit: Record<string, VentilationSplitDto>;
}
/** Décomposition annuelle agrégée (somme des 12 mois), calculée en une seule requête
 *  serveur — même forme que {@link VentilationsDto} sans le champ `mois`. */
export interface VentilationAnnuelleDto {
  annee: number;
  agregat: VentilationAggregatDto;
  parMembre: Record<string, VentilationAggregatDto>;
  parCategorie: Record<string, number>;
  parCategorieMembre: Record<string, Record<string, number>>;
  parCompteMembre: Record<string, Record<string, number>>;
  parMembreSplit: Record<string, VentilationSplitDto>;
}
export interface SerieAnnuelleDto { annee: number; soldeParScenario: Record<string, number>; tresorerieParScenario: Record<string, number>; }

// ── Récapitulatif mensuel par compte (dashboard, vue membre) ──────────────────
export interface CompteRecapMensuelDto {
  compteId: string;
  libelleCompte: string;
  virementsEntrants: number;
  entrees: number;
  sortiesPlanifiees: number;
  sortiesEchues: number;
  virementsSortants: number;
  reservesEchues: number;
  soldeRestant: number;
}

/** Détail d'une ligne alimentant un compte (poste ou argent de poche) — liste affichée
 *  lorsqu'un compte est sélectionné dans la vue "Virements des comptes" (org-chart hub
 *  & rayons). `posteId`/`libelle` sont `null` si `argentPoche` est vrai (pas un poste).
 *  `quotePart` est `null` pour l'argent de poche (pas de notion de prorata). */
export interface ComptePosteDetailDto {
  posteId: string | null;
  libelle: string | null;
  type: TypePoste;
  argentPoche: boolean;
  montant: number;
  quotePart: number | null;
}

export interface SeuilsDashboardDto {
  moisARisqueSoldeMin: number;
  tauxEffortCorrect: number;
  tauxEffortTendu: number;
  tauxEffortSature: number;
  tauxEffortSoutenu: number;
  tauxEffortCritique: number;
  besoinsPlaisirsBudget: number;
  posteAOptimiserScore: number;
}
