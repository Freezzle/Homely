// ── Auth ──────────────────────────────────────────────────────────────────────
export interface LoginRequest { email: string; motDePasse: string; }
export interface RegisterRequest { email: string; motDePasse: string; nomComplet: string; }
export interface TokensResponse { accessToken: string; refreshToken: string; }
export interface MoiResponse { id: string; email: string; nomComplet: string; }

// ── Foyer & accès ────────────────────────────────────────────────────────────
export type RoleFoyer = 'OWNER' | 'EDITOR' | 'VIEWER';

export interface FoyerDto { id: string; nom: string; deviseBase: string; monRole: RoleFoyer; }
export interface FoyerRequest {
  nom: string;
  deviseBase: string;
  membres?: { nom: string; couleur?: string }[];
}

export interface AccesFoyerDto {
  id: string; utilisateurId: string; email: string; nomComplet: string; role: RoleFoyer;
}
export interface InviterAccesRequest { email: string; role: RoleFoyer; }
export interface ChangerRoleRequest { role: RoleFoyer; }

// ── Référentiels ─────────────────────────────────────────────────────────────
export interface MembreDto { id: string; nom: string; couleur: string; ordre: number; actif: boolean; }
export interface MembreRequest { nom: string; couleur: string; ordre: number; }

export type TypeCompte = 'COURANT' | 'EPARGNE' | 'COMMUN' | 'AUTRE';
export interface CompteDto { id: string; libelle: string; type: TypeCompte; soldeInitial: number; devise: string; ordre: number; actif: boolean; }
export interface CompteRequest { libelle: string; type: TypeCompte; soldeInitial: number; devise?: string; ordre: number; }

export type TypeCategorie = 'REVENU' | 'CHARGE' | 'RESERVE';
export interface CategorieDto { id: string; libelle: string; typePoste: TypeCategorie; ordre: number; actif: boolean; }
export interface CategorieRequest { libelle: string; typePoste: TypeCategorie; ordre: number; }

export type TypeActif = 'IMMOBILIER' | 'FINANCIER' | 'RETRAITE' | 'AUTRE';
export interface ActifDto { id: string; libelle: string; typeActif: TypeActif; soldeInitial: number; devise: string; tauxCroissanceAnnuel: number; ordre: number; actif: boolean; }
export interface ActifRequest { libelle: string; typeActif: TypeActif; soldeInitial: number; devise?: string; tauxCroissanceAnnuel: number; ordre: number; }

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
export type NaturePoste = 'EFFECTIF' | 'PREVISION';
export type TypeRepartition = 'AUTO' | 'REVERSE_AUTO' | 'CUSTOM';

export interface RepartitionPosteDto { membreId: string; nomMembre: string; quotePart: number; }
export interface VentilationCompteDto { membreId: string; compteId: string; libelleCompte: string; }

export interface PosteDto {
  id: string; type: TypePoste; description: string; categorieId?: string;
  montant: number; montantMensualise: number; devise?: string;
  periodiciteMois: number; debut?: string; fin?: string;
  mode: ModeComptabilisation; moment: MomentPeriode; nature: NaturePoste;
  typeRepartition: TypeRepartition;
  compteSource?: string; ordre: number;
  repartitions: RepartitionPosteDto[];
  ventilations: VentilationCompteDto[];
}
export interface PosteRequest {
  type: TypePoste; description: string; categorieId?: string;
  montant: number; devise?: string; periodiciteMois: number;
  debut?: string; fin?: string;
  mode: ModeComptabilisation; moment: MomentPeriode; nature: NaturePoste;
  typeRepartition?: TypeRepartition;
  compteSource?: string; ordre: number;
  repartitions?: { membreId: string; quotePart: number; }[];
  ventilations?: { membreId: string; compteId: string; }[];
}

// ── Objectifs ─────────────────────────────────────────────────────────────────
export interface ObjectifDto {
  id: string; libelle: string; categorieProjetId?: string;
  montantCible: number; echeance?: string;
  compteId?: string; actifId?: string;
  soldeActuel: number; progression: number; epargneRequise: number;
}
export interface ObjectifRequest {
  libelle: string; categorieProjetId?: string;
  montantCible: number; echeance?: string;
  compteId?: string; actifId?: string;
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
export interface VentilationsDto {
  annee: number; mois: number;
  agregat: VentilationAggregatDto;
  parMembre: Record<string, VentilationAggregatDto>;
  parCategorie: Record<string, number>;
  parCategorieMembre: Record<string, Record<string, number>>;
  parCompteMembre: Record<string, Record<string, number>>;
}
export interface AnneePatrimoineDto { annee: number; patrimoineNet: number; soldesComptes: Record<string, number>; soldesActifs: Record<string, number>; }
export interface PatrimoineDto { annees: AnneePatrimoineDto[]; }
export interface SerieAnnuelleDto { annee: number; soldeParScenario: Record<string, number>; tresorerieParScenario: Record<string, number>; }
export interface ComparaisonDto { scenarioIds: string[]; nomScenarios: string[]; series: SerieAnnuelleDto[]; }
export interface ApercuPosteDto { annee: number; contributions: { mois: number; contribution: number; }[]; }
