import { Injectable, Signal, computed, effect, inject, signal, untracked } from '@angular/core';
import { Router } from '@angular/router';
import { forkJoin } from 'rxjs';
import { ContexteService } from '../../../../core/services/contexte.service';
import { DashboardConfigService } from '../../../../core/services/dashboard-config.service';
import { ProjectionService } from '../../../../core/services/projection.service';
import { CategorieService, CompteService } from '../../../../core/services/referentiel.service';
import { PosteService } from '../../../../core/services/scenario-poste.service';
import { ResolutionArgentPocheService } from '../../../../core/services/argent-poche.service';
import { DecompositionService, VentilationLike } from '../../../../core/services/decomposition.service';
import {
  AggregatDto,
  EvenementDto,
  MembreDto,
  ModeComptabilisation,
  PostePositionneDto,
  ProrataPartageMembreDto,
  TauxEffortMembreDto,
  TresorerieCumuleeDto,
  TypeCategorie,
  TypePoste,
  VentilationAggregatDto,
  ResolutionArgentPocheFoyerMoisDto,
  VirementCompteDto,
} from '../../../../core/models/api.models';
import { I18nService } from '../../../../core/i18n/i18n.service';
import { localeDeLangue } from '../../../../core/i18n/locale.util';
import { creerChargementReactif } from '../../../../core/utils/reference-data.util';
import { LigneDecomposition, MembreTagInfo } from '../../../../shared/components/carte-bilan/carte-bilan.component';
import { TauxEffortCardData } from '../../../../shared/components/taux-effort-card/taux-effort-card.component';
import { MetricRingSegment } from '../../../../shared/components/metric-ring/metric-ring.component';
import { MonthHealth, PeriodHealth, PeriodValue } from '../../../../shared/components/period-rail/period-rail.component';
import { TimelineItem } from '../../../../shared/components/event-grid/timeline-item.model';
import { MatriceBudgetaireLabels } from '../../../../shared/components/matrice-budgetaire/matrice-budgetaire.component';
import { IndicatorDrawerService } from './indicator-drawer.service';
import { Indicator, IndicatorItem } from '../models/indicator.model';
import { tauxEffortMembreIndicator } from '../../indicators/taux-effort-membre/taux-effort-membre.indicator';
import { ventilationPostesIndicator } from '../../indicators/ventilation-postes/ventilation-postes.indicator';
import { VentilationPostesDrawerData } from '../../indicators/ventilation-postes/ventilation-postes-drawer-content.component';
import { evolutionGraphiqueIndicator } from '../../indicators/evolution-graphique/evolution-graphique.indicator';
import { EvolutionGraphiqueDrawerData } from '../../indicators/evolution-graphique/evolution-graphique-drawer-content.component';
import { postesAOptimiserIndicator } from '../../indicators/postes-a-optimiser/postes-a-optimiser.indicator';
import { PostesAOptimiserDrawerData } from '../../indicators/postes-a-optimiser/postes-a-optimiser-drawer-content.component';
import { evenementsIndicator } from '../../indicators/evenements/evenements.indicator';
import { EvenementsDrawerData } from '../../indicators/evenements/evenements-drawer-content.component';
import { ContexteMembresVirements, virementsComptesIndicator } from '../../indicators/virements-comptes/virements-comptes.indicator';
import { VirementsComptesDrawerData } from '../../indicators/virements-comptes/virements-comptes-drawer-content.component';
import { besoinsPlaisirsIndicator } from '../../indicators/besoins-plaisirs/besoins-plaisirs.indicator';
import { BesoinsPlaisirsCardData } from '../../../../shared/components/besoins-plaisirs-card/besoins-plaisirs-card.component';
import { prorataPartageIndicator, aDesDonneesProrataPartage } from '../../indicators/prorata-partage/prorata-partage.indicator';
import { moisARisqueIndicator, SoldeMois } from '../../indicators/mois-a-risque/mois-a-risque.indicator';
import { MoisARisqueDrawerData, MoisARisqueItem } from '../../indicators/mois-a-risque/mois-a-risque-drawer-content.component';
import { niveauSanteMois } from '../utils/sante-mois.util';
import { resolveAppColor } from '../../../../shared/utils/css-vars';
import { SegmentDonut } from '../../../../shared/components/indicateurs/donut/indicateur-donut.component';
import { TonCarte, TonIndicateur } from '../../../../shared/components/indicateurs/tons';
import { EtapeEntonnoir } from '../../../../shared/components/indicateurs/entonnoir/indicateur-entonnoir.component';
import { ElementComparaison } from '../../../../shared/components/indicateurs/comparaison/indicateur-comparaison.component';
import { LigneBarresLigne, SegmentBarresLigne } from '../../../../shared/components/indicateurs/barres-ligne/indicateur-barres-ligne.component';

type DashboardTimelineItem = TimelineItem & { mois: number };
/** Sujet du tableau de bord affiché : le foyer entier (cumul de tous les membres) ou un
 *  membre spécifique (données propres uniquement). Piloté par le segment `:sujetId`
 *  de la route (`'foyer'` ou l'id du membre). */
type SujetDashboard = { mode: 'foyer' } | { mode: 'membre'; membreId: string; membre: MembreDto };
const ZERO_AGREGAT: { revenus: number; charges: number; reserves: number; soldeDisponible: number } =
  { revenus: 0, charges: 0, reserves: 0, soldeDisponible: 0 };

export type DashboardViewKey = 'apercu' | 'comptes' | 'postes' | 'membres';

/** Ton de carte associé à chaque type de poste (charte `--app-*`). */
const TON_CARTE_PAR_TYPE: Record<TypePoste, TonCarte> = {
  REVENU: 'revenu',
  CHARGE: 'charge',
  RESERVE: 'reserve',
};

/** Données d'affichage d'une carte donut « <type> par catégorie ». */
export interface RepartitionParCategorie {
  type: TypePoste;
  titre: string;
  messageVide: string;
  ton: TonCarte;
  sousTitre: Signal<string>;
  chargement: Signal<boolean>;
  segments: Signal<SegmentDonut[]>;
  /** Total de la période en notation compacte (affiché au centre du donut). */
  centre: Signal<string>;
}

/** Données d'affichage de la carte `app-indicateur-comparaison` (mode tableau) de la vue Aperçu. */
export interface ComparaisonPeriode {
  libellePrecedent: string;
  libelleActuel: string;
  elements: ElementComparaison[];
}

/** Données d'affichage de la carte « Flux mensuel » (`app-indicateur-barres-ligne`). */
export interface FluxBarresLigne {
  /** Sorties du mois, empilées du bas vers le haut. */
  segments: SegmentBarresLigne[];
  /** Ligne de référence : les revenus du mois. */
  ligne: LigneBarresLigne;
  libelles: string[];
  libellesComplets: string[];
  formateurValeur: (valeur: number) => string;
  formateurInfobulle: (index: number) => string;
}

@Injectable()
export class DashboardFacadeService {
  private readonly i18n = inject(I18nService);
  readonly contexte = inject(ContexteService);
  private readonly dashboardConfig = inject(DashboardConfigService);
  private readonly projSvc = inject(ProjectionService);
  private readonly categorieSvc = inject(CategorieService);
  private readonly compteSvc = inject(CompteService);
  private readonly posteSvc = inject(PosteService);
  private readonly argentPocheSvc = inject(ResolutionArgentPocheService);
  private readonly decomp = inject(DecompositionService);
  private readonly router = inject(Router);
  private readonly indicatorDrawer = inject(IndicatorDrawerService);

  readonly t = this.i18n.translations();
  readonly deviseBase = this.contexte.deviseBase;
  readonly membres = this.contexte.membres;
  readonly seuils = this.dashboardConfig.seuils;

  /** Couleurs de la charte `--app-*` résolues à l'exécution pour Chart.js
   *  (le `<canvas>` ne résout pas les CSS custom properties). Dépend de
   *  `contexte.isDark()` pour se ré-évaluer automatiquement à chaque
   *  bascule de thème. Les fallbacks correspondent aux teintes historiques
   *  du dashboard, utilisées en cas d'exécution hors DOM (SSR/tests). */
  private readonly chartColors = computed(() => {
    void this.contexte.isDark();
    return {
      revenu: resolveAppColor('--app-revenu', '#3BBFA1'),
      charge: resolveAppColor('--app-charge', '#EF5350'),
      reserve: resolveAppColor('--app-reserve', '#42A5F5'),
      argentPoche: resolveAppColor('--app-argent-poche', '#FFB300'),
      positif: resolveAppColor('--app-positif', '#3BBFA1'),
      negatif: resolveAppColor('--app-negatif', '#EF5350'),
    };
  });

  readonly annee = signal<number>(new Date().getFullYear());
  readonly mois = signal<number | undefined>(undefined);
  /** `'foyer'` ou l'id d'un membre — segment `:sujetId` de la route. */
  readonly sujetId = signal<string>('foyer');
  readonly currentViewKey = signal<DashboardViewKey>('apercu');
  private readonly rememberedMonthIndex = signal<number>(new Date().getMonth());

  /** Sujet effectif : foyer, ou membre résolu depuis `sujetId` (fallback foyer si id inconnu). */
  readonly sujet = computed<SujetDashboard>(() => {
    const id = this.sujetId();
    if (id === 'foyer') return { mode: 'foyer' };
    const membre = this.membres().find((m) => m.id === id);
    return membre ? { mode: 'membre', membreId: id, membre } : { mode: 'foyer' };
  });

  readonly estModeMembre = computed(() => this.sujet().mode === 'membre');
  readonly membreCourant = computed<MembreDto | null>(() => {
    const s = this.sujet();
    return s.mode === 'membre' ? s.membre : null;
  });

  /** Id du membre courant (vue membre), `null` en vue foyer — utilisé pour désactiver la case
   *  "fait" des virements dont le compte source ne l'inclut pas (voir `TableVirementsComptesComponent`). */
  readonly membreActuelId = computed<string | null>(() => this.membreCourant()?.id ?? null);

  /** Si `sujetId` ne correspond à aucun membre connu du foyer (une fois les membres
   *  chargés), on redirige silencieusement vers la vue foyer plutôt que d'afficher une
   *  page vide/incohérente. La vue "foyer" n'a de sens qu'à partir de 2 membres : en
   *  mono-membre, on force systématiquement le dashboard du membre unique. */
  private readonly _redirectSiSujetInvalideEffect = effect(() => {
    const id = this.sujetId();
    const membres = this.membres();
    if (membres.length === 0) return;
    if (membres.length === 1) {
      if (id !== membres[0].id) untracked(() => this.naviguerVersSujet(membres[0].id));
      return;
    }
    if (id === 'foyer') return;
    if (membres.some((m) => m.id === id)) return;
    untracked(() => this.naviguerVersSujet('foyer'));
  });

  readonly moisSelectionne = computed(() => {
    const mois = this.mois();
    return mois !== undefined && Number.isFinite(mois) && mois >= 1 && mois <= 12 ? mois : undefined;
  });

  readonly vue = computed<'annee' | 'mois'>(() => this.moisSelectionne() !== undefined ? 'mois' : 'annee');
  readonly vueDecomposition = signal<'CATEGORIE' | 'TYPE_POSTE' | 'COMPTE'>('TYPE_POSTE');
  readonly minYear = computed(() => this.annees()[0] ?? this.annee());
  readonly maxYear = computed(() => this.annees()[this.annees().length - 1] ?? this.annee());
  readonly periodValue = computed<PeriodValue>(() => ({
    mode: this.vue(),
    monthIndex: this.vue() === 'mois' ? (this.moisSelectionne() ?? 1) - 1 : this.rememberedMonthIndex(),
    year: this.annee(),
  }));

  readonly vueDecompositionOptions = [
    { label: this.t.projection.vueTypePoste, value: 'TYPE_POSTE' },
    { label: this.t.projection.vueCategorie, value: 'CATEGORIE' },
    { label: this.t.projection.vueCompte, value: 'COMPTE' },
  ];

  /** Titre affiché en en-tête : nom du foyer ou nom du membre sélectionné. */
  readonly titrePage = computed(() => {
    const membre = this.membreCourant();
    return membre ? membre.nom : this.t.nav.dashboardFoyer;
  });

  readonly annees = computed(() => {
    const scenario = this.contexte.scenarioCourant();
    return scenario
      ? Array.from({ length: scenario.horizonAnnees }, (_, i) => scenario.anneeDepart + i)
      : [this.annee()];
  });

  private readonly _refCle = computed<{ foyerId: string; scenarioId: string } | null>(() => {
    const foyerId = this.contexte.foyerId();
    const scenarioId = this.contexte.scenarioId();
    return foyerId && scenarioId ? { foyerId, scenarioId } : null;
  });

  private readonly _refData = creerChargementReactif(this._refCle, ({ foyerId }) =>
    forkJoin([
      this.categorieSvc.lister(foyerId),
      this.compteSvc.lister(foyerId),
    ]),
  );

  readonly categories = computed(() => this._refData.donnees()?.[0] ?? []);
  readonly comptes = computed(() => this._refData.donnees()?.[1] ?? []);

  private readonly _projectionAnnuelleCle = computed<{ foyerId: string; scenarioId: string; annee: number } | null>(() => {
    const ref = this._refCle();
    return ref ? { ...ref, annee: this.annee() } : null;
  });

  private readonly _projectionAnnuelle = creerChargementReactif(this._projectionAnnuelleCle, ({ foyerId, scenarioId, annee }) =>
    this.projSvc.annuelle(foyerId, scenarioId, annee),
  );

  readonly projectionAnnuelle = computed(() => this._projectionAnnuelle.donnees());

  private readonly _tresorerieCumuleeCle = computed<{ foyerId: string; scenarioId: string; annee: number; membreId?: string } | null>(() => {
    if (this.vue() !== 'annee') return null;
    const cle = this._projectionAnnuelleCle();
    const s = this.sujet();
    return cle ? { ...cle, membreId: s.mode === 'membre' ? s.membreId : undefined } : null;
  });

  private readonly _tresorerieCumulee = creerChargementReactif(this._tresorerieCumuleeCle, ({ foyerId, scenarioId, annee, membreId }) =>
    this.projSvc.tresorerieCumulee(foyerId, scenarioId, annee, membreId),
  );

  private readonly _evenementsCle = computed<{ foyerId: string; scenarioId: string; annee: number; membreId?: string } | null>(() => {
    const cle = this._projectionAnnuelleCle();
    const s = this.sujet();
    return cle ? { ...cle, membreId: s.mode === 'membre' ? s.membreId : undefined } : null;
  });

  private readonly _evenements = creerChargementReactif(this._evenementsCle, ({ foyerId, scenarioId, annee, membreId }) =>
    this.projSvc.evenements(foyerId, scenarioId, annee, membreId),
  );

  readonly evenementsDto = computed<EvenementDto[]>(() => this._evenements.donnees() ?? []);

  /** Événements de l'année N-1 — nécessaires à la tendance de l'indicateur « événements »
   *  en vue année et en janvier (vue mois). Pas d'année antérieure au début du scénario. */
  private readonly _evenementsAnneePrecedenteCle = computed<{ foyerId: string; scenarioId: string; annee: number; membreId?: string } | null>(() => {
    const enJanvier = this.vue() === 'mois' && this.moisSelectionne() === 1;
    if (this.vue() !== 'annee' && !enJanvier) return null;
    const cle = this._evenementsCle();
    const scenario = this.contexte.scenarioCourant();
    const anneePrecedente = this.annee() - 1;
    if (!cle || !scenario || anneePrecedente < scenario.anneeDepart) return null;
    return { ...cle, annee: anneePrecedente };
  });

  private readonly _evenementsAnneePrecedente = creerChargementReactif(this._evenementsAnneePrecedenteCle, ({ foyerId, scenarioId, annee, membreId }) =>
    this.projSvc.evenements(foyerId, scenarioId, annee, membreId),
  );

  /** Nombre d'événements du mois précédant le mois sélectionné (`null` si inconnu). */
  private readonly nbEvenementsMoisPrecedent = computed<number | null>(() => {
    const mois = this.moisSelectionne();
    if (mois === undefined) return null;
    if (mois > 1) return this.evenementsDto().filter((e) => e.mois === mois - 1).length;
    const precedents = this._evenementsAnneePrecedente.donnees();
    return precedents ? precedents.filter((e) => e.mois === 12).length : null;
  });

  /** Nombre d'événements de l'année précédente (`null` si inconnu). */
  private readonly nbEvenementsAnneePrecedente = computed<number | null>(() =>
    this._evenementsAnneePrecedente.donnees()?.length ?? null,
  );

  /** Clé d'une répartition par catégorie : suit le sujet (foyer/membre) et la vue (année/mois). */
  private readonly _repartitionCle = computed<{ foyerId: string; scenarioId: string; annee: number; mois?: number; membreId?: string } | null>(() => {
    const cle = this._evenementsCle();
    return cle ? { ...cle, mois: this.moisSelectionne() } : null;
  });

  /** Fabrique la carte donut « <type> par catégorie » : chargement, segments (top 6 +
   *  « Autres »), total compact au centre et sous-titre selon la vue. Les parts viennent
   *  du backend (`…/projection/repartition-categories`), jamais recalculées ici. */
  private creerRepartitionParCategorie(type: TypePoste, cles: {
    titre: string; sousTitreMois: string; sousTitreAnnee: string; aucune: string;
  }): RepartitionParCategorie {    const chargement = creerChargementReactif(this._repartitionCle, ({ foyerId, scenarioId, annee, mois, membreId }) =>
      this.projSvc.repartitionCategories(foyerId, scenarioId, annee, type, mois, membreId),
    );

    const segments = computed<SegmentDonut[]>(() => {
      const lignes = chargement.donnees() ?? [];
      const infobulle = (libelle: string, montant: number, part: number) =>
        `${libelle} · ${this.formatMontant(montant)} · ${Intl.NumberFormat(this.localeCourante(), { style: 'percent', maximumFractionDigits: 1 }).format(part)}`;

      const LIMITE = 6;
      const principales = lignes.length > LIMITE + 1 ? lignes.slice(0, LIMITE) : lignes;
      const reste = lignes.slice(principales.length);
      // Aucun `ton` explicite : le donut applique la palette catégorielle dans l'ordre
      // d'affichage. Les donuts d'une même page partagent donc la même séquence de
      // couleurs (1er segment = 1re couleur, etc.), les parts étant déjà triées par
      // ordre décroissant côté backend.
      const liste: SegmentDonut[] = principales.map((l) => ({
        libelle: l.libelle,
        valeur: l.part * 100,
        infobulle: infobulle(l.libelle, l.montant, l.part),
      }));
      if (reste.length) {
        const montant = reste.reduce((s, l) => s + l.montant, 0);
        const part = reste.reduce((s, l) => s + l.part, 0);
        const libelle = this.t.dashboard.repartitionCategoriesAutres;
        liste.push({
          libelle,
          valeur: part * 100,
          ton: 'neutre',
          infobulle: `${infobulle(libelle, montant, part)} (${reste.map((l) => l.libelle).join(', ')})`,
        });
      }
      return liste;
    });

    return {
      type,
      titre: cles.titre,
      messageVide: cles.aucune,
      ton: TON_CARTE_PAR_TYPE[type],
      sousTitre: computed(() => (this.vue() === 'annee' ? cles.sousTitreAnnee : cles.sousTitreMois)),
      chargement: computed(() => chargement.chargement()),
      segments,
      centre: computed(() => this.fmtCompact((chargement.donnees() ?? []).reduce((s, l) => s + l.montant, 0))),
    };
  }

  /** Cartes « par catégorie » du dashboard, dans l'ordre d'affichage (revenus → charges → réserves). */
  readonly repartitionsParCategorie: readonly RepartitionParCategorie[] = [
    this.creerRepartitionParCategorie('REVENU', {
      titre: this.t.dashboard.revenusParCategorieTitre,
      sousTitreMois: this.t.dashboard.revenusParCategorieSousTitreMois,
      sousTitreAnnee: this.t.dashboard.revenusParCategorieSousTitreAnnee,
      aucune: this.t.dashboard.revenusParCategorieAucune,
    }),
    this.creerRepartitionParCategorie('CHARGE', {
      titre: this.t.dashboard.chargesParCategorieTitre,
      sousTitreMois: this.t.dashboard.chargesParCategorieSousTitreMois,
      sousTitreAnnee: this.t.dashboard.chargesParCategorieSousTitreAnnee,
      aucune: this.t.dashboard.chargesParCategorieAucune,
    }),
    this.creerRepartitionParCategorie('RESERVE', {
      titre: this.t.dashboard.reservesParCategorieTitre,
      sousTitreMois: this.t.dashboard.reservesParCategorieSousTitreMois,
      sousTitreAnnee: this.t.dashboard.reservesParCategorieSousTitreAnnee,
      aucune: this.t.dashboard.reservesParCategorieAucune,
    }),
  ];

  /** Matrice budgétaire "Nécessité vs Priorité d'action" (dashboard annuel) : postes déjà
   *  filtrés (non obsolètes, dédupliqués par chaîne de révisions, scopés au membre courant
   *  si applicable) et positionnés (scores 0-100, poids du montant, quadrant) — tout est
   *  calculé côté serveur par `MatriceBudgetaireService`, ce composant ne fait plus que
   *  transmettre les données reçues au composant partagé `app-matrice-budgetaire`. */
  private readonly _matriceBudgetaire = creerChargementReactif(this._evenementsCle, ({ foyerId, scenarioId, annee, membreId }) =>
    this.posteSvc.matriceBudgetaire(foyerId, scenarioId, annee, undefined, membreId),
  );

  readonly postesMatriceAnnee = computed<PostePositionneDto[]>(() => this._matriceBudgetaire.donnees() ?? []);

  readonly matriceChargement = computed(() => this._matriceBudgetaire.chargement());

  /**
   * PR5 — Résolution mensuelle de l'argent de poche sur les 12 mois de l'année
   * courante, chargée uniquement en <b>mode membre</b> (l'argent de poche n'a
   * pas de sens agrégé au niveau du foyer). Un seul aller-retour réseau grâce à
   * l'endpoint {@code /resolution-annee} — pas de N+1. La resource s'annule
   * automatiquement au changement de foyer/scenario/année/membre via
   * {@link creerChargementReactif}.
   */
  private readonly _argentPocheCle = computed<{ foyerId: string; scenarioId: string; annee: number; membreId: string } | null>(() => {
    const ref = this._refCle();
    const s = this.sujet();
    return ref && s.mode === 'membre' ? { ...ref, annee: this.annee(), membreId: s.membreId } : null;
  });

  private readonly _argentPoche = creerChargementReactif(this._argentPocheCle, ({ foyerId, scenarioId, annee, membreId }) =>
    this.argentPocheSvc.resoudreAnnee(foyerId, scenarioId, membreId, annee),
  );

  /** Résolutions 12 mois (janvier=index 0). Vide en mode foyer. */
  readonly argentPocheMois = computed(() => this._argentPoche.donnees() ?? []);

  /** Résolution du mois sélectionné (mode mois + membre) — `null` sinon. */
  readonly argentPocheMoisCourant = computed(() => {
    const mois = this.moisSelectionne();
    const items = this.argentPocheMois();
    return mois !== undefined && items[mois - 1] ? items[mois - 1] : null;
  });

  /** Total annuel d'argent de poche (mode membre uniquement). */
  readonly argentPocheTotalAnnuel = computed(() =>
    this.argentPocheMois().reduce((sum, r) => sum + (r.montant ?? 0), 0),
  );

  /** Clé de chargement de l'argent de poche de l'année N-1 (mode membre uniquement) —
   *  nécessaire pour l'indicateur "Comparaison" (diff annuelle) et le cas janvier de la
   *  diff mensuelle. Même garde-fou que `_projectionAnneePrecedenteCle` (pas d'année
   *  antérieure au début du scénario). */
  private readonly _argentPocheAnneePrecedenteCle = computed<{ foyerId: string; scenarioId: string; annee: number; membreId: string } | null>(() => {
    const enJanvier = this.vue() === 'mois' && this.moisSelectionne() === 1;
    if (this.vue() !== 'annee' && !enJanvier) return null;
    const ref = this._refCle();
    const s = this.sujet();
    const scenario = this.contexte.scenarioCourant();
    const anneePrecedente = this.annee() - 1;
    if (!ref || s.mode !== 'membre' || !scenario || anneePrecedente < scenario.anneeDepart) return null;
    return { ...ref, annee: anneePrecedente, membreId: s.membreId };
  });

  private readonly _argentPocheAnneePrecedente = creerChargementReactif(this._argentPocheAnneePrecedenteCle, ({ foyerId, scenarioId, annee, membreId }) =>
    this.argentPocheSvc.resoudreAnnee(foyerId, scenarioId, membreId, annee),
  );

  /** Résolutions 12 mois de l'année précédente (mode membre uniquement). Vide sinon. */
  readonly argentPocheMoisAnneePrecedente = computed(() => this._argentPocheAnneePrecedente.donnees() ?? []);

  /** Total annuel d'argent de poche de l'année précédente (mode membre uniquement). */
  readonly argentPocheTotalAnneePrecedente = computed(() =>
    this.argentPocheMoisAnneePrecedente().reduce((sum, r) => sum + (r.montant ?? 0), 0),
  );

  /**
   * PR6.d — Agrégat foyer de l'argent de poche : total de tous les membres,
   * chargé uniquement en <b>mode foyer</b> (en mode membre, `argentPocheMois`
   * ci-dessus suffit). Un seul aller-retour réseau grâce à
   * `/resolution-foyer-annee` (boucle serveur, pas de N+1).
   */
  private readonly _argentPocheFoyerCle = computed<{ foyerId: string; scenarioId: string; annee: number } | null>(() => {
    const ref = this._refCle();
    return ref && this.sujet().mode === 'foyer' ? { ...ref, annee: this.annee() } : null;
  });

  private readonly _argentPocheFoyer = creerChargementReactif(this._argentPocheFoyerCle, ({ foyerId, scenarioId, annee }) =>
    this.argentPocheSvc.resoudreFoyerAnnee(foyerId, scenarioId, annee),
  );

  /** Totaux mensuels foyer (janvier=index 0). Vide en mode membre. */
  readonly argentPocheFoyerMois = computed(() => this._argentPocheFoyer.donnees() ?? []);

  /** Total mensuel foyer du mois sélectionné (mode mois + foyer) — `null` sinon. */
  readonly argentPocheFoyerMoisCourant = computed<ResolutionArgentPocheFoyerMoisDto | null>(() => {
    const mois = this.moisSelectionne();
    const items = this.argentPocheFoyerMois();
    return mois !== undefined && items[mois - 1] ? items[mois - 1] : null;
  });

  /** Total annuel foyer d'argent de poche (mode foyer uniquement). */
  readonly argentPocheFoyerTotalAnnuel = computed(() =>
    this.argentPocheFoyerMois().reduce((sum, r) => sum + (r.total ?? 0), 0),
  );

  /** Pendant foyer de `_argentPocheAnneePrecedenteCle` : l'historique N-1 est nécessaire
   *  aux cartes de comparaison, qui s'affichent aussi en mode foyer. Même garde-fou
   *  d'année que `_projectionAnneePrecedenteCle`. */
  private readonly _argentPocheFoyerAnneePrecedenteCle = computed<{ foyerId: string; scenarioId: string; annee: number } | null>(() => {
    const ref = this._refCle();
    const cle = this._projectionAnneePrecedenteCle();
    return ref && cle && this.sujet().mode === 'foyer' ? { ...ref, annee: cle.annee } : null;
  });

  private readonly _argentPocheFoyerAnneePrecedente = creerChargementReactif(
    this._argentPocheFoyerAnneePrecedenteCle,
    ({ foyerId, scenarioId, annee }) => this.argentPocheSvc.resoudreFoyerAnnee(foyerId, scenarioId, annee),
  );

  /** Totaux mensuels foyer de l'année précédente (janvier = index 0). Vide en mode membre. */
  readonly argentPocheFoyerMoisAnneePrecedente = computed(() =>
    this._argentPocheFoyerAnneePrecedente.donnees() ?? [],
  );

  /** Total annuel foyer d'argent de poche de l'année précédente. */
  readonly argentPocheFoyerTotalAnneePrecedente = computed(() =>
    this.argentPocheFoyerMoisAnneePrecedente().reduce((sum, r) => sum + (r.total ?? 0), 0),
  );

  private readonly _ventilationsMoisCle = computed<{ foyerId: string; scenarioId: string; annee: number; mois: number } | null>(() => {
    const ref = this._refCle();
    const mois = this.moisSelectionne();
    return ref && mois !== undefined ? { ...ref, annee: this.annee(), mois } : null;
  });

  private readonly _ventilationsMois = creerChargementReactif(this._ventilationsMoisCle, ({ foyerId, scenarioId, annee, mois }) =>
    this.projSvc.mensuelle(foyerId, scenarioId, annee, mois),
  );

  readonly ventilations = computed(() => this._ventilationsMois.donnees());

  /** Indicateur 04 — Taux d'effort par membre pour le mois sélectionné (vue mois).
   *  Chargé pour tous les membres actifs du foyer ; filtré côté client selon le sujet
   *  affiché (foyer entier ou un membre spécifique) via `tauxEffortCards`. */
  private readonly _tauxEffortCle = computed(() => this._ventilationsMoisCle());

  private readonly _tauxEffort = creerChargementReactif(this._tauxEffortCle, ({ foyerId, scenarioId, annee, mois }) =>
    this.projSvc.tauxEffort(foyerId, scenarioId, annee, mois),
  );

  /** Cartes prêtes à l'emploi pour `<app-taux-effort-card>` — toutes les cartes en vue
   *  foyer (une par membre actif), uniquement celle du membre courant en vue membre. */
  readonly tauxEffortCards = computed<TauxEffortCardData[]>(() =>
    this.filtrerCartesSelonSujet(this.mapperTauxEffortCards(this._tauxEffort.donnees())),
  );

  /** Indicateur 04 — Variante annuelle (vue année) : mêmes cartes, mais agrégats sommés
   *  sur les 12 mois de l'année sélectionnée. */
  private readonly _tauxEffortAnnuelCle = computed(() => this._projectionAnnuelleCle());

  private readonly _tauxEffortAnnuel = creerChargementReactif(this._tauxEffortAnnuelCle, ({ foyerId, scenarioId, annee }) =>
    this.projSvc.tauxEffortAnnuel(foyerId, scenarioId, annee),
  );

  readonly tauxEffortCardsAnnee = computed<TauxEffortCardData[]>(() =>
    this.filtrerCartesSelonSujet(this.mapperTauxEffortCards(this._tauxEffortAnnuel.donnees())),
  );

  /** Section dashboard "Taux d'effort par membre" (vue mois) — une carte cliquable par
   *  membre, réutilisant les mêmes données que `<app-taux-effort-card>` déjà affichées
   *  plus haut. Le clic ouvre le drawer partagé avec la carte détaillée en contenu. */
  readonly tauxEffortIndicateursMois = computed(() =>
    this.tauxEffortCards().map((data) => ({ indicator: tauxEffortMembreIndicator(data, this.t, this.seuils(), this.formateurMontant), data })),
  );

  /** Variante annuelle de la section "Taux d'effort" (vue année). Masquée en vue foyer
   *  agrégée (`sujet().mode === 'foyer'`) : sur l'année, l'indicateur par membre n'a de
   *  sens que consulté depuis le dashboard d'un membre précis. */
  readonly tauxEffortIndicateursAnnee = computed(() =>
    this.estModeMembre() ? this.tauxEffortCardsAnnee().map((data) => ({ indicator: tauxEffortMembreIndicator(data, this.t, this.seuils(), this.formateurMontant), data })) : [],
  );

  // ── Indicateur "Prorata des postes partagés" ────────────────────────────
  /** Foyer entier uniquement (jamais scopé membre) — mêmes coordonnées que le taux
   *  d'effort (`_tauxEffortCle`/`_tauxEffortAnnuelCle`), la comparaison n'a de sens
   *  qu'entre tous les membres du foyer. */
  private readonly _prorataPartageMois = creerChargementReactif(this._tauxEffortCle, ({ foyerId, scenarioId, annee, mois }) =>
    this.projSvc.prorataPartage(foyerId, scenarioId, annee, mois),
  );

  private readonly _prorataPartageAnnee = creerChargementReactif(this._tauxEffortAnnuelCle, ({ foyerId, scenarioId, annee }) =>
    this.projSvc.prorataPartageAnnuel(foyerId, scenarioId, annee),
  );

  private readonly prorataPartageDtosMois = computed<ProrataPartageMembreDto[]>(() => this._prorataPartageMois.donnees() ?? []);
  private readonly prorataPartageDtosAnnee = computed<ProrataPartageMembreDto[]>(() => this._prorataPartageAnnee.donnees() ?? []);

  /** `null` si aucun membre n'a de poste partagé sur la période — masque entièrement
   *  l'indicateur (ex. foyer mono-membre, aucun poste CHARGE/RESERVE partagé défini). */
  readonly prorataPartageIndicateurMois = computed(() => {
    const dtos = this.prorataPartageDtosMois();
    if (!aDesDonneesProrataPartage(dtos)) return null;
    return { indicator: prorataPartageIndicator('prorata-partage-mois', dtos, this.t), data: dtos };
  });

  readonly prorataPartageIndicateurAnnee = computed(() => {
    const dtos = this.prorataPartageDtosAnnee();
    if (!aDesDonneesProrataPartage(dtos)) return null;
    return { indicator: prorataPartageIndicator('prorata-partage-annee', dtos, this.t), data: dtos };
  });

  /** Payload signaux transmis au drawer "Événements" — `layout` fige le rendu (groupé pour
   *  l'année, à plat pour le mois où tous les items partagent le même "when"). */
  private readonly evenementsDataMois = computed<EvenementsDrawerData>(() => ({
    items: this.evenementsMois,
    devise: this.deviseBase,
    layout: 'flat',
    onSelect: (item) => this.ouvrirMoisDepuisTimeline(item),
  }));

  private readonly evenementsDataAnnee = computed<EvenementsDrawerData>(() => ({
    items: this.evenementsAnnee,
    devise: this.deviseBase,
    layout: 'grouped',
    onSelect: (item) => this.ouvrirMoisDepuisTimeline(item),
  }));

  /** Indicateur "Les événements du mois" — reprend le contenu de l'onglet "Événement" dans
   *  le drawer (liste plate, sans le retirer de l'onglet d'origine). */
  readonly evenementsIndicateurMois = computed(() => ({
    indicator: evenementsIndicator('evenements-mois', this.t.dashboard.indicateurEvenementsMoisTitre, this.evenementsMois(),
      this.nbEvenementsMoisPrecedent(), this.libelleComparaisonEvenements(), this.localeCourante(), this.t),
    data: this.evenementsDataMois(),
  }));

  /** Variante annuelle — reprend le contenu de l'onglet "Ce qui change" (rendu groupé
   *  inchangé) dans le drawer. */
  readonly evenementsIndicateurAnnee = computed(() => ({
    indicator: evenementsIndicator('evenements-annee', this.t.dashboard.indicateurEvenementsAnneeTitre, this.evenementsAnnee(),
      this.nbEvenementsAnneePrecedente(), this.libelleComparaisonEvenements(), this.localeCourante(), this.t),
    data: this.evenementsDataAnnee(),
  }));

  private libelleComparaisonEvenements(): string {
    return this.i18n.instant('dashboard.indicateurEvenementsComparaison', { periode: this.libellesComparaison().precedent });
  }

  /** Payload signaux transmis au drawer "Virements des comptes" (vue mois). */
  private readonly virementsComptesData = computed<VirementsComptesDrawerData>(() => ({
    virements: this.virementsComptesDto,
    comptes: this.comptes,
    membres: this.membres,
    virementsFaits: this.virementsComptesFaits,
    membreActuelId: this.membreActuelId,
    devise: this.deviseBase,
    chargement: this.virementsComptesChargement,
    onBascule: (cle) => this.basculerVirementCompteFait(cle),
  }));

  /** Référentiels permettant à l'indicateur de signaler (avatar) les comptes d'un autre membre. */
  private readonly contexteMembresVirements = computed<ContexteMembresVirements>(() => ({
    comptes: this.comptes(),
    membres: this.membres(),
    membreActuelId: this.membreActuelId(),
    initiales: (nom) => this.decomp.initiales(nom),
  }));

  /** Indicateur "Virements des comptes" (mois + vue membre uniquement, mêmes données que
   *  l'onglet "Comptes") — `null` si non applicable (vue foyer ou vue année). */
  readonly virementsComptesIndicateur = computed(() => {
    if (!this.afficherOngletComptes()) return null;
    return {
      indicator: virementsComptesIndicator('virements-comptes-mois', this.virementsComptesDto(), this.formateurMontant, this.t, this.contexteMembresVirements()),
      data: this.virementsComptesData(),
    };
  });

  /** Payload signaux transmis au drawer "Virements des comptes" (vue année). */
  private readonly virementsComptesDataAnnee = computed<VirementsComptesDrawerData>(() => ({
    virements: this.virementsComptesAnnuelDto,
    comptes: this.comptes,
    membres: this.membres,
    virementsFaits: this.virementsComptesFaits,
    membreActuelId: this.membreActuelId,
    devise: this.deviseBase,
    chargement: this.virementsComptesAnnuelChargement,
    onBascule: (cle) => this.basculerVirementCompteFait(cle),
  }));

  /** Indicateur "Virements des comptes" (vue année, vue membre uniquement) — variante
   *  annuelle de {@link virementsComptesIndicateur} : montants des paires identiques sommés
   *  sur les 12 mois. `null` si non applicable (vue foyer). */
  readonly virementsComptesIndicateurAnnee = computed(() => {
    if (!this.afficherOngletComptes()) return null;
    return {
      indicator: virementsComptesIndicator('virements-comptes-annee', this.virementsComptesAnnuelDto(), this.formateurMontant, this.t, this.contexteMembresVirements()),
      data: this.virementsComptesDataAnnee(),
    };
  });


  /** Ouvre le drawer partagé pour l'indicateur cliqué (tous les indicateurs du dashboard
   *  utilisent cette méthode générique), avec les données déjà résolues en payload —
   *  chaque indicateur déclare son propre composant de contenu (`indicator.drawerContent`). */
  ouvrirIndicateur(sectionLabel: string, indicator: Indicator, data: unknown): void {
    this.indicatorDrawer.open({
      sectionLabel,
      title: indicator.title,
      content: indicator.drawerContent,
      data,
    });
  }

  /** Payload signaux transmis au drawer "Ventilations des postes" (vue mois) — voir
   *  `VentilationPostesDrawerData` : références de signaux, pas de snapshot, pour que le
   *  selectbutton reste réactif sans dupliquer `carteMoisConfig`/`vueDecomposition`. */
  private readonly ventilationPostesDataMois = computed<VentilationPostesDrawerData>(() => ({
    vueDecomposition: this.vueDecomposition,
    vueDecompositionOptions: this.vueDecompositionOptions,
    carteConfig: this.carteMoisConfig,
    devise: this.deviseBase,
  }));

  private readonly ventilationPostesDataAnnee = computed<VentilationPostesDrawerData>(() => ({
    vueDecomposition: this.vueDecomposition,
    vueDecompositionOptions: this.vueDecompositionOptions,
    carteConfig: this.carteAnneeConfig,
    devise: this.deviseBase,
  }));

  /** Indicateur "Ventilations des postes" (vue mois) — reprend le contenu de l'onglet
   *  "Récapitulatifs" dans le drawer, sans le retirer de l'onglet d'origine. */
  readonly ventilationPostesIndicateurMois = computed(() => ({
    indicator: ventilationPostesIndicator(
      'ventilation-postes-mois',
      this.agregatMoisCourant(),
      this.argentPocheMontantMoisSujet(),
      this.formateurMontant,
      this.t,
    ),
    data: this.ventilationPostesDataMois(),
  }));

  /** Variante annuelle de l'indicateur "Ventilations des postes" (vue année). */
  readonly ventilationPostesIndicateurAnnee = computed(() => ({
    indicator: ventilationPostesIndicator(
      'ventilation-postes-annee',
      this.agregatAnneeCourant(),
      this.argentPocheMontantAnneeSujet(),
      this.formateurMontant,
      this.t,
    ),
    data: this.ventilationPostesDataAnnee(),
  }));

  /** Clé de chargement "Postes à optimiser" (vue mois) — mêmes coordonnées que
   *  `_ventilationsMoisCle`, avec en plus le membre courant (undefined = foyer entier,
   *  quote-part 1 côté serveur — voir `MatriceBudgetaireService`). */
  private readonly _matriceBudgetaireMoisCle = computed<{ foyerId: string; scenarioId: string; annee: number; mois: number; membreId?: string } | null>(() => {
    const cle = this._ventilationsMoisCle();
    const s = this.sujet();
    return cle ? { ...cle, membreId: s.mode === 'membre' ? s.membreId : undefined } : null;
  });

  /** Matrice budgétaire scopée au mois courant (dashboard mensuel) : mêmes postes
   *  filtrés/positionnés que la variante annuelle (`postesMatriceAnnee`), mais calculés
   *  côté serveur uniquement sur le mois sélectionné (postes actifs ce mois-là, montant
   *  réel de ce seul mois — pas annualisé). */
  private readonly _matriceBudgetaireMois = creerChargementReactif(this._matriceBudgetaireMoisCle, ({ foyerId, scenarioId, annee, mois, membreId }) =>
    this.posteSvc.matriceBudgetaire(foyerId, scenarioId, annee, mois, membreId),
  );

  readonly postesMatriceMois = computed<PostePositionneDto[]>(() => this._matriceBudgetaireMois.donnees() ?? []);

  readonly matriceMoisChargement = computed(() => this._matriceBudgetaireMois.chargement());

  /** Clé de chargement "Plaisirs vs Besoins" (vue mois) — mêmes coordonnées que
   *  `_ventilationsMoisCle`, avec en plus le membre courant (undefined = foyer entier,
   *  quote-part 1 côté serveur — voir `BesoinsPlaisirsService`). */
  private readonly _besoinsPlaisirsMoisCle = computed<{ foyerId: string; scenarioId: string; annee: number; mois: number; membreId?: string } | null>(() => {
    const cle = this._ventilationsMoisCle();
    const s = this.sujet();
    return cle ? { ...cle, membreId: s.mode === 'membre' ? s.membreId : undefined } : null;
  });

  private readonly _besoinsPlaisirsMois = creerChargementReactif(this._besoinsPlaisirsMoisCle, ({ foyerId, scenarioId, annee, mois, membreId }) =>
    this.posteSvc.besoinsPlaisirs(foyerId, scenarioId, annee, mois, membreId),
  );

  /** Variante annuelle — mêmes coordonnées que `_projectionAnnuelleCle`. */
  private readonly _besoinsPlaisirsAnneeCle = computed<{ foyerId: string; scenarioId: string; annee: number; membreId?: string } | null>(() => {
    const cle = this._projectionAnnuelleCle();
    const s = this.sujet();
    return cle ? { ...cle, membreId: s.mode === 'membre' ? s.membreId : undefined } : null;
  });

  private readonly _besoinsPlaisirsAnnee = creerChargementReactif(this._besoinsPlaisirsAnneeCle, ({ foyerId, scenarioId, annee, membreId }) =>
    this.posteSvc.besoinsPlaisirs(foyerId, scenarioId, annee, undefined, membreId),
  );

  /** Payload "Plaisirs vs Besoins" (vue mois) — `revenusTotal` réutilise
   *  `agregatMoisCourant()` déjà auto-scopé foyer/membre, pas de nouvel appel. */
  private readonly besoinsPlaisirsDataMois = computed<BesoinsPlaisirsCardData>(() => ({
    montantBesoins: this._besoinsPlaisirsMois.donnees()?.montantBesoins ?? 0,
    montantPlaisirs: this._besoinsPlaisirsMois.donnees()?.montantPlaisirs ?? 0,
    revenusTotal: this.agregatMoisCourant().revenus,
    devise: this.deviseBase(),
    postesBesoins: this._besoinsPlaisirsMois.donnees()?.postesBesoins ?? [],
  }));

  private readonly besoinsPlaisirsDataAnnee = computed<BesoinsPlaisirsCardData>(() => ({
    montantBesoins: this._besoinsPlaisirsAnnee.donnees()?.montantBesoins ?? 0,
    montantPlaisirs: this._besoinsPlaisirsAnnee.donnees()?.montantPlaisirs ?? 0,
    revenusTotal: this.agregatAnneeCourant().revenus,
    devise: this.deviseBase(),
    postesBesoins: this._besoinsPlaisirsAnnee.donnees()?.postesBesoins ?? [],
  }));

  /** Indicateur "Plaisirs vs Besoins" (vue mois) — auto-scopé foyer/membre comme
   *  "Ventilations des postes", pas de duplication de carte par membre. */
  readonly besoinsPlaisirsIndicateurMois = computed(() => ({
    indicator: besoinsPlaisirsIndicator('besoins-plaisirs-mois', this.besoinsPlaisirsDataMois(), this.t, this.seuils(), this.formateurMontant),
    data: this.besoinsPlaisirsDataMois(),
  }));

  /** Variante annuelle de l'indicateur "Plaisirs vs Besoins" (vue année). */
  readonly besoinsPlaisirsIndicateurAnnee = computed(() => ({
    indicator: besoinsPlaisirsIndicator('besoins-plaisirs-annee', this.besoinsPlaisirsDataAnnee(), this.t, this.seuils(), this.formateurMontant),
    data: this.besoinsPlaisirsDataAnnee(),
  }));

  /** Payload signaux transmis au drawer "Évolution graphique" (annuel uniquement). */
  private readonly evolutionGraphiqueData = computed<EvolutionGraphiqueDrawerData>(() => ({
    mixedChartData: this.mixedChartData,
    mixedChartOptions: this.mixedChartOptions,
    tresorerieCumuleeData: this.tresorerieCumuleeData,
    tresorerieCumuleeOptions: this.tresorerieCumuleeOptions,
    prevuVsReelData: this.prevuVsReelData,
    prevuVsReelOptions: this.prevuVsReelOptions,
    labels: {
      fluxMensuel: this.t.dashboard.fluxMensuel,
      tresorerieTitle: this.t.dashboard.tresorerieTitle,
      tresoCumuleeDescription: this.t.dashboard.tresoCumuleeDescription,
      prevuVsReel: this.t.dashboard.prevuVsReel,
      prevuVsReelDescription: this.t.dashboard.prevuVsReelDescription,
    },
  }));

  /** Indicateur "Évolution graphique" (annuel uniquement — pas d'onglet Graphiques en vue
   *  mensuelle) — reprend les 3 graphiques de l'onglet "Graphiques", empilés verticalement
   *  dans le drawer au lieu du switch. La matrice budgétaire n'y figure pas (indicateur
   *  séparé "Postes à optimiser"). */
  readonly evolutionGraphiqueIndicateur = computed(() => ({
    indicator: evolutionGraphiqueIndicator(this.tresorerieCumuleeValeurs(), this.tresorerieFinAnneePrecedente(), this.formateurMontant, this.t),
    data: this.evolutionGraphiqueData(),
  }));

  /** Payload signaux transmis au drawer "Postes à optimiser" (vue année). */
  private readonly postesAOptimiserData = computed<PostesAOptimiserDrawerData>(() => ({
    postes: this.postesMatriceAnnee,
    devise: this.deviseBase,
    labels: this.matriceLabels,
    chargement: this.matriceChargement,
  }));

  /** Indicateur "Postes à optimiser" (vue année) — enveloppe la matrice budgétaire
   *  sortie de l'onglet "Graphiques" ; info = nombre de postes avec un score ≥ 35. */
  readonly postesAOptimiserIndicateur = computed(() => ({
    indicator: postesAOptimiserIndicator('postes-a-optimiser-annee', this.postesMatriceAnnee(), this.t, this.seuils()),
    data: this.postesAOptimiserData(),
  }));

  /** Payload signaux transmis au drawer "Postes à optimiser" (vue mois) — mêmes postes
   *  que la variante annuelle, mais calculés côté serveur sur le seul mois sélectionné. */
  private readonly postesAOptimiserDataMois = computed<PostesAOptimiserDrawerData>(() => ({
    postes: this.postesMatriceMois,
    devise: this.deviseBase,
    labels: this.matriceLabels,
    chargement: this.matriceMoisChargement,
  }));

  /** Indicateur "Postes à optimiser" (vue mois) — mêmes postes CHARGE/RESERVE actifs ce
   *  mois-là uniquement (montant réel du mois, pas annualisé) ; info = nombre de postes
   *  avec un score ≥ 35. */
  readonly postesAOptimiserIndicateurMois = computed(() => ({
    indicator: postesAOptimiserIndicator('postes-a-optimiser-mois', this.postesMatriceMois(), this.t, this.seuils()),
    data: this.postesAOptimiserDataMois(),
  }));

  /** Onglet "Comptes" (récap de trésorerie par compte, mois ou année) : uniquement en vue
   *  membre, scopé au membre courant côté serveur (accès + agrégation). Le fetch n'est plus
   *  gaté sur l'onglet actif (chargé dès la vue mois/année en mode membre) car l'indicateur
   *  "Virements des comptes" a besoin de la donnée résolue même onglet fermé. */
  readonly afficherOngletComptes = computed(() => this.sujet().mode === 'membre');

  /** Paires source → destination des virements de comptes (mois), filtrées côté serveur pour
   *  ne conserver que celles dont le compte destination inclut le membre courant (un membre ne
   *  voit jamais les transferts d'un autre membre vers des comptes dont il n'est pas
   *  co-titulaire). Gatée comme le récap comptes (vue membre uniquement). */
  private readonly _virementsComptesCle = computed<{ foyerId: string; scenarioId: string; annee: number; mois: number; membreId: string } | null>(() => {
    if (!this.afficherOngletComptes()) return null;
    const ventCle = this._ventilationsMoisCle();
    const s = this.sujet();
    return ventCle && s.mode === 'membre' ? { ...ventCle, membreId: s.membreId } : null;
  });

  private readonly _virementsComptes = creerChargementReactif(this._virementsComptesCle, ({ foyerId, scenarioId, annee, mois, membreId }) =>
    this.projSvc.virementsComptes(foyerId, scenarioId, annee, mois, membreId),
  );

  readonly virementsComptesDto = computed<VirementCompteDto[]>(() => this._virementsComptes.donnees() ?? []);

  readonly virementsComptesChargement = computed(() => this._virementsComptes.chargement());

  /** Variante annuelle — sommée sur les 12 mois, mêmes gates que `_comptesRecapAnnuelCle`. */
  private readonly _virementsComptesAnnuelCle = computed<{ foyerId: string; scenarioId: string; annee: number; membreId: string } | null>(() => {
    if (!this.afficherOngletComptes()) return null;
    const projCle = this._projectionAnnuelleCle();
    const s = this.sujet();
    return projCle && s.mode === 'membre' ? { ...projCle, membreId: s.membreId } : null;
  });

  private readonly _virementsComptesAnnuel = creerChargementReactif(this._virementsComptesAnnuelCle, ({ foyerId, scenarioId, annee, membreId }) =>
    this.projSvc.virementsComptesAnnuel(foyerId, scenarioId, annee, membreId),
  );

  readonly virementsComptesAnnuelDto = computed<VirementCompteDto[]>(() => this._virementsComptesAnnuel.donnees() ?? []);

  readonly virementsComptesAnnuelChargement = computed(() => this._virementsComptesAnnuel.chargement());

  readonly virementsComptesCourant = computed(() => this.vue() === 'annee' ? this.virementsComptesAnnuelDto() : this.virementsComptesDto());

  /** Statut "fait/pas fait" des virements — état purement local (non persisté), remis à zéro
   *  à chaque changement de contexte (mois/année/membre) puisque la clé n'a alors plus de
   *  sens. Clé = `compteSourceId::compteDestinationId` (voir `TableVirementsComptesComponent`). */
  private readonly _virementsComptesFaits = signal<ReadonlySet<string>>(new Set());
  readonly virementsComptesFaits = this._virementsComptesFaits.asReadonly();

  private readonly _resetVirementsComptesFaits = effect(() => {
    this.virementsComptesCourant();
    untracked(() => this._virementsComptesFaits.set(new Set()));
  });

  basculerVirementCompteFait(cle: string): void {
    const courant = new Set(this._virementsComptesFaits());
    if (courant.has(cle)) {
      courant.delete(cle);
    } else {
      courant.add(cle);
    }
    this._virementsComptesFaits.set(courant);
  }

  private mapperTauxEffortCards(dtos: TauxEffortMembreDto[] | null | undefined): TauxEffortCardData[] {
    return (dtos ?? []).map((dto) => ({
      membre: { id: dto.membreId, nom: dto.nomMembre ?? '', couleur: dto.couleurMembre },
      revenusTotal: dto.revenusTotal,
      chargesTotal: dto.chargesTotal,
      reservesTotal: dto.reservesTotal,
      chargesTotalPireCas: dto.chargesTotalPireCas,
      reservesTotalPireCas: dto.reservesTotalPireCas,
      argentPocheTotal: dto.argentPocheTotal,
      argentPocheTotalPireCas: dto.argentPocheTotalPireCas,
    }));
  }

  private filtrerCartesSelonSujet(cartes: TauxEffortCardData[]): TauxEffortCardData[] {
    const s = this.sujet();
    return s.mode === 'membre' ? cartes.filter((c) => c.membre.id === s.membreId) : cartes;
  }

  private readonly _ventilationAnnuelleCle = computed(() =>
    this.vue() === 'annee' ? this._projectionAnnuelleCle() : null
  );

  private readonly _ventilationAnnuelleChargement = creerChargementReactif(this._ventilationAnnuelleCle, ({ foyerId, scenarioId, annee }) =>
    this.projSvc.ventilationAnnuelle(foyerId, scenarioId, annee),
  );

  /** Décomposition annuelle agrégée, déjà sommée côté serveur (une seule requête HTTP
   *  au lieu d'un forkJoin de 12 appels `mensuelle`). */
  readonly ventilationAnnuelle = computed<VentilationLike | null>(() => this._ventilationAnnuelleChargement.donnees());

  /** Clé de chargement de la projection annuelle N-1, utilisée pour comparer la
   *  trésorerie de fin d'année avec l'an passé. `null` si hors vue annuelle ou si
   *  l'année précédente est antérieure au début du scénario (pas de données). */
  private readonly _projectionAnneePrecedenteCle = computed<{ foyerId: string; scenarioId: string; annee: number } | null>(() => {
    // Chargée aussi en vue "mois" quand le mois sélectionné est janvier : nécessaire
    // pour calculer `differenceTresorerieMois` (comparaison vs décembre de l'an passé).
    const enJanvier = this.vue() === 'mois' && this.moisSelectionne() === 1;
    if (this.vue() !== 'annee' && !enJanvier) return null;
    const ref = this._refCle();
    const scenario = this.contexte.scenarioCourant();
    const anneePrecedente = this.annee() - 1;
    if (!ref || !scenario || anneePrecedente < scenario.anneeDepart) return null;
    return { ...ref, annee: anneePrecedente };
  });

  private readonly _projectionAnneePrecedente = creerChargementReactif(this._projectionAnneePrecedenteCle, ({ foyerId, scenarioId, annee }) =>
    this.projSvc.annuelle(foyerId, scenarioId, annee),
  );

  private readonly _tresorerieCumuleeAnneePrecedenteCle = computed<{ foyerId: string; scenarioId: string; annee: number; membreId?: string } | null>(() => {
    if (this.vue() !== 'annee') return null;
    const cle = this._projectionAnneePrecedenteCle();
    const s = this.sujet();
    return cle ? { ...cle, membreId: s.mode === 'membre' ? s.membreId : undefined } : null;
  });

  private readonly _tresorerieCumuleeAnneePrecedente = creerChargementReactif(
    this._tresorerieCumuleeAnneePrecedenteCle,
    ({ foyerId, scenarioId, annee, membreId }) => this.projSvc.tresorerieCumulee(foyerId, scenarioId, annee, membreId),
  );

  /** Agrégats des 12 mois de l'année précédente, scopés au sujet courant — utilisé
   *  uniquement pour calculer la différence de trésorerie cumulée avec l'an passé. */
  private readonly moisAgregatsAnneePrecedente = computed<AggregatDto[]>(() => {
    const p = this._projectionAnneePrecedente.donnees();
    if (!p) return [];
    const s = this.sujet();
    return s.mode === 'membre' ? (p.moisParMembre[s.membreId] ?? []) : p.mois.map((m) => m.agregat);
  });

  readonly chargement = computed(() =>
    this._refData.chargement()
    || (this.vue() === 'annee'
      ? this._projectionAnnuelle.chargement()
        || this._ventilationAnnuelleChargement.chargement()
        || this._tresorerieCumulee.chargement()
        || this._tresorerieCumuleeAnneePrecedente.chargement()
      : this._ventilationsMois.chargement())
  );

  // ── Scoping foyer / membre ──────────────────────────────────────────────────
  // Le backend expose déjà les agrégats par membre (parMembre / moisParMembre côté
  // annuel, parMembre côté mensuel) : on ne fait ici que sélectionner la bonne entrée
  // selon le sujet courant, sans jamais recalculer de logique métier côté frontend.

  /** Agrégat du mois sélectionné, scopé au sujet courant (foyer = somme de tous les membres). */
  readonly agregatMoisCourant = computed<VentilationAggregatDto>(() => {
    const v = this.ventilations();
    if (!v) return ZERO_AGREGAT;
    const s = this.sujet();
    return s.mode === 'membre' ? (v.parMembre[s.membreId] ?? ZERO_AGREGAT) : v.agregat;
  });

  /** Agrégat annuel total, scopé au sujet courant. */
  readonly agregatAnneeCourant = computed<AggregatDto>(() => {
    const p = this.projectionAnnuelle();
    if (!p) return ZERO_AGREGAT;
    const s = this.sujet();
    return s.mode === 'membre' ? (p.parMembre[s.membreId] ?? ZERO_AGREGAT) : p.totalAnnuel;
  });

  /** Agrégats des 12 mois de l'année, scopés au sujet courant (utilisé par l'anneau,
   *  le graphique de flux et le drawer de navigation). */
  readonly moisAgregatsCourant = computed<AggregatDto[]>(() => {
    const p = this.projectionAnnuelle();
    if (!p) return [];
    const s = this.sujet();
    return s.mode === 'membre' ? (p.moisParMembre[s.membreId] ?? []) : p.mois.map((m) => m.agregat);
  });

  /** Agrégats "réels" des 12 mois de l'année, scopés au sujet courant : tout poste
   *  périodique (periodicité > 1) est imputé au montant plein sur son mois d'ancrage,
   *  quel que soit son mode — utilisé pour comparer prévu (mensualisé) vs réel
   *  (échéances) sur le graphique dédié. */
  readonly moisReelAgregatsCourant = computed<AggregatDto[]>(() => {
    const p = this.projectionAnnuelle();
    if (!p) return [];
    const s = this.sujet();
    return s.mode === 'membre' ? (p.moisParMembreReel[s.membreId] ?? []) : p.moisReel.map((m) => m.agregat);
  });

  private readonly _memorizeSelectedMonthEffect = effect(() => {
    const mois = this.moisSelectionne();
    if (mois !== undefined) {
      this.rememberedMonthIndex.set(mois - 1);
    }
  });

  private localeCourante(): string {
    return localeDeLangue(this.i18n.currentLang());
  }

  private readonly fmtCompact = (v: number) =>
    Intl.NumberFormat(this.localeCourante(), { notation: 'compact', maximumFractionDigits: 1 }).format(v);

  private formatMontant(v: number): string {
    return new Intl.NumberFormat(this.localeCourante(), {
      style: 'currency',
      currency: this.deviseBase(),
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(v);
  }

  /** `formatMontant` lié à l'instance, transmis aux fonctions `xxxIndicator(...)`. */
  private readonly formateurMontant = (v: number): string => this.formatMontant(v);

  formatPct(v: number): string {
    return this.decomp.formatPct(v);
  }

  private initiales(nom: string): string {
    return this.decomp.initiales(nom);
  }

  private sousTitrePeriode(membreId: string): string {
    return this.decomp.sousTitrePeriode(this.contexte.scenarioCourant(), membreId, this.annee(), this.moisSelectionne() ?? 1);
  }

  private compteLibelle(id: string): string {
    return this.decomp.compteLibelle(id, this.comptes());
  }

  private membresTagsCompte(compteId: string, excludeMembreId?: string): MembreTagInfo[] {
    return this.decomp.membresTagsCompte(compteId, this.comptes(), this.membres(), excludeMembreId);
  }

  private construireDecomposition(detail: {
    revenus: { id: string; libelle: string; montant: number }[];
    charges: { id: string; libelle: string; montant: number }[];
    reserves: { id: string; libelle: string; montant: number }[];
  }): LigneDecomposition[] {
    return this.decomp.construireDecomposition(detail, this.argentPocheMontantMoisSujet());
  }

  /** Montant d'une catégorie pour le sujet courant (mois sélectionné) : agrégat foyer
   *  (déjà cumulé par le backend) ou montant propre au membre (`parCategorieMembre`). */
  private categorieMontantPourSujet(categorieId: string): number {
    const v = this.ventilations();
    if (!v) return 0;
    const s = this.sujet();
    return s.mode === 'membre'
      ? (v.parCategorieMembre ?? {})[categorieId]?.[s.membreId] ?? 0
      : (v.parCategorie as Record<string, number>)?.[categorieId] ?? 0;
  }

  private categorieMontantPourSujetAnnuel(categorieId: string): number {
    const v = this.ventilationAnnuelle();
    if (!v) return 0;
    const s = this.sujet();
    return s.mode === 'membre'
      ? (v.parCategorieMembre ?? {})[categorieId]?.[s.membreId] ?? 0
      : (v.parCategorie as Record<string, number>)?.[categorieId] ?? 0;
  }

  readonly foyerInitiales = computed(() => this.initiales(this.contexte.foyerCourant()?.nom ?? this.t.projection.foyer));

  readonly foyerSousTitre = computed(() => {
    const nbMembres = this.membres().length;
    const scenarioNom = this.contexte.scenarioCourant()?.nom ?? '';
    return `${nbMembres} ${this.t.projection.membres} · ${this.t.projection.scenarioMot} ${scenarioNom}`;
  });

  readonly foyerSousTitreAnnuel = this.foyerSousTitre;

  // ── Props de la carte-bilan unique (mois), scopées au sujet courant ────────
  readonly nomCarte = computed(() => this.membreCourant()?.nom ?? this.t.projection.foyer);
  readonly varianteCarte = computed<'foyer' | 'membre'>(() => this.estModeMembre() ? 'membre' : 'foyer');
  readonly couleurCarte = computed(() => this.membreCourant()?.couleur ?? 'var(--p-secondary-color)');
  readonly initialesCarte = computed(() => {
    const membre = this.membreCourant();
    return membre ? this.initiales(membre.nom) : this.foyerInitiales();
  });
  readonly sousTitreCarte = computed(() => {
    const s = this.sujet();
    return s.mode === 'membre'
      ? this.sousTitrePeriode(s.membreId)
      : this.foyerSousTitre();
  });
  readonly prorataPctCarte = computed<number | undefined>(() => {
    const s = this.sujet();
    if (s.mode !== 'membre') return undefined;
    return this.decomp.periodeEtQuotePart(this.contexte.scenarioCourant(), s.membreId, this.annee(), this.moisSelectionne() ?? 1).quotePart;
  });

  readonly tauxEffort = computed(() => this.decomp.tauxEffort(this.agregatMoisCourant()));

  /** Montant d'argent de poche déjà déduit du RàV pour le sujet courant (membre ou
   *  foyer agrégé), pour le mois sélectionné — voir `MoteurCalcul.aggregatMembreMoisInterne`.
   *  Réutilisé par les décompositions "Résumé"/"Catégorie" (ligne dédiée, couleur or) et
   *  par `entonnoirRepartitionMois`, pour ne pas dupliquer la logique de résolution de source. */
  readonly argentPocheMontantMoisSujet = computed(() => {
    if (this.estModeMembre()) {
      const poche = this.argentPocheMoisCourant();
      return poche && poche.source !== 'AUCUNE' ? poche.montant : 0;
    }
    return this.argentPocheFoyerMoisCourant()?.total ?? 0;
  });

  /** Équivalent annuel de `argentPocheMontantMoisSujet`, pour les vues "année". */
  readonly argentPocheMontantAnneeSujet = computed(() =>
    this.estModeMembre() ? this.argentPocheTotalAnnuel() : this.argentPocheFoyerTotalAnnuel(),
  );

  readonly categoriesParType = computed(() => {
    const categories = this.categories();
    const makeList = (type: TypeCategorie) =>
      categories
        .filter((categorie) => categorie.typePoste === type)
        .map((categorie) => ({
          id: categorie.id,
          libelle: categorie.libelle,
          montant: this.categorieMontantPourSujet(categorie.id),
        }))
        .filter((row) => row.montant !== 0)
        .sort((a, b) => b.montant - a.montant);
    return {
      revenus: makeList('REVENU'),
      charges: makeList('CHARGE'),
      reserves: makeList('RESERVE'),
    };
  });

  readonly foyerDecomposition = computed(() => this.construireDecomposition(this.categoriesParType()));

  /** Décomposition « par compte » : foyer = tous comptes cumulés ; membre = uniquement
   *  les comptes où ce membre a une charge propre. */
  readonly foyerCompteDecomposition = computed<LigneDecomposition[]>(() => {
    const ventilations = this.ventilations();
    if (!ventilations) return [];
    const s = this.sujet();
    return Object.entries(ventilations.parCompteMembre ?? {})
      .map(([compteId, memMap]) => ({
        id: compteId,
        libelle: this.compteLibelle(compteId),
        montantAbs: s.mode === 'membre' ? (memMap[s.membreId] ?? 0) : Object.values(memMap).reduce((sum, montant) => sum + montant, 0),
        signe: -1 as const,
        tags: s.mode === 'membre' ? this.membresTagsCompte(compteId, s.membreId) : this.membresTagsCompte(compteId),
      }))
      .filter((compte) => compte.montantAbs !== 0)
      .sort((a, b) => b.montantAbs - a.montantAbs);
  });

  readonly foyerCascadeDecomposition = computed(() => {
    const ventilations = this.ventilations();
    if (!ventilations) return [];
    const s = this.sujet();
    const poche = this.argentPocheMontantMoisSujet();
    return s.mode === 'membre'
      ? this.decomp.construireCascadeDecomposition(s.membreId, this.agregatMoisCourant(), ventilations, this.membres().length, poche)
      : this.decomp.foyerCascadeDecomposition(ventilations, this.membres(), poche);
  });

  readonly foyerLignesActuelles = computed(() => {
    switch (this.vueDecomposition()) {
      case 'CATEGORIE': return this.foyerDecomposition();
      case 'COMPTE': return this.foyerCompteDecomposition();
      default: return this.foyerCascadeDecomposition();
    }
  });

  /** Config unique consommée par `<app-carte-bilan>` (vue mensuelle). */
  readonly carteMoisConfig = computed(() => ({
    variante: this.varianteCarte(),
    nom: this.nomCarte(),
    sousTitre: this.sousTitreCarte(),
    couleur: this.couleurCarte(),
    initiales: this.initialesCarte(),
    montantPrincipal: this.agregatMoisCourant().soldeDisponible,
    lignes: this.foyerLignesActuelles(),
    tauxEffort: this.tauxEffort(),
    prorataPct: this.prorataPctCarte(),
  }));


  readonly tauxEffortAnnuel = computed(() => this.decomp.tauxEffort(this.agregatAnneeCourant()));

  readonly foyerDecompositionAnnuel = computed<LigneDecomposition[]>(() => {
    const ventilation = this.ventilationAnnuelle();
    if (!ventilation) return [];
    const categories = this.categories();
    const makeList = (type: TypeCategorie) =>
      this.decomp.listeParCategorie(type, categories, (categorieId) => this.categorieMontantPourSujetAnnuel(categorieId));
    return this.decomp.construireDecomposition({
      revenus: makeList('REVENU'),
      charges: makeList('CHARGE'),
      reserves: makeList('RESERVE'),
    }, this.argentPocheMontantAnneeSujet());
  });

  readonly foyerCompteDecompositionAnnuel = computed<LigneDecomposition[]>(() => {
    const ventilation = this.ventilationAnnuelle();
    if (!ventilation) return [];
    const s = this.sujet();
    return Object.entries(ventilation.parCompteMembre ?? {})
      .map(([compteId, memMap]) => ({
        id: compteId,
        libelle: this.compteLibelle(compteId),
        montantAbs: s.mode === 'membre' ? (memMap[s.membreId] ?? 0) : Object.values(memMap).reduce((sum, montant) => sum + montant, 0),
        signe: -1 as const,
        tags: s.mode === 'membre'
          ? this.decomp.membresTagsCompte(compteId, this.comptes(), this.membres(), s.membreId)
          : this.decomp.membresTagsCompte(compteId, this.comptes(), this.membres()),
      }))
      .filter((compte) => compte.montantAbs !== 0)
      .sort((a, b) => b.montantAbs - a.montantAbs);
  });

  readonly foyerCascadeDecompositionAnnuel = computed(() => {
    const ventilation = this.ventilationAnnuelle();
    if (!ventilation) return [];
    const s = this.sujet();
    const poche = this.argentPocheMontantAnneeSujet();
    return s.mode === 'membre'
      ? this.decomp.construireCascadeDecomposition(s.membreId, this.agregatAnneeCourant(), ventilation, this.membres().length, poche)
      : this.decomp.foyerCascadeDecomposition(ventilation, this.membres(), poche);
  });

  readonly foyerLignesActuellesAnnuel = computed(() => {
    switch (this.vueDecomposition()) {
      case 'CATEGORIE': return this.foyerDecompositionAnnuel();
      case 'COMPTE': return this.foyerCompteDecompositionAnnuel();
      default: return this.foyerCascadeDecompositionAnnuel();
    }
  });

  readonly sousTitreCarteAnnuel = computed(() => {
    const s = this.sujet();
    return s.mode === 'membre'
      ? this.decomp.sousTitreQuotePartDefaut(this.contexte.scenarioCourant(), s.membreId)
      : this.foyerSousTitreAnnuel();
  });

  /** Config unique consommée par `<app-carte-bilan>` (vue annuelle). */
  readonly carteAnneeConfig = computed(() => ({
    variante: this.varianteCarte(),
    nom: this.nomCarte(),
    sousTitre: this.sousTitreCarteAnnuel(),
    couleur: this.couleurCarte(),
    initiales: this.initialesCarte(),
    montantPrincipal: this.agregatAnneeCourant().soldeDisponible,
    lignes: this.foyerLignesActuellesAnnuel(),
    tauxEffort: this.tauxEffortAnnuel(),
  }));

  readonly mixedChartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    // 'index' + intersect:false : le survol de n'importe quel point du mois (barre ou
    // ligne) affiche les 3 séries de ce mois ensemble, sans devoir viser précisément
    // chaque élément.
    interaction: { mode: 'index', intersect: false },
    plugins: {
      legend: { display: false },
      tooltip: {
        mode: 'index',
        intersect: false,
        callbacks: {
          label: (ctx: { dataset: { label?: string }; parsed: { y: number } }) =>
            `${ctx.dataset.label}: ${this.formatMontant(ctx.parsed.y)}`,
          // Ligne récapitulative en bas du tooltip : solde restant du mois survolé
          // (revenus - charges - réserves), pas affiché comme série séparée du graphique.
          footer: (items: { dataIndex: number }[]) => {
            const index = items[0]?.dataIndex;
            const solde = index !== undefined ? this.moisAgregatsCourant()[index]?.soldeDisponible : undefined;
            return solde !== undefined ? `${this.t.dashboard.soldeRestant}: ${this.formatMontant(solde)}` : '';
          },
        },
      },
    },
    scales: {
      x: { grid: { display: false } },
      y: {
        ticks: { callback: (v: unknown) => this.fmtCompact(Number(v)) },
        grid: { color: 'rgba(128,128,128,0.08)' },
      },
    },
    onClick: (_event: unknown, elements: { index: number }[]) => {
      const index = elements?.[0]?.index;
      if (index !== undefined) {
        this.ouvrirMoisNumero(index + 1);
      }
    },
  };

  readonly tresorerieCumuleeOptions = {
    responsive: true,
    maintainAspectRatio: false,
    // 'index' + intersect:false : le survol de n'importe quel point du mois affiche
    // la trésorerie scénarisée et réelle ensemble.
    interaction: { mode: 'index', intersect: false },
    plugins: {
      legend: { display: true, position: 'bottom' as const },
      tooltip: {
        mode: 'index',
        intersect: false,
        callbacks: {
          label: (ctx: { dataset: { label?: string }; parsed: { y: number } }) =>
            `${ctx.dataset.label}: ${this.formatMontant(ctx.parsed.y)}`,
        },
      },
    },
    scales: {
      x: { grid: { display: false } },
      y: {
        ticks: { callback: (v: unknown) => this.fmtCompact(Number(v)) },
        grid: { color: 'rgba(128,128,128,0.08)' },
      },
    },
  };

  /** Graphique de flux mensuel (revenus/charges/réserves), scopé au sujet courant. En
   *  mode membre, l'argent de poche est ajouté comme une charge supplémentaire (3e barre
   *  empilée) — elle n'est pas comptée dans les réserves côté moteur, mais réduit bien
   *  le reste à vivre (voir `entonnoirRepartitionMois` / `MoteurCalcul.aggregatMembreMoisInterne`).
   *  En mode foyer (PR6.d), même traitement avec le total agrégé de tous les membres. */
  mixedChartData = computed(() => this.buildChartData(
    this.moisAgregatsCourant(),
    this.estModeMembre()
      ? this.argentPocheMois().map((r) => r.montant ?? 0)
      : this.argentPocheFoyerMois().map((r) => r.total ?? 0),
  ));

  private buildChartData(mois: AggregatDto[], argentPocheMontants: number[]): object {
    if (!mois.length) return {};
    const colors = this.chartColors();
    const datasets: object[] = [
      {
        type: 'line',
        label: this.t.projection.revenus,
        borderColor: colors.revenu,
        backgroundColor: colors.revenu,
        data: mois.map((m) => m.revenus),
        tension: 0.3,
        fill: false,
        pointRadius: 4,
        borderWidth: 1,
      },
      {
        type: 'bar',
        label: this.t.projection.charges,
        backgroundColor: colors.charge,
        data: mois.map((m) => m.charges),
        stack: 'depenses',
      },
      {
        type: 'bar',
        label: this.t.projection.reserves,
        backgroundColor: colors.reserve,
        data: mois.map((m) => m.reserves),
        stack: 'depenses',
      },
    ];
    if (argentPocheMontants.length) {
      datasets.push({
        type: 'bar',
        label: this.t.dashboard.argentPocheMois,
        backgroundColor: colors.argentPoche,
        data: mois.map((_, i) => argentPocheMontants[i] ?? 0),
        stack: 'depenses',
      });
    }
    return { labels: this.t.moisLettre, datasets };
  }

  /**
   * Carte « Flux mensuel » de l'Aperçu (vue annuelle uniquement) : les sorties du mois
   * sont **empilées** (charges, réserves, puis argent de poche), les revenus tracés en
   * ligne pleine par-dessus, sur la même échelle partant de 0. La barre dépasse la ligne
   * exactement quand le mois est déficitaire — aucun marquage n'est ajouté, la comparaison
   * reste visuelle (voir docs/features/feature_4.md §7). Même source de données que
   * `buildChartData` (graphique du drawer « Évolution graphique »).
   */
  readonly fluxBarresLigne = computed<FluxBarresLigne>(() => {
    const mois = this.moisAgregatsCourant();
    const poche = this.estModeMembre()
      ? this.argentPocheMois().map((r) => r.montant ?? 0)
      : this.argentPocheFoyerMois().map((r) => r.total ?? 0);
    const avecPoche = poche.some((montant) => montant !== 0);

    const revenus = mois.map((m) => m.revenus);
    const charges = mois.map((m) => m.charges);
    const reserves = mois.map((m) => m.reserves);
    const argentPoche = mois.map((_, i) => poche[i] ?? 0);
    const sorties = mois.map((_, i) => charges[i] + reserves[i] + (avecPoche ? argentPoche[i] : 0));

    const segments: SegmentBarresLigne[] = [
      { cle: 'charges', libelle: this.t.projection.charges, valeurs: charges, ton: 'charge' },
      { cle: 'reserves', libelle: this.t.projection.reserves, valeurs: reserves, ton: 'reserve' },
    ];
    if (avecPoche) {
      segments.push({
        cle: 'argent-poche',
        libelle: this.t.dashboard.argentPocheMois,
        valeurs: argentPoche,
        ton: 'argent-poche',
      });
    }

    return {
      segments,
      ligne: { libelle: this.t.projection.revenus, valeurs: revenus, ton: 'revenu' },
      libelles: this.t.moisLettre,
      libellesComplets: this.t.mois,
      formateurValeur: this.fmtCompact,
      formateurInfobulle: (index: number) => {
        const lignes = [
          this.t.mois[index] ?? String(index + 1),
          `${this.t.projection.revenus}: ${this.formatMontant(revenus[index] ?? 0)}`,
          `${this.t.projection.charges}: ${this.formatMontant(charges[index] ?? 0)}`,
          `${this.t.projection.reserves}: ${this.formatMontant(reserves[index] ?? 0)}`,
        ];
        if (avecPoche) {
          lignes.push(`${this.t.dashboard.argentPocheMois}: ${this.formatMontant(argentPoche[index] ?? 0)}`);
        }
        lignes.push(`${this.t.dashboard.soldeRestant}: ${this.formatMontant((revenus[index] ?? 0) - (sorties[index] ?? 0))}`);
        return lignes.join(' · ');
      },
    };
  });

  readonly ringSegmentsAnnee = computed<MetricRingSegment[]>(() => {
    const mois = this.moisAgregatsCourant();
    const positifs = mois.filter((item) => item.soldeDisponible >= 0).length;
    const negatifs = Math.max(mois.length - positifs, 0);
    const colors = this.chartColors();
    return [
      { value: positifs, color: colors.positif },
      { value: negatifs, color: colors.negatif },
    ];
  });

  readonly ringCenterAnnee = computed(() => {
    const mois = this.moisAgregatsCourant();
    const positifs = mois.filter((item) => item.soldeDisponible >= 0).length;
    const negatifs = Math.max(mois.length - positifs, 0);
    return `${positifs}-${negatifs}`;
  });

  /** Liste des mois de l'année dont le solde disponible est négatif. */
  readonly moisARisqueListe = computed<MoisARisqueItem[]>(() =>
    this.moisAgregatsCourant()
      .map((item, index) => ({ label: this.t.mois[index] ?? String(index + 1), soldeDisponible: item.soldeDisponible }))
      .filter((item) => item.soldeDisponible < 0),
  );

  /** Solde disponible et revenus de chaque mois de l'année (sujet courant) — heatmap
   *  "Mois à risque". */
  private readonly soldesMoisCourant = computed<SoldeMois[]>(() =>
    this.moisAgregatsCourant().map((item, index) => ({
      label: this.t.mois[index] ?? String(index + 1),
      soldeDisponible: item.soldeDisponible,
      revenus: item.revenus,
    })),
  );

  /** Payload signaux transmis au drawer "Mois à risque". */
  private readonly moisARisqueData = computed<MoisARisqueDrawerData>(() => ({
    ringSegments: this.ringSegmentsAnnee,
    ringCenterValue: this.ringCenterAnnee,
    ringCenterLabel: this.t.dashboard.moisPosVsNeg,
    moisARisque: this.moisARisqueListe,
    devise: this.deviseBase,
  }));

  /** Indicateur "Mois à risque" (vue année uniquement) — reprend l'anneau "mois positifs
   *  vs négatifs" (compact, projeté en `[card-info]` par le template) et le compteur de
   *  mois à solde négatif, auparavant portés par le `app-metric-ring`/`app-stat-grid`
   *  du haut de la vue annuelle. */
  readonly moisARisqueIndicateurAnnee = computed(() => ({
    indicator: moisARisqueIndicator(this.soldesMoisCourant(), this.formateurMontant, this.t),
    data: this.moisARisqueData(),
  }));


  /** Textes traduits transmis au composant partagé `app-matrice-budgetaire` (voir
   *  `MatriceBudgetaireLabels`) — le composant partagé ne connaît aucune clé i18n. */
  readonly matriceLabels = computed<MatriceBudgetaireLabels>(() => ({
    aucunPoste: this.t.dashboard.matriceAucunPoste,
    colonneRang: this.t.dashboard.matriceColonneRang,
    colonneNom: this.t.dashboard.matriceColonneNom,
    colonneMontant: this.t.dashboard.matriceColonneMontant,
    colonneScore: this.t.dashboard.matriceColonneScore,
    badgeNecessite: this.t.dashboard.matriceBadgeNecessite,
    badgeOptimisable: this.t.dashboard.matriceBadgeOptimisable,
    scoreTooltip: this.t.dashboard.matriceScoreTooltip
  }));

  /** Étapes de la carte « Répartition » (vue Aperçu) : chaque ligne affiche son propre
   *  montant et sa part des revenus de la période — **aucune soustraction en cascade**.
   *  L'argent de poche est déjà déduit du reste à vivre côté moteur (`soldeDisponible`),
   *  sans être compté dans les réserves — voir `MoteurCalcul.aggregatMembreMoisInterne` :
   *  il n'apparaît donc ici qu'à titre informatif. */
  private etapesRepartition(
    agregat: { revenus: number; charges: number; reserves: number; soldeDisponible: number },
    argentDePoche: number,
  ): EtapeEntonnoir[] {
    const revenus = agregat.revenus;
    const etape = (libelle: string, montant: number, ton: TonIndicateur): EtapeEntonnoir => {
      const part = revenus > 0 ? montant / revenus : 0;
      return {
        libelle,
        valeurAffichee: this.formatMontant(montant),
        valeurSecondaire: revenus > 0 ? this.formatPart(part) : '',
        largeurPourcent: part * 100,
        ton,
      };
    };

    return [
      etape(this.t.projection.revenus, revenus, 'revenu'),
      etape(this.t.dashboard.chargesSures, agregat.charges, 'charge'),
      etape(this.t.dashboard.reserves, agregat.reserves, 'reserve'),
      ...(argentDePoche > 0
        ? [etape(this.t.dashboard.argentPocheMois, argentDePoche, 'argent-poche')]
        : []),
      etape(this.t.dashboard.resteAVivre, Math.max(agregat.soldeDisponible, 0), 'neutre'),
    ];
  }

  private formatPart(part: number): string {
    return Intl.NumberFormat(this.localeCourante(), {
      style: 'percent',
      maximumFractionDigits: 0,
    }).format(part);
  }

  readonly entonnoirRepartitionMois = computed<EtapeEntonnoir[]>(() =>
    this.etapesRepartition(this.agregatMoisCourant(), this.argentPocheMontantMoisSujet()),
  );

  readonly entonnoirRepartitionAnnee = computed<EtapeEntonnoir[]>(() =>
    this.etapesRepartition(this.agregatAnneeCourant(), this.argentPocheMontantAnneeSujet()),
  );


  readonly tresorerieCumuleeValeurs = computed(() => this.serieTresorerie(this._tresorerieCumulee.donnees()?.mensualise));
  readonly tresorerieCumuleeReelValeurs = computed(() => this.serieTresorerie(this._tresorerieCumulee.donnees()?.reel));

  readonly tresorerieCumuleeData = computed(() => {
    const valeurs = this.tresorerieCumuleeValeurs();
    if (!valeurs.length) return {};
    const valeursReel = this.tresorerieCumuleeReelValeurs();
    return {
      labels: this.t.mois,
      datasets: [
        {
          type: 'line',
          label: this.t.dashboard.tresorerieCumuleeReel,
          borderColor: '#EF5350',
          backgroundColor: '#EF5350',
          data: valeursReel,
          tension: 0.25,
          fill: false,
          pointRadius: 3,
          borderWidth: 1,
          borderDash: [6, 4],
        },
        {
          type: 'line',
          label: this.t.dashboard.tresorerieCumulee,
          borderColor: '#42A5F5',
          backgroundColor: 'rgb(66 165 245 / 0.39)',
          data: valeurs,
          tension: 0.25,
          fill: true,
          pointRadius: 3,
          borderWidth: 1,
        },
      ],
    };
  });

  /** Graphique comparant, mois par mois, les charges + réserves prévues (mensualisées,
   *  lissées début-fin) vs réelles (échéances : montant plein imputé au mois d'ancrage
   *  pour les postes périodiques). Permet de visualiser quand tombent réellement les
   *  décaissements par rapport à leur étalement comptable. */
  readonly prevuVsReelData = computed(() => {
    const prevu = this.moisAgregatsCourant();
    const reel = this.moisReelAgregatsCourant();
    if (!prevu.length || !reel.length) return {};
    return {
      labels: this.t.mois,
      datasets: [
        {
          type: 'line',
          label: this.t.dashboard.previsuMensualise,
          borderColor: '#42A5F5',
          backgroundColor: '#42A5F5',
          data: prevu.map((m) => m.charges + m.reserves),
          tension: 0.25,
          fill: false,
          pointRadius: 3,
          borderWidth: 1,
        },
        {
          type: 'line',
          label: this.t.dashboard.reelEcheances,
          borderColor: '#EF5350',
          backgroundColor: '#EF5350',
          data: reel.map((m) => m.charges + m.reserves),
          tension: 0.25,
          fill: false,
          pointRadius: 3,
          borderWidth: 1,
          borderDash: [6, 4],
        },
      ],
    };
  });

  readonly prevuVsReelOptions = {
    responsive: true,
    maintainAspectRatio: false,
    // 'index' + intersect:false : le survol de n'importe quel point du mois affiche
    // le prévu et le réel ensemble, comme sur le graphique du flux mensuel.
    interaction: { mode: 'index', intersect: false },
    plugins: {
      legend: { display: true, position: 'bottom' as const },
      tooltip: {
        mode: 'index',
        intersect: false,
        callbacks: {
          label: (ctx: { dataset: { label?: string }; parsed: { y: number } }) =>
            `${ctx.dataset.label}: ${this.formatMontant(ctx.parsed.y)}`,
          // Ligne récapitulative en bas du tooltip : différentiel prévu - réel du mois survolé.
          footer: (items: { dataIndex: number }[]) => {
            const index = items[0]?.dataIndex;
            const prevu = this.moisAgregatsCourant()[index]?.charges;
            const reserves = this.moisAgregatsCourant()[index]?.reserves;
            const reel = this.moisReelAgregatsCourant()[index];
            if (index === undefined || prevu === undefined || reserves === undefined || !reel) return '';
            const diff = (prevu + reserves) - (reel.charges + reel.reserves);
            return `${this.t.dashboard.differentielPrevuReel}: ${this.formatMontant(diff)}`;
          },
        },
      },
    },
    scales: {
      x: { grid: { display: false } },
      y: {
        ticks: { callback: (v: unknown) => this.fmtCompact(Number(v)) },
        grid: { color: 'rgba(128,128,128,0.08)' },
      },
    },
  };

  /** Trésorerie cumulée en fin d'année précédente (N-1), ou `null` si non disponible
   *  (première année du scénario, ou données pas encore chargées). */
  readonly tresorerieFinAnneePrecedente = computed<number | null>(() => {
    const valeurs = this.serieTresorerie(this._tresorerieCumuleeAnneePrecedente.donnees()?.mensualise);
    return valeurs.length ? valeurs[valeurs.length - 1] : null;
  });

  /** Valeurs des 5 grandeurs comparées entre la période courante et la période de
   *  référence (mois précédent en vue mois — décembre de l'an passé si janvier ; année
   *  précédente en vue année). `precedent` vaut `null` quand la référence n'existe pas
   *  (première année du scénario, ou données pas encore chargées). */
  private grandeursComparees(): { cle: string; titre: string; ton: TonCarte; courant: number; precedent: number | null; inverserDelta: boolean }[] {
    const parMois = this.vue() === 'mois';
    const mois = this.moisSelectionne();
    const enJanvier = parMois && mois === 1;
    const agregatsPrecedents = this.moisAgregatsAnneePrecedente();

    const agregatCourant = parMois ? this.agregatMoisCourant() : this.agregatAnneeCourant();
    const agregatPrecedent = parMois
      ? (enJanvier ? agregatsPrecedents[agregatsPrecedents.length - 1] : this.moisAgregatsCourant()[(mois ?? 1) - 2])
      : undefined;
    const sommePrecedente = (champ: 'revenus' | 'charges' | 'reserves' | 'soldeDisponible') =>
      agregatsPrecedents.reduce((somme, m) => somme + m[champ], 0);

    const champ = (nom: 'revenus' | 'charges' | 'reserves' | 'soldeDisponible'): number | null => {
      if (parMois) return agregatPrecedent ? agregatPrecedent[nom] : null;
      return agregatsPrecedents.length ? sommePrecedente(nom) : null;
    };

    return [
      { cle: 'revenus', titre: this.t.projection.revenus, ton: 'revenu', courant: agregatCourant.revenus, precedent: champ('revenus'), inverserDelta: false },
      { cle: 'charges', titre: this.t.dashboard.chargesSures, ton: 'charge', courant: agregatCourant.charges, precedent: champ('charges'), inverserDelta: true },
      { cle: 'reserves', titre: this.t.dashboard.reserves, ton: 'reserve', courant: agregatCourant.reserves, precedent: champ('reserves'), inverserDelta: false },
      {
        cle: 'argent-poche',
        titre: this.t.dashboard.argentPocheMois,
        ton: 'argent-poche',
        courant: parMois ? this.argentPocheMontantMoisSujet() : this.argentPocheMontantAnneeSujet(),
        precedent: this.argentPochePrecedentSujet(),
        inverserDelta: false,
      },
      { cle: 'solde', titre: this.t.dashboard.resteAVivre, ton: 'neutre', courant: agregatCourant.soldeDisponible, precedent: champ('soldeDisponible'), inverserDelta: false },
    ];
  }

  /** Argent de poche de la période de référence, selon le sujet (membre ou foyer agrégé).
   *  `null` quand l'historique n'est pas disponible. */
  private argentPochePrecedentSujet(): number | null {
    const membre = this.estModeMembre();
    const moisPrecedents = membre ? this.argentPocheMoisAnneePrecedente() : this.argentPocheFoyerMoisAnneePrecedente();
    const montant = (r: { montant?: number; total?: number } | undefined): number | null =>
      r ? (membre ? (r.montant ?? 0) : (r.total ?? 0)) : null;

    if (this.vue() !== 'mois') {
      if (!moisPrecedents.length) return null;
      return membre ? this.argentPocheTotalAnneePrecedente() : this.argentPocheFoyerTotalAnneePrecedente();
    }

    const mois = this.moisSelectionne();
    if (mois === undefined) return null;
    if (mois === 1) return moisPrecedents.length ? montant(moisPrecedents[moisPrecedents.length - 1]) : null;
    return montant((membre ? this.argentPocheMois() : this.argentPocheFoyerMois())[mois - 2]);
  }

  /** Libellés des deux colonnes de la carte de comparaison (période courante / référence). */
  private libellesComparaison(): { actuel: string; precedent: string } {
    const annee = this.annee();
    const mois = this.moisSelectionne();
    if (this.vue() !== 'mois' || mois === undefined) {
      return { actuel: `${annee}`, precedent: `${annee - 1}` };
    }
    const nomMois = (index: number) =>
      new Intl.DateTimeFormat(this.localeCourante(), { month: 'long' }).format(new Date(2000, index, 1));
    return {
      actuel: `${nomMois(mois - 1)} ${annee}`,
      precedent: mois === 1 ? `${nomMois(11)} ${annee - 1}` : `${nomMois(mois - 2)} ${annee}`,
    };
  }

  /** Montant en devise du foyer, arrondi à l'unité : la carte de comparaison aligne cinq
   *  montants et les centimes y nuiraient à la lisibilité. L'espace insécable qui précède
   *  la devise est normalisé en espace simple. */
  private formatMontantArrondi(valeur: number): string {
    return new Intl.NumberFormat(this.localeCourante(), {
      style: 'currency',
      currency: this.deviseBase(),
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(valeur).replace(/\u00A0/g, ' ');
  }

  /** Carte « comparaison de période » de la vue Aperçu : une ligne par grandeur (revenus,
   *  charges, réserves, argent de poche, solde restant) confrontée à la période précédente. */
  readonly comparaisonPeriode = computed<ComparaisonPeriode>(() => {
    const libelles = this.libellesComparaison();
    return {
      libellePrecedent: libelles.precedent,
      libelleActuel: libelles.actuel,
      elements: this.grandeursComparees().map((g) => ({
        cle: g.cle,
        libelle: g.titre,
        ton: g.ton,
        valeurActuelle: this.formatMontantArrondi(g.courant),
        valeurPrecedente: g.precedent === null ? '—' : this.formatMontantArrondi(g.precedent),
        // Une référence nulle rendrait la variation infinie : on masque le badge.
        delta: g.precedent === null || g.precedent === 0 ? null : (g.courant - g.precedent) / Math.abs(g.precedent),
        inverserDelta: g.inverserDelta,
      })),
    };
  });

  /** Icône + variante de couleur PrimeNG représentative d'un type d'événement. */
  private iconEvenement(evt: EvenementDto): { icon: string; variant: 'success' | 'danger' | 'secondary' } {
    switch (evt.type) {
      case 'DEBUT': return { icon: 'calendar-plus', variant: 'success' };
      case 'FIN': return { icon: 'calendar-minus', variant: 'danger' };
      case 'REVISION': return { icon: 'calendar-clock', variant: 'secondary' };
    }
  }

  /** Formate un montant signé en devise du foyer, sans décimales (cohérent avec la timeline). */
  private formatMontantEntier(valeur: number): string {
    return new Intl.NumberFormat('fr-CH', { minimumFractionDigits: 0, maximumFractionDigits: 0 })
      .format(Math.abs(valeur));
  }

  /** Construit "1200 CHF/mois" à partir d'un montant brut déjà orienté et d'un suffixe. */
  private formatMontantAvecSuffixe(montantBrut: number, suffixe: string): string {
    return `${this.formatMontantEntier(montantBrut)} ${this.deviseBase()}${suffixe}`;
  }

  /**
   * Calcule le montant affiché (brut, lissé si MENSUALISE), son suffixe de périodicité et
   * un éventuel texte secondaire (montant plein + périodicité réelle), à partir d'un montant
   * signé selon la convention du moteur (+ REVENU, − CHARGE/RESERVE).
   */
  private formatterMontantPoste(montantSigne: number, periodiciteMois: number,
                                 mode: ModeComptabilisation, typePoste: TypePoste):
      { montantBrut: number; montantPlein: number; suffixe: string; secondaire?: string } {
    const signeTypePoste = typePoste === 'REVENU' ? 1 : -1;
    const brutPlein = montantSigne * signeTypePoste;

    if (periodiciteMois === 0) {
      return { montantBrut: brutPlein, montantPlein: brutPlein, suffixe: this.t.dashboard.parPonctuel };
    }
    if (mode === 'MENSUALISE') {
      const montantBrut = brutPlein / periodiciteMois;
      const secondaire = periodiciteMois > 1
        ? this.i18n.instant('dashboard.montantSecondaireModele', {
            montant: `${this.formatMontantEntier(brutPlein)} ${this.deviseBase()}`,
            periodicite: periodiciteMois,
          })
        : undefined;
      return { montantBrut, montantPlein: brutPlein, suffixe: this.t.dashboard.parMois, secondaire };
    }
    // PERIODIQUE : montant plein affiché tel quel
    const suffixe = periodiciteMois === 1
      ? this.t.dashboard.parMois
      : this.i18n.instant('dashboard.parPeriodicite', { n: periodiciteMois });
    return { montantBrut: brutPlein, montantPlein: brutPlein, suffixe };
  }

  readonly evenementsAnnee = computed<DashboardTimelineItem[]>(() =>
    // Le backend a déjà filtré (quote-part > 0) et proratisé montant/montantOrigine
    // selon le membre demandé (voir EvenementDto.quotePart) — aucun recalcul ici.
    this.evenementsDto()
      .map((evt) => {
        const { icon, variant } = this.iconEvenement(evt);
        // evt.montant est l'impact budgétaire signé (+ = gain de trésorerie, − = perte),
        // toujours favorable si positif quel que soit le type de poste.
        const favorable = evt.montant > 0;
        const q = evt.quotePart ?? 1;
        const labelQuotePart = q < 1 ? this.i18n.instant('dashboard.partProratisee', { pct: this.formatPct(q * 100) }) : undefined;

        if (evt.type === 'REVISION' && evt.montantOrigine !== undefined) {
          // Affichage "avant → après" : plus de delta affiché, chaque côté formaté selon
          // son propre mode/périodicité (le poste peut, en théorie, changer de périodicité
          // lors d'une révision).
          const avant = this.formatterMontantPoste(
            evt.montantOrigine, evt.periodiciteMoisOrigine ?? evt.periodiciteMois,
            evt.modeOrigine ?? evt.mode, evt.typePoste);
          const apres = this.formatterMontantPoste(
            evt.montantOrigine + evt.montant, evt.periodiciteMois, evt.mode, evt.typePoste);

          let montantSecondaire: string | undefined;
          if (avant.secondaire && apres.secondaire) {
            montantSecondaire = evt.periodiciteMoisOrigine === evt.periodiciteMois
              ? this.i18n.instant('dashboard.montantSecondaireRevisionModele', {
                  montantAvant: `${this.formatMontantEntier(avant.montantPlein)} ${this.deviseBase()}`,
                  montantApres: `${this.formatMontantEntier(apres.montantPlein)} ${this.deviseBase()}`,
                  periodicite: evt.periodiciteMois,
                })
              : `${avant.secondaire} → ${apres.secondaire}`;
          } else {
            montantSecondaire = apres.secondaire ?? avant.secondaire;
          }
          if (labelQuotePart) {
            montantSecondaire = montantSecondaire ? `${montantSecondaire} · ${labelQuotePart}` : labelQuotePart;
          }

          return {
            when: this.t.mois[evt.mois - 1],
            icon,
            iconVariant: variant,
            title: evt.description,
            favorable,
            montantAvantLabel: this.formatMontantAvecSuffixe(avant.montantBrut, avant.suffixe),
            montantApresLabel: this.formatMontantAvecSuffixe(apres.montantBrut, apres.suffixe),
            montantSecondaire,
            mois: evt.mois,
          };
        }

        const { montantBrut, suffixe, secondaire } = this.formatterMontantPoste(
          evt.montant, evt.periodiciteMois, evt.mode, evt.typePoste);
        const montantSecondaire = labelQuotePart
          ? (secondaire ? `${secondaire} · ${labelQuotePart}` : labelQuotePart)
          : secondaire;

        return {
          when: this.t.mois[evt.mois - 1],
          icon,
          iconVariant: variant,
          title: evt.description,
          impact: montantBrut,
          favorable,
          suffixe,
          montantSecondaire,
          mois: evt.mois,
        };
      })
      .sort((a, b) => a.mois - b.mois || a.title.localeCompare(b.title))
  );

  readonly evenementsMois = computed(() => {
    const mois = this.moisSelectionne();
    return mois === undefined ? [] : this.evenementsAnnee().filter((item) => item.mois === mois);
  });


  ouvrirMoisNumero(mois: number): void {
    this.naviguerVersMois(this.annee(), mois);
  }

  ouvrirMoisDepuisTimeline(item: TimelineItem): void {
    const mois = (item as DashboardTimelineItem).mois;
    if (mois) {
      this.ouvrirMoisNumero(mois);
    }
  }

  private buildDashboardSegments(sujetId: string, annee: number, mois?: number): string[] {
    const foyerId = this.contexte.foyerId();
    if (!foyerId) return [];
    const segments = ['/f', foyerId, 'dashboard', sujetId, String(annee)];
    if (mois !== undefined) {
      segments.push(String(mois).padStart(2, '0'));
    }
    segments.push(this.currentViewKey());
    return segments;
  }

  private naviguerVersAnnee(annee: number): void {
    const segments = this.buildDashboardSegments(this.sujetId(), annee);
    if (!segments.length) return;
    void this.router.navigate(segments, { queryParamsHandling: 'preserve' });
  }

  private naviguerVersMois(annee: number, mois: number): void {
    const segments = this.buildDashboardSegments(this.sujetId(), annee, mois);
    if (!segments.length) return;
    void this.router.navigate(segments, { queryParamsHandling: 'preserve' });
  }

  /** Navigue vers un autre sujet (foyer ou membre) en conservant année/mois courants. */
  private naviguerVersSujet(sujetId: string): void {
    const mois = this.moisSelectionne();
    const segments = this.buildDashboardSegments(sujetId, this.annee(), mois);
    if (!segments.length) return;
    void this.router.navigate(segments, { queryParamsHandling: 'preserve' });
  }

  setRouteParams(params: { annee: number; mois?: number; sujetId: string }): void {
    this.annee.set(params.annee);
    this.mois.set(params.mois);
    this.sujetId.set(params.sujetId);
  }

  setCurrentViewKey(viewKey: DashboardViewKey): void {
    this.currentViewKey.set(viewKey);
  }

  onPeriodChange(value: PeriodValue): void {
    this.rememberedMonthIndex.set(value.monthIndex);
    if (value.mode === 'annee') {
      this.naviguerVersAnnee(value.year);
      return;
    }
    this.naviguerVersMois(value.year, value.monthIndex + 1);
  }

  /** Pastilles de santé du sélecteur de période : verte quand le solde restant atteint au
   *  moins 5 % du revenu du mois, jaune entre 0 % et 5 %, rouge quand il est négatif. */
  readonly monthsHealth = computed<MonthHealth[]>(() => {
    const agregats = this.moisAgregatsCourant();
    return Array.from({ length: 12 }, (_, monthIndex) => {
      const agregat = agregats[monthIndex] ?? ZERO_AGREGAT;
      return {
        monthIndex,
        amount: agregat.soldeDisponible,
        level: niveauSanteMois(agregat.soldeDisponible, agregat.revenus),
      };
    });
  });

  /** Pastille de santé de la vignette « Année » : même règle que les mois, appliquée au
   *  solde et aux revenus cumulés de l'année. */
  readonly yearHealth = computed<PeriodHealth>(() => {
    const agregat = this.agregatAnneeCourant();
    return {
      amount: agregat.soldeDisponible,
      level: niveauSanteMois(agregat.soldeDisponible, agregat.revenus),
    };
  });

  readonly apercuIndicators = computed<IndicatorItem[]>(() => {
    const items: IndicatorItem[] = [
      this.evenementsIndicateur(),
      this.besoinsPlaisirsIndicateur(),
    ];

    if (this.vue() === 'annee') {
      return [this.moisARisqueIndicateurAnnee(), ...items];
    }

    return items;
  });

  readonly comptesIndicators = computed<IndicatorItem[]>(() => {
    const virements = this.virementsComptesIndicateurCourant();
    const items: IndicatorItem[] = [];
    if (virements) {
      items.push(virements);
    }
    if (this.vue() === 'annee') {
      items.push(this.evolutionGraphiqueIndicateur());
    }
    return items;
  });

  readonly postesIndicators = computed<IndicatorItem[]>(() => [
    this.ventilationPostesIndicateur(),
    this.postesAOptimiserIndicateurCourant(),
  ]);

  readonly membresIndicators = computed<IndicatorItem[]>(() => {
    const prorata = this.prorataPartageIndicateur();
    return [
      ...this.tauxEffortIndicateursCourant(),
      ...(prorata ? [prorata] : []),
    ];
  });




  readonly evenementsIndicateur = computed(() => this.vue() === 'annee' ? this.evenementsIndicateurAnnee() : this.evenementsIndicateurMois());
  readonly besoinsPlaisirsIndicateur = computed(() => this.vue() === 'annee' ? this.besoinsPlaisirsIndicateurAnnee() : this.besoinsPlaisirsIndicateurMois());
  readonly virementsComptesIndicateurCourant = computed(() => this.vue() === 'annee' ? this.virementsComptesIndicateurAnnee() : this.virementsComptesIndicateur());
  readonly ventilationPostesIndicateur = computed(() => this.vue() === 'annee' ? this.ventilationPostesIndicateurAnnee() : this.ventilationPostesIndicateurMois());
  readonly postesAOptimiserIndicateurCourant = computed(() => this.vue() === 'annee' ? this.postesAOptimiserIndicateur() : this.postesAOptimiserIndicateurMois());
  readonly tauxEffortIndicateursCourant = computed(() => this.vue() === 'annee' ? this.tauxEffortIndicateursAnnee() : this.tauxEffortIndicateursMois());
  readonly prorataPartageIndicateur = computed(() => this.vue() === 'annee' ? this.prorataPartageIndicateurAnnee() : this.prorataPartageIndicateurMois());

  dashboardViewLabel(viewKey: DashboardViewKey): string {
    return this.t.dashboard.views[viewKey];
  }

  private serieTresorerie(valeurs?: TresorerieCumuleeDto['mensualise']): number[] {
    return (valeurs ?? []).map((valeur) => typeof valeur === 'string' ? Number(valeur) : valeur);
  }
}
