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
  comptes: { libelle: string; soldeInitial: number; membreOrdres: number[] }[];
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
export interface MembreDto { id: string; nom: string; couleur: string; actif: boolean; }
export interface MembreRequest { nom: string; couleur: string; }

export interface CompteDto { id: string; libelle: string; soldeInitial: number; devise: string; actif: boolean; membreIds: string[]; }
export interface CompteRequest { libelle: string; soldeInitial: number; devise?: string; membreIds: string[]; }

export type TypeCategorie = 'REVENU' | 'CHARGE' | 'RESERVE' | 'PROJET';
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
export type MomentPeriode = 'DEBUT_PERIODE' | 'FIN_PERIODE';
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
}

// ── Objectifs ─────────────────────────────────────────────────────────────────
export interface ObjectifDto {
  id: string; libelle: string; categorieProjetId?: string;
  montantCible: number; echeance?: string;
  compteId?: string;
  soldeActuel: number; progression: number; epargneRequise: number;
}
export interface ObjectifRequest {
  libelle: string; categorieProjetId?: string;
  montantCible: number; echeance?: string;
  compteId: string;
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
export interface SerieAnnuelleDto { annee: number; soldeParScenario: Record<string, number>; tresorerieParScenario: Record<string, number>; }
