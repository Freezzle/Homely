import { CommonModule } from '@angular/common';
import { Component, computed, effect, inject, input, numberAttribute, signal, untracked } from '@angular/core';
import { Router } from '@angular/router';
import { forkJoin } from 'rxjs';
import { ButtonModule } from 'primeng/button';
import { CardModule } from 'primeng/card';
import { SkeletonModule } from 'primeng/skeleton';
import { TagModule } from 'primeng/tag';
import { ContexteService } from '../../core/services/contexte.service';
import { ProjectionService } from '../../core/services/projection.service';
import { CategorieService, CompteService } from '../../core/services/referentiel.service';
import { ObjectifService, PosteService } from '../../core/services/scenario-poste.service';
import { DecompositionService, VentilationLike } from '../../core/services/decomposition.service';
import {
  AggregatDto,
  CategorieDto,
  CompteDto,
  CompteRecapMensuelDto,
  EvenementDto,
  MembreDto,
  ModeComptabilisation,
  ObjectifDto,
  PosteDto,
  PostePositionneDto,
  ProjectionAnnuelleDto,
  ScenarioDto,
  TauxEffortMembreDto,
  TypeCategorie,
  TypePoste,
  VentilationAggregatDto,
} from '../../core/models/api.models';
import { I18nService } from '../../core/i18n/i18n.service';
import { localeDeLangue } from '../../core/i18n/locale.util';
import { ViewportService } from '../../core/services/viewport.service';
import { creerChargementReactif } from '../../core/utils/reference-data.util';
import { parseIsoDateLocal } from '../../core/utils/date.util';
import { LigneDecomposition, MembreTagInfo } from '../../shared/components/carte-bilan/carte-bilan.component';
import { TauxEffortCardComponent, TauxEffortCardData } from '../../shared/components/taux-effort-card/taux-effort-card.component';
import { KpiChipRowComponent } from '../../shared/components/kpi-chip-row/kpi-chip-row.component';
import { KpiChip } from '../../shared/components/kpi-chip/kpi-chip.component';
import { MetricRingComponent, MetricRingSegment } from '../../shared/components/metric-ring/metric-ring.component';
import { MetricBarComponent, MetricBarSegment } from '../../shared/components/metric-bar/metric-bar.component';
import { ObjectiveProgressComponent, ObjectiveProgressSeverity } from '../../shared/components/objective-progress/objective-progress.component';
import { PageNavComponent, PageNavMonthSummary, PageNavSelection } from '../../shared/components/page-nav/page-nav.component';
import { StatGridComponent, StatGridStatusTag, StatItem } from '../../shared/components/stat-grid/stat-grid.component';
import { TabGroupComponent } from '../../shared/components/tab-group/tab-group.component';
import { TabPanelComponent } from '../../shared/components/tab-group/tab-panel.component';
import { TimelineItem } from '../../shared/components/timeline/timeline.component';
import { MatriceBudgetaireLabels } from '../../shared/components/matrice-budgetaire/matrice-budgetaire.component';
import { DashboardSectionComponent } from './shared/components/dashboard-section/dashboard-section.component';
import { IndicatorCardComponent } from './shared/components/indicator-card/indicator-card.component';
import { IndicatorDrawerComponent } from './shared/components/indicator-drawer/indicator-drawer.component';
import { IndicatorDrawerService } from './shared/services/indicator-drawer.service';
import { Indicator } from './shared/models/indicator.model';
import { tauxEffortMembreIndicator } from './indicators/taux-effort-membre/taux-effort-membre.indicator';
import { ventilationPostesIndicator } from './indicators/ventilation-postes/ventilation-postes.indicator';
import { VentilationPostesDrawerData } from './indicators/ventilation-postes/ventilation-postes-drawer-content.component';
import { evolutionGraphiqueIndicator } from './indicators/evolution-graphique/evolution-graphique.indicator';
import { EvolutionGraphiqueDrawerData } from './indicators/evolution-graphique/evolution-graphique-drawer-content.component';
import { postesAOptimiserIndicator } from './indicators/postes-a-optimiser/postes-a-optimiser.indicator';
import { PostesAOptimiserDrawerData } from './indicators/postes-a-optimiser/postes-a-optimiser-drawer-content.component';
import { evenementsIndicator } from './indicators/evenements/evenements.indicator';
import { EvenementsDrawerData } from './indicators/evenements/evenements-drawer-content.component';
import { virementsComptesIndicator } from './indicators/virements-comptes/virements-comptes.indicator';
import { VirementsComptesDrawerData } from './indicators/virements-comptes/virements-comptes-drawer-content.component';

type StatutObjectif = 'DANS_LES_TEMPS' | 'EN_RETARD' | 'ATTEINT';
type DashboardTimelineItem = TimelineItem & { mois: number };
/** Sujet du tableau de bord affiché : le foyer entier (cumul de tous les membres) ou un
 *  membre spécifique (données propres uniquement). Piloté par le segment `:sujetId`
 *  de la route (`'foyer'` ou l'id du membre). */
type SujetDashboard = { mode: 'foyer' } | { mode: 'membre'; membreId: string; membre: MembreDto };
const ZERO_AGREGAT: { revenus: number; charges: number; reserves: number; soldeDisponible: number } =
  { revenus: 0, charges: 0, reserves: 0, soldeDisponible: 0 };

@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [
    CommonModule,
    ButtonModule,
    CardModule,
    SkeletonModule,
    TagModule,
    TauxEffortCardComponent,
    KpiChipRowComponent,

    MetricRingComponent,
    MetricBarComponent,
    ObjectiveProgressComponent,
    PageNavComponent,
    StatGridComponent,
    TabGroupComponent,
    TabPanelComponent,
    DashboardSectionComponent,
    IndicatorCardComponent,
    IndicatorDrawerComponent,
  ],
  templateUrl: './dashboard.component.html',
})
export class DashboardComponent {
  private readonly i18n = inject(I18nService);
  private readonly contexte = inject(ContexteService);
  private readonly projSvc = inject(ProjectionService);
  private readonly categorieSvc = inject(CategorieService);
  private readonly compteSvc = inject(CompteService);
  private readonly posteSvc = inject(PosteService);
  private readonly objectifSvc = inject(ObjectifService);
  private readonly decomp = inject(DecompositionService);
  protected readonly viewport = inject(ViewportService);
  private readonly router = inject(Router);
  private readonly indicatorDrawer = inject(IndicatorDrawerService);

  readonly t = this.i18n.translations();
  readonly deviseBase = this.contexte.deviseBase;
  readonly membres = this.contexte.membres;

  readonly annee = input.required<number, string>({ transform: numberAttribute });
  readonly mois = input<number | undefined, string | undefined>(undefined, {
    transform: (v) => v !== undefined ? Number.parseInt(v, 10) : undefined,
  });
  /** `'foyer'` ou l'id d'un membre — segment `:sujetId` de la route. */
  readonly sujetId = input.required<string>();

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
  readonly ongletAnnee = signal('objectifs');
  readonly ongletMois = signal('echeances');
  readonly vueDecomposition = signal<'CATEGORIE' | 'TYPE_POSTE' | 'COMPTE'>('TYPE_POSTE');
  readonly pageNavSelectionForBinding = signal<PageNavSelection>({ mode: 'annee' });

  readonly vueDecompositionOptions = [
    { label: this.t.projection.vueTypePoste, value: 'TYPE_POSTE' },
    { label: this.t.projection.vueCategorie, value: 'CATEGORIE' },
    { label: this.t.projection.vueCompte, value: 'COMPTE' },
  ];

  /** Titre affiché en en-tête : nom du foyer ou nom du membre sélectionné. */
  readonly titrePage = computed(() => {
    const membre = this.membreCourant();
    return membre ? membre.nom : (this.contexte.foyerCourant()?.nom ?? this.t.nav.dashboard);
  });

  readonly annees = computed(() => {
    const scenario = this.contexte.scenarioCourant();
    return scenario
      ? Array.from({ length: scenario.horizonAnnees }, (_, i) => scenario.anneeDepart + i)
      : [this.annee()];
  });

  readonly periodeLabel = computed(() =>
    this.vue() === 'mois'
      ? `${this.t.mois[(this.moisSelectionne() ?? 1) - 1]} ${this.annee()}`
      : String(this.annee())
  );

  private readonly _refCle = computed<{ foyerId: string; scenarioId: string } | null>(() => {
    const foyerId = this.contexte.foyerId();
    const scenarioId = this.contexte.scenarioId();
    return foyerId && scenarioId ? { foyerId, scenarioId } : null;
  });

  private readonly _refData = creerChargementReactif(this._refCle, ({ foyerId, scenarioId }) =>
    forkJoin([
      this.categorieSvc.lister(foyerId),
      this.compteSvc.lister(foyerId),
      this.posteSvc.lister(foyerId, scenarioId),
      this.objectifSvc.lister(foyerId, scenarioId),
    ]),
  );

  readonly categories = computed(() => this._refData.donnees()?.[0] ?? []);
  readonly comptes = computed(() => this._refData.donnees()?.[1] ?? []);
  readonly postes = computed(() => this._refData.donnees()?.[2] ?? []);
  readonly objectifs = computed(() => this._refData.donnees()?.[3] ?? []);

  private readonly _projectionAnnuelleCle = computed<{ foyerId: string; scenarioId: string; annee: number } | null>(() => {
    const ref = this._refCle();
    return ref ? { ...ref, annee: this.annee() } : null;
  });

  private readonly _projectionAnnuelle = creerChargementReactif(this._projectionAnnuelleCle, ({ foyerId, scenarioId, annee }) =>
    this.projSvc.annuelle(foyerId, scenarioId, annee),
  );

  readonly projectionAnnuelle = computed(() => this._projectionAnnuelle.donnees());

  private readonly _evenementsCle = computed<{ foyerId: string; scenarioId: string; annee: number; membreId?: string } | null>(() => {
    const cle = this._projectionAnnuelleCle();
    const s = this.sujet();
    return cle ? { ...cle, membreId: s.mode === 'membre' ? s.membreId : undefined } : null;
  });

  private readonly _evenements = creerChargementReactif(this._evenementsCle, ({ foyerId, scenarioId, annee, membreId }) =>
    this.projSvc.evenements(foyerId, scenarioId, annee, membreId),
  );

  readonly evenementsDto = computed<EvenementDto[]>(() => this._evenements.donnees() ?? []);

  /** Matrice budgétaire "Nécessité vs Priorité d'action" (dashboard annuel) : postes déjà
   *  filtrés (non obsolètes, dédupliqués par chaîne de révisions, scopés au membre courant
   *  si applicable) et positionnés (scores 0-100, poids du montant, quadrant) — tout est
   *  calculé côté serveur par `MatriceBudgetaireService`, ce composant ne fait plus que
   *  transmettre les données reçues au composant partagé `app-matrice-budgetaire`. */
  private readonly _matriceBudgetaire = creerChargementReactif(this._evenementsCle, ({ foyerId, scenarioId, annee, membreId }) =>
    this.posteSvc.matriceBudgetaire(foyerId, scenarioId, annee, membreId),
  );

  readonly postesMatriceAnnee = computed<PostePositionneDto[]>(() => this._matriceBudgetaire.donnees() ?? []);

  readonly matriceChargement = computed(() => this._matriceBudgetaire.chargement());

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
    this.tauxEffortCards().map((data) => ({ indicator: tauxEffortMembreIndicator(data, this.t), data })),
  );

  /** Variante annuelle de la section "Taux d'effort" (vue année). Masquée en vue foyer
   *  agrégée (`sujet().mode === 'foyer'`) : sur l'année, l'indicateur par membre n'a de
   *  sens que consulté depuis le dashboard d'un membre précis. */
  readonly tauxEffortIndicateursAnnee = computed(() =>
    this.estModeMembre() ? this.tauxEffortCardsAnnee().map((data) => ({ indicator: tauxEffortMembreIndicator(data, this.t), data })) : [],
  );

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
    indicator: evenementsIndicator('evenements-mois', this.t.dashboard.indicateurEvenementsMoisTitre, this.evenementsMois().length, this.t),
    data: this.evenementsDataMois(),
  }));

  /** Variante annuelle — reprend le contenu de l'onglet "Ce qui change" (rendu groupé
   *  inchangé) dans le drawer. */
  readonly evenementsIndicateurAnnee = computed(() => ({
    indicator: evenementsIndicator('evenements-annee', this.t.dashboard.indicateurEvenementsAnneeTitre, this.evenementsAnnee().length, this.t),
    data: this.evenementsDataAnnee(),
  }));

  /** Payload signaux transmis au drawer "Virements des comptes". */
  private readonly virementsComptesData = computed<VirementsComptesDrawerData>(() => ({
    recaps: this.comptesRecapDto,
    devise: this.deviseBase,
    chargement: this.comptesRecapChargement,
  }));

  /** Indicateur "Virements des comptes" (mois + vue membre uniquement, mêmes données que
   *  l'onglet "Comptes") — `null` si non applicable (vue foyer ou vue année). */
  readonly virementsComptesIndicateur = computed(() => {
    if (!this.afficherOngletComptes()) return null;
    const recaps = this.comptesRecapDto();
    const totalSortants = recaps.reduce((somme, r) => somme + r.virementsSortants, 0);
    return {
      indicator: virementsComptesIndicator(recaps, this.formatMontant(totalSortants), this.t),
      data: this.virementsComptesData(),
    };
  });

  /** Section "Comment se passe ce mois" : Taux d'effort par membre + Événements du mois +
   *  Virements des comptes (si applicable — vue membre uniquement). */
  readonly commentSePasseIndicateursMois = computed(() => {
    const virements = this.virementsComptesIndicateur();
    return [
      ...this.tauxEffortIndicateursMois(),
      this.evenementsIndicateurMois(),
      ...(virements ? [virements] : []),
    ];
  });

  /** Section "Comment se passe cette année" : Taux d'effort par membre (vue membre
   *  uniquement) + Événements de l'année. */
  readonly commentSePasseIndicateursAnnee = computed(() => [
    ...this.tauxEffortIndicateursAnnee(),
    this.evenementsIndicateurAnnee(),
  ]);

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
      this.agregatMoisCourant().soldeDisponible,
      this.formatMontant(this.agregatMoisCourant().soldeDisponible),
      this.t,
    ),
    data: this.ventilationPostesDataMois(),
  }));

  /** Variante annuelle de l'indicateur "Ventilations des postes" (vue année). */
  readonly ventilationPostesIndicateurAnnee = computed(() => ({
    indicator: ventilationPostesIndicator(
      'ventilation-postes-annee',
      this.agregatAnneeCourant().soldeDisponible,
      this.formatMontant(this.agregatAnneeCourant().soldeDisponible),
      this.t,
    ),
    data: this.ventilationPostesDataAnnee(),
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
      fluxMensuelDescription: this.t.dashboard.fluxMensuelDescription,
      cliquezBarre: this.t.dashboard.cliquezBarre,
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
    indicator: evolutionGraphiqueIndicator(this.t),
    data: this.evolutionGraphiqueData(),
  }));

  /** Payload signaux transmis au drawer "Postes à optimiser" (annuel uniquement). */
  private readonly postesAOptimiserData = computed<PostesAOptimiserDrawerData>(() => ({
    postes: this.postesMatriceAnnee,
    devise: this.deviseBase,
    labels: this.matriceLabels,
    chargement: this.matriceChargement,
  }));

  /** Indicateur "Postes à optimiser" (annuel uniquement) — enveloppe la matrice budgétaire
   *  sortie de l'onglet "Graphiques" ; info = nombre de postes avec un score ≥ 35. */
  readonly postesAOptimiserIndicateur = computed(() => ({
    indicator: postesAOptimiserIndicator(this.postesMatriceAnnee(), this.t),
    data: this.postesAOptimiserData(),
  }));

  /** Section "Pour aller plus loin" (vue mois) : seule "Ventilations des postes" y figure
   *  (les graphiques et la matrice n'existent qu'en vue annuelle). */
  readonly pourAllerPlusLoinIndicateursMois = computed(() => [this.ventilationPostesIndicateurMois()]);

  /** Section "Pour aller plus loin" (vue année) : les 3 indicateurs. */
  readonly pourAllerPlusLoinIndicateursAnnee = computed(() => [
    this.ventilationPostesIndicateurAnnee(),
    this.evolutionGraphiqueIndicateur(),
    this.postesAOptimiserIndicateur(),
  ]);

  /** Onglet "Comptes" (récap mensuel de trésorerie par compte) : uniquement en vue mois
   *  ET vue membre, scopé au membre courant côté serveur (accès + agrégation). Le fetch
   *  n'est plus gaté sur l'onglet actif (chargé dès la vue mois/membre) car l'indicateur
   *  "Virements des comptes" a besoin de la donnée résolue même onglet fermé. */
  readonly afficherOngletComptes = computed(() => this.sujet().mode === 'membre');

  private readonly _comptesRecapCle = computed<{ foyerId: string; scenarioId: string; annee: number; mois: number; membreId: string } | null>(() => {
    if (!this.afficherOngletComptes()) return null;
    const ventCle = this._ventilationsMoisCle();
    const s = this.sujet();
    return ventCle && s.mode === 'membre' ? { ...ventCle, membreId: s.membreId } : null;
  });

  private readonly _comptesRecap = creerChargementReactif(this._comptesRecapCle, ({ foyerId, scenarioId, annee, mois, membreId }) =>
    this.projSvc.comptesRecap(foyerId, scenarioId, annee, mois, membreId),
  );

  readonly comptesRecapDto = computed<CompteRecapMensuelDto[]>(() => this._comptesRecap.donnees() ?? []);

  readonly comptesRecapChargement = computed(() => this._comptesRecap.chargement());

  private mapperTauxEffortCards(dtos: TauxEffortMembreDto[] | null | undefined): TauxEffortCardData[] {
    return (dtos ?? []).map((dto) => ({
      membre: { id: dto.membreId, nom: dto.nomMembre ?? '', couleur: dto.couleurMembre },
      revenusTotal: dto.revenusTotal,
      chargesTotal: dto.chargesTotal,
      reservesTotal: dto.reservesTotal,
      chargesTotalPireCas: dto.chargesTotalPireCas,
      reservesTotalPireCas: dto.reservesTotalPireCas,
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
    if (this.vue() !== 'annee') return null;
    const ref = this._refCle();
    const scenario = this.contexte.scenarioCourant();
    const anneePrecedente = this.annee() - 1;
    if (!ref || !scenario || anneePrecedente < scenario.anneeDepart) return null;
    return { ...ref, annee: anneePrecedente };
  });

  private readonly _projectionAnneePrecedente = creerChargementReactif(this._projectionAnneePrecedenteCle, ({ foyerId, scenarioId, annee }) =>
    this.projSvc.annuelle(foyerId, scenarioId, annee),
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
      ? this._projectionAnnuelle.chargement() || this._ventilationAnnuelleChargement.chargement()
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

  private pageNavInitialise = false;

  private readonly _syncPageNavDepuisRoute = effect(() => {
    const selection = this.vue() === 'mois' && this.moisSelectionne() !== undefined
      ? { mode: 'mois' as const, mois: this.moisSelectionne() }
      : { mode: 'annee' as const };
    const courante = untracked(() => this.pageNavSelectionForBinding());
    if (courante.mode !== selection.mode || courante.mois !== selection.mois) {
      this.pageNavSelectionForBinding.set(selection);
    }
    this.pageNavInitialise = true;
  });

  private readonly _syncPageNavVersRoute = effect(() => {
    if (!this.pageNavInitialise) {
      return;
    }
    const selection = this.pageNavSelectionForBinding();
    const moisActuel = this.moisSelectionne();
    if (selection.mode === this.vue() && (selection.mode !== 'mois' || selection.mois === moisActuel)) {
      return;
    }
    if (selection.mode === 'mois' && selection.mois === undefined) {
      return;
    }
    this.naviguerVersSelection(selection);
  });

  private localeCourante(): string {
    return localeDeLangue(this.i18n.currentLang());
  }

  private readonly fmtCompact = (v: number) =>
    Intl.NumberFormat(this.localeCourante(), { notation: 'compact', maximumFractionDigits: 1 }).format(v);

  private readonly fmtMensuel = (v: number) =>
    Intl.NumberFormat(this.localeCourante(), { notation: 'compact', maximumFractionDigits: 0 }).format(v / 12);

  private formatMontant(v: number): string {
    return new Intl.NumberFormat(this.localeCourante(), {
      style: 'currency',
      currency: this.deviseBase(),
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(v);
  }

  private formatMontantSansDevise(v: number): string {
    return Intl.NumberFormat(this.localeCourante(), {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(Math.abs(v));
  }

  formatPct(v: number): string {
    return this.decomp.formatPct(v);
  }

  private formatMois(mois: number): string {
    return this.t.mois[mois - 1];
  }

  private formatMoisAnnee(iso: string): string {
    return new Intl.DateTimeFormat(this.localeCourante(), { month: 'short', year: 'numeric' }).format(parseIsoDateLocal(iso));
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
    return this.decomp.construireDecomposition(detail, this.objectifs());
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
    return s.mode === 'membre'
      ? this.decomp.construireCascadeDecomposition(s.membreId, this.agregatMoisCourant(), ventilations, this.membres().length)
      : this.decomp.foyerCascadeDecomposition(ventilations, this.membres());
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
    }, this.objectifs());
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
    return s.mode === 'membre'
      ? this.decomp.construireCascadeDecomposition(s.membreId, this.agregatAnneeCourant(), ventilation, this.membres().length)
      : this.decomp.foyerCascadeDecomposition(ventilation, this.membres());
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

  /** Graphique de flux mensuel (revenus/charges/réserves), scopé au sujet courant. */
  mixedChartData = computed(() => this.buildChartData(this.moisAgregatsCourant()));

  private buildChartData(mois: AggregatDto[]): object {
    if (!mois.length) return {};
    return {
      labels: this.t.mois,
      datasets: [
        {
          type: 'line',
          label: this.t.projection.revenus,
          // Aligné sur --p-emerald-500 (couleur du solde disponible dans l'anneau mensuel).
          borderColor: '#3BBFA1',
          backgroundColor: '#3BBFA1',
          data: mois.map((m) => m.revenus),
          tension: 0.3,
          fill: false,
          pointRadius: 4,
          borderWidth: 1,
        },
        {
          type: 'bar',
          label: this.t.projection.charges,
          // Aligné sur --p-red-400 (couleur des charges fixes dans l'anneau mensuel).
          backgroundColor: '#EF5350',
          data: mois.map((m) => m.charges),
          stack: 'depenses',
        },
        {
          type: 'bar',
          label: this.t.projection.reserves,
          // Aligné sur --p-blue-400 (couleur des réserves dans l'anneau mensuel).
          backgroundColor: '#42A5F5',
          data: mois.map((m) => m.reserves),
          stack: 'depenses',
        },
      ],
    };
  }

  annualKpis = computed<KpiChip[]>(() => {
    const mois = this.moisAgregatsCourant();
    const objectifs = this.objectifsRendus();
    const nbAtteints = objectifs.filter((objectif) => objectif.statut === 'ATTEINT').length;
    const soldeMedian = this.soldeDisponibleMedianRobuste(mois);
    return [
      {
        label: this.t.dashboard.soldeMedianRobuste,
        value: soldeMedian !== null ? this.formatMontant(soldeMedian) : '-',
        hint: this.t.dashboard.soldeMedianRobusteHint,
        color: soldeMedian === null ? undefined : soldeMedian >= 0 ? 'var(--p-emerald-500)' : 'var(--p-red-500)',
      },
      {
        label: this.t.dashboard.tresorerieCumulee,
        value: this.formatMontant(this.tresorerieCumuleeFin()),
        hint: String(this.annee()),
      },
      {
        label: this.t.dashboard.nbObjectifs,
        value: objectifs.length,
        hint: `${nbAtteints}/${objectifs.length || 0}`,
      },
    ];
  });

  /** Moyenne du solde disponible sur 10 des 12 mois de l'année, en retirant le pire
   *  et le meilleur mois (médiane robuste) — donne une vision moins sensible aux
   *  extrêmes ponctuels que la moyenne brute sur 12 mois. `null` si moins de 3 mois
   *  disponibles (donnée pas encore chargée). */
  private soldeDisponibleMedianRobuste(mois: AggregatDto[]): number | null {
    if (mois.length < 3) return null;
    const soldes = [...mois.map((m) => m.soldeDisponible)].sort((a, b) => a - b);
    const sansExtremes = soldes.slice(1, -1);
    return sansExtremes.reduce((sum, valeur) => sum + valeur, 0) / sansExtremes.length;
  }

  readonly kpiMois = computed<KpiChip[]>(() => {
    const echeances = this.echeancesMois();
    const evenements = this.evenementsMois();
    const restant = echeances.reduce((sum, objectif) => sum + objectif.restant, 0);
    return [
      {
        label: this.t.dashboard.echeancesCeMois,
        value: echeances.length,
        hint: echeances.length ? this.formatMontant(restant) : this.t.dashboard.aucuneEcheance,
      },
      {
        label: this.t.dashboard.evenementsCeMois,
        value: evenements.length,
        hint: evenements.length ? evenements.map((evenement) => evenement.title).slice(0, 2).join(' · ') : this.t.dashboard.aucunEvenement,
      },
    ];
  });

  readonly ringSegmentsAnnee = computed<MetricRingSegment[]>(() => {
    const mois = this.moisAgregatsCourant();
    const positifs = mois.filter((item) => item.soldeDisponible >= 0).length;
    const negatifs = Math.max(mois.length - positifs, 0);
    return [
      { value: positifs, color: 'var(--p-emerald-500)' },
      { value: negatifs, color: 'var(--p-red-500)' },
    ];
  });

  readonly ringCenterAnnee = computed(() => {
    const mois = this.moisAgregatsCourant();
    const positifs = mois.filter((item) => item.soldeDisponible >= 0).length;
    const negatifs = Math.max(mois.length - positifs, 0);
    return `${positifs}-${negatifs}`;
  });

  readonly statsAnnee = computed<StatItem[]>(() => {
    const total = this.agregatAnneeCourant();
    const mois = this.moisAgregatsCourant();
    const tauxReserve = total.revenus > 0 ? (total.reserves / total.revenus) * 100 : 0;
    const tauxSolde = total.revenus > 0 ? (total.soldeDisponible / total.revenus) * 100 : 0;
    const moisSousSeuil = mois.filter((item) => item.soldeDisponible < 500).length;
    const diffTresorerie = this.differenceTresorerieAnnuelle();
    return [
      {
        label: this.t.dashboard.moisSousSeuilRisque,
        value: String(moisSousSeuil),
        color: moisSousSeuil > 0 ? 'var(--p-red-500)' : 'var(--p-emerald-500)',
      },
      {
        label: this.t.dashboard.tauxDeReserve,
        value: `${this.formatPct(tauxReserve)} %`,
        color: tauxReserve >= 0 ? 'var(--p-emerald-500)' : 'var(--p-red-500)',
      },
      {
        label: this.t.dashboard.tauxDeSolde,
        value: `${this.formatPct(tauxSolde)} %`,
        color: tauxSolde >= 0 ? 'var(--p-emerald-500)' : 'var(--p-red-500)',
      },
      {
        label: this.t.dashboard.differenceTresorerieAnPasse,
        value: diffTresorerie !== null
          ? `${diffTresorerie >= 0 ? '+' : ''}${this.formatMontant(diffTresorerie)}`
          : '-',
        color: diffTresorerie === null
          ? undefined
          : diffTresorerie >= 0 ? 'var(--p-emerald-500)' : 'var(--p-red-500)',
      },
    ];
  });

  readonly statusAnnee = computed<StatGridStatusTag>(() => {
    const total = this.agregatAnneeCourant();
    const moisNegatifs = this.moisAgregatsCourant().filter((item) => item.soldeDisponible < 0).length;
    if (total.soldeDisponible < 0) {
      return { value: this.t.dashboard.statutDeficitaire, severity: 'danger' };
    }
    if (moisNegatifs >= 4) {
      return { value: this.t.dashboard.statutASurveiller, severity: 'warn' };
    }
    return { value: this.t.dashboard.statutExcedentaire, severity: 'success' };
  });

  readonly postesActifsMois = computed(() => {
    const mois = this.moisSelectionne();
    if (mois === undefined) return [];
    const actifs = this.postes().filter((poste) => this.posteActifSurMois(poste, this.annee(), mois));
    const s = this.sujet();
    return s.mode === 'foyer' ? actifs : actifs.filter((p) => this.posteConcerneMembre(p, s.membreId, this.annee(), mois));
  });

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

  // Note : `nature` (EFFECTIF|ESTIMATION) est purement descriptif côté moteur (doc 01
  // §3) — il n'exclut aucune charge du total réel (`charges` = somme de toutes les
  // contributions, quelle que soit la nature). Les « charges fixes » doivent donc
  // inclure TOUTES les charges (comme le récapitulatif serveur) ; `margeVariable`
  // n'est qu'un indicateur ± additionnel de l'incertitude sur les postes ESTIMATION,
  // pas une soustraction du montant central de ces postes.
  readonly chargesSuresMois = computed(() => {
    const s = this.sujet();
    const mois = this.moisSelectionne() ?? 1;
    return this.postesActifsMois()
      .filter((poste) => poste.type === 'CHARGE')
      .reduce((sum, poste) => {
        const montant = Math.abs(this.decomp.contributionMois(poste, this.annee(), mois));
        const q = s.mode === 'membre' ? this.quotePartMembrePoste(poste, s.membreId, this.annee(), mois) : 1;
        return sum + montant * q;
      }, 0);
  });

  readonly margeVariableMois = computed(() => {
    const s = this.sujet();
    const mois = this.moisSelectionne() ?? 1;
    return this.postesActifsMois()
      .filter((poste) => poste.type === 'CHARGE' && poste.nature === 'ESTIMATION')
      .reduce((sum, poste) => {
        const montant = Math.abs(this.decomp.contributionMois(poste, this.annee(), mois)) * ((poste.estimPourcentage ?? 0) / 100);
        const q = s.mode === 'membre' ? this.quotePartMembrePoste(poste, s.membreId, this.annee(), mois) : 1;
        return sum + montant * q;
      }, 0);
  });

  /** Segments labellisés de la barre mensuelle (remplace l'ancien anneau) : mêmes
   *  valeurs/couleurs que l'anneau précédent. `p-meterGroup` affiche nativement
   *  chaque libellé avec son pourcentage (pas de montant affiché). */
  readonly barSegmentsMois = computed<MetricBarSegment[]>(() => {
    const rav = this.agregatMoisCourant().soldeDisponible;
    const marge = this.margeVariableMois();
    const reserves = this.agregatMoisCourant().reserves;
    return [
      {
        label: this.t.dashboard.chargesSures,
        value: this.chargesSuresMois(),
        color: 'var(--p-red-400)',
      },
      {
        label: this.t.dashboard.margeVariable,
        value: marge * 2,
        color: 'var(--p-red-200)',
      },
      {
        label: this.t.dashboard.reserves,
        value: reserves,
        color: 'var(--p-blue-400)',
      },
      {
        label: this.t.dashboard.resteAVivre,
        value: Math.max(rav - marge, 0),
        color: 'var(--p-emerald-500)',
      },
    ];
  });

  readonly revenusMoisLabel = computed(() => this.t.dashboard.revenusMois);

  readonly revenusMoisValeur = computed(() => this.formatMontant(this.agregatMoisCourant().revenus));

  readonly statusMois = computed<StatGridStatusTag>(() => {
    const rav = this.agregatMoisCourant().soldeDisponible;
    const marge = this.margeVariableMois();
    if (rav < 0) {
      return { value: this.t.dashboard.statutDeficitaire, severity: 'danger' };
    }
    if (rav - marge < 0) {
      return { value: this.t.dashboard.statutASurveiller, severity: 'warn' };
    }
    return { value: this.t.dashboard.statutEquilibre, severity: 'success' };
  });

  readonly tresorerieCumuleeValeurs = computed(() => this.calculerTresorerieCumulee(this.moisAgregatsCourant()));

  /** Trésorerie cumulée "réelle" : même calcul mais à partir des agrégats mensuels non
   *  lissés (échéances imputées au mois d'ancrage, cf. moisReel). Permet de visualiser
   *  quand la trésorerie évolue réellement par rapport à sa vision scénarisée/lissée. */
  readonly tresorerieCumuleeReelValeurs = computed(() => this.calculerTresorerieCumulee(this.moisReelAgregatsCourant()));

  /** Cumule la trésorerie mois par mois à partir de la trésorerie initiale du scénario
   *  (prorata en mode membre), pour une série d'agrégats mensuels donnée. Factorisé pour
   *  être réutilisé sur l'année courante et l'année précédente (comparaison N vs N-1). */
  private calculerTresorerieCumulee(moisAgregats: AggregatDto[]): number[] {
    const scenario = this.contexte.scenarioCourant();
    if (!scenario || !moisAgregats.length) return [];
    const s = this.sujet();
    // Approximation en mode membre : le backend n'a pas de notion de trésorerie initiale
    // par membre — on prorate la trésorerie initiale du scénario par sa quote-part par
    // défaut (répartition du scénario), à défaut d'un vrai concept produit dédié.
    const quotePartInitiale = s.mode === 'membre'
      ? (scenario.repartitions.find((r) => r.membreId === s.membreId)?.quotePart ?? 0)
      : 1;
    let cumul = scenario.tresorerieInitiale * quotePartInitiale;
    return moisAgregats.map((agregat) => {
      cumul += agregat.soldeDisponible;
      return cumul;
    });
  }

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

  private tresorerieCumuleeFin(): number {
    const valeurs = this.tresorerieCumuleeValeurs();
    return valeurs.length ? valeurs[valeurs.length - 1] : this.contexte.scenarioCourant()?.tresorerieInitiale ?? 0;
  }

  /** Trésorerie cumulée en fin d'année précédente (N-1), ou `null` si non disponible
   *  (première année du scénario, ou données pas encore chargées). */
  readonly tresorerieFinAnneePrecedente = computed<number | null>(() => {
    if (!this._projectionAnneePrecedenteCle()) return null;
    const valeurs = this.calculerTresorerieCumulee(this.moisAgregatsAnneePrecedente());
    return valeurs.length ? valeurs[valeurs.length - 1] : null;
  });

  /** Différence entre la trésorerie cumulée en fin d'année courante et celle de l'an
   *  passé — `null` si l'année précédente n'est pas disponible (première année du
   *  scénario, ou en cours de chargement). */
  readonly differenceTresorerieAnnuelle = computed<number | null>(() => {
    const finPrecedente = this.tresorerieFinAnneePrecedente();
    if (finPrecedente === null) return null;
    return this.tresorerieCumuleeFin() - finPrecedente;
  });

  private statutObjectif(objectif: ObjectifDto): StatutObjectif {
    if (objectif.progression >= 1) return 'ATTEINT';
    if (objectif.echeance && parseIsoDateLocal(objectif.echeance) < new Date()) return 'EN_RETARD';
    return 'DANS_LES_TEMPS';
  }

  private severityObjectif(statut: StatutObjectif): ObjectiveProgressSeverity {
    switch (statut) {
      case 'EN_RETARD': return 'warn';
      case 'ATTEINT': return 'success';
      default: return 'info';
    }
  }

  private objectifMeta(objectif: ObjectifDto): string {
    const morceaux: string[] = [];
    if (objectif.echeance) {
      morceaux.push(this.formatMoisAnnee(objectif.echeance));
    }
    if (objectif.progression < 1 && objectif.epargneRequise > 0) {
      morceaux.push(this.formatMontant(objectif.epargneRequise));
    }
    return morceaux.join(' · ');
  }

  /** Objectifs scopés au sujet courant : en mode membre, uniquement ceux rattachés à un
   *  compte dont ce membre est co-titulaire (le compte "porte" l'objectif — cf. modèle). */
  readonly objectifsPourSujet = computed<ObjectifDto[]>(() => {
    const s = this.sujet();
    const objectifs = this.objectifs();
    if (s.mode === 'foyer') return objectifs;
    const comptes = this.comptes();
    return objectifs.filter((o) => (comptes.find((c) => c.id === o.compteId)?.membreIds ?? []).includes(s.membreId));
  });

  readonly objectifsRendus = computed(() =>
    this.objectifsPourSujet().map((objectif) => {
      const statut = this.statutObjectif(objectif);
      return {
        id: objectif.id,
        nom: objectif.libelle,
        pct: objectif.progression * 100,
        statut,
        statusLabel: this.t.objectif.statuts[statut],
        severity: this.severityObjectif(statut),
        meta: this.objectifMeta(objectif),
      };
    })
  );

  readonly echeancesMois = computed(() => {
    const mois = this.moisSelectionne();
    if (mois === undefined) return [];
    return this.objectifsPourSujet()
      .filter((objectif) => objectif.echeance && this.dateDansMois(objectif.echeance, this.annee(), mois))
      .sort((a, b) => (a.echeance ?? '').localeCompare(b.echeance ?? ''))
      .map((objectif) => {
        const statut = this.statutObjectif(objectif);
        return {
          id: objectif.id,
          nom: objectif.libelle,
          pct: objectif.progression * 100,
          restant: Math.max(objectif.montantCible - objectif.soldeActuel, 0),
          statusLabel: this.t.objectif.statuts[statut],
          severity: this.severityObjectif(statut),
          meta: objectif.echeance ? this.formatMoisAnnee(objectif.echeance) : '',
        };
      });
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


  private dateDansMois(iso: string, annee: number, mois: number): boolean {
    const date = parseIsoDateLocal(iso);
    return date.getFullYear() === annee && date.getMonth() + 1 === mois;
  }

  private posteActifSurMois(poste: PosteDto, annee: number, mois: number): boolean {
    const debutMois = new Date(annee, mois - 1, 1);
    const finMois = new Date(annee, mois, 0);
    const debut = poste.debut ? parseIsoDateLocal(poste.debut) : null;
    const fin = poste.fin ? parseIsoDateLocal(poste.fin) : null;
    const debutOk = !debut || debut <= finMois;
    const finOk = !fin || fin >= debutMois;
    return debutOk && finOk;
  }

  /** Quote-part effective (0-1) d'un membre sur un poste, pour un mois donné — miroir
   *  fidèle de `MoteurCalcul.quotePartEffective` (backend), utilisé uniquement pour les
   *  segments de l'anneau (`chargesSuresMois`/`margeVariableMois`) : cette agrégation
   *  n'est pas encore exposée telle quelle par le backend (voir docs/03 §2.3 — dette
   *  assumée en attendant une extension du moteur avec vecteurs golden). */
  private quotePartMembrePoste(poste: PosteDto, membreId: string, annee: number, mois: number): number {
    return this.decomp.quotePartEffectivePoste(
      poste, membreId, this.contexte.scenarioCourant(), annee, mois, this.membres().length);
  }

  private posteConcerneMembre(poste: PosteDto, membreId: string, annee: number, mois: number): boolean {
    return this.quotePartMembrePoste(poste, membreId, annee, mois) > 0;
  }

  peutReculer(): boolean {
    const annees = this.annees();
    const premiereAnnee = annees[0] ?? this.annee();
    if (this.vue() === 'mois') {
      return this.annee() > premiereAnnee || (this.moisSelectionne() ?? 1) > 1;
    }
    return this.annee() > premiereAnnee;
  }

  peutAvancer(): boolean {
    const annees = this.annees();
    const derniereAnnee = annees[annees.length - 1] ?? this.annee();
    if (this.vue() === 'mois') {
      return this.annee() < derniereAnnee || (this.moisSelectionne() ?? 12) < 12;
    }
    return this.annee() < derniereAnnee;
  }

  reculer(): void {
    if (!this.peutReculer()) return;
    if (this.vue() === 'mois') {
      let annee = this.annee();
      let mois = this.moisSelectionne() ?? 1;
      if (mois === 1) {
        mois = 12;
        annee -= 1;
      } else {
        mois -= 1;
      }
      this.naviguerVersMois(annee, mois);
      return;
    }
    this.naviguerVersAnnee(this.annee() - 1);
  }

  avancer(): void {
    if (!this.peutAvancer()) return;
    if (this.vue() === 'mois') {
      let annee = this.annee();
      let mois = this.moisSelectionne() ?? 1;
      if (mois === 12) {
        mois = 1;
        annee += 1;
      } else {
        mois += 1;
      }
      this.naviguerVersMois(annee, mois);
      return;
    }
    this.naviguerVersAnnee(this.annee() + 1);
  }

  onAnneeTabChange(value: string): void {
    this.ongletAnnee.set(value);
    this.recalculerChartsMasques();
  }

  onMoisTabChange(value: string): void {
    this.ongletMois.set(value);
    this.recalculerChartsMasques();
  }

  ouvrirMoisNumero(mois: number): void {
    this.naviguerVersMois(this.annee(), mois);
  }

  ouvrirMoisDepuisTimeline(item: TimelineItem): void {
    const mois = (item as DashboardTimelineItem).mois;
    if (mois) {
      this.ouvrirMoisNumero(mois);
    }
  }

  private recalculerChartsMasques(): void {
    if (typeof window === 'undefined') return;
    setTimeout(() => window.dispatchEvent(new Event('resize')), 0);
  }

  private naviguerVersSelection(selection: PageNavSelection): void {
    if (selection.mode === 'mois' && selection.mois !== undefined) {
      this.naviguerVersMois(this.annee(), selection.mois);
      return;
    }
    this.naviguerVersAnnee(this.annee());
  }

  private naviguerVersAnnee(annee: number): void {
    const foyerId = this.contexte.foyerId();
    if (!foyerId) return;
    void this.router.navigate(['/f', foyerId, 'dashboard', this.sujetId(), String(annee)], { queryParamsHandling: 'preserve' });
  }

  private naviguerVersMois(annee: number, mois: number): void {
    const foyerId = this.contexte.foyerId();
    if (!foyerId) return;
    void this.router.navigate(['/f', foyerId, 'dashboard', this.sujetId(), String(annee), String(mois).padStart(2, '0')], { queryParamsHandling: 'preserve' });
  }

  /** Navigue vers un autre sujet (foyer ou membre) en conservant année/mois courants. */
  private naviguerVersSujet(sujetId: string): void {
    const foyerId = this.contexte.foyerId();
    if (!foyerId) return;
    const segments = ['/f', foyerId, 'dashboard', sujetId, String(this.annee())];
    const mois = this.moisSelectionne();
    if (mois !== undefined) segments.push(String(mois).padStart(2, '0'));
    void this.router.navigate(segments, { queryParamsHandling: 'preserve' });
  }

  readonly moisSummary = computed<PageNavMonthSummary[]>(() => {
    const mois = this.moisAgregatsCourant();
    if (!mois.length) {
      return this.t.mois.map((label, index) => ({ mois: index + 1, label: label.slice(0, 3), solde: 0 }));
    }
    return mois.map((agregat, index) => ({
      mois: index + 1,
      label: this.formatMois(index + 1),
      solde: agregat.soldeDisponible,
    }));
  });
}
