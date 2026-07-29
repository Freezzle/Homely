import { CommonModule } from '@angular/common';
import { Component, computed, effect, inject, input, numberAttribute, signal, untracked } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { forkJoin } from 'rxjs';
import { ButtonModule } from 'primeng/button';
import { CardModule } from 'primeng/card';
import { ChartModule } from 'primeng/chart';
import { SelectButtonModule } from 'primeng/selectbutton';
import { SkeletonModule } from 'primeng/skeleton';
import { ContexteService } from '../../core/services/contexte.service';
import { ProjectionService } from '../../core/services/projection.service';
import { CategorieService, CompteService } from '../../core/services/referentiel.service';
import { ObjectifService, PosteService } from '../../core/services/scenario-poste.service';
import { DecompositionService, VentilationLike } from '../../core/services/decomposition.service';
import {
  AggregatDto,
  CategorieDto,
  CompteDto,
  ObjectifDto,
  PosteDto,
  ProjectionAnnuelleDto,
  ScenarioDto,
  TypeCategorie,
  VentilationAggregatDto,
  VentilationSplitDto,
  VentilationsDto,
} from '../../core/models/api.models';
import { I18nService } from '../../core/i18n/i18n.service';
import { localeDeLangue } from '../../core/i18n/locale.util';
import { ViewportService } from '../../core/services/viewport.service';
import { creerChargementReactif } from '../../core/utils/reference-data.util';
import { parseIsoDateLocal } from '../../core/utils/date.util';
import { CarteBilanComponent, LigneDecomposition, MembreTagInfo } from '../../shared/components/carte-bilan/carte-bilan.component';
import { KpiChipRowComponent } from '../../shared/components/kpi-chip-row/kpi-chip-row.component';
import { KpiChip } from '../../shared/components/kpi-chip/kpi-chip.component';
import { MemberRecapCardComponent } from '../../shared/components/member-recap-card/member-recap-card.component';
import { MetricRingComponent, MetricRingSegment } from '../../shared/components/metric-ring/metric-ring.component';
import { ObjectiveProgressComponent, ObjectiveProgressSeverity } from '../../shared/components/objective-progress/objective-progress.component';
import { PageNavComponent, PageNavMonthSummary, PageNavSelection } from '../../shared/components/page-nav/page-nav.component';
import { StatGridComponent, StatGridStatusTag, StatItem } from '../../shared/components/stat-grid/stat-grid.component';
import { TabGroupComponent } from '../../shared/components/tab-group/tab-group.component';
import { TabPanelComponent } from '../../shared/components/tab-group/tab-panel.component';
import { TimelineComponent, TimelineItem } from '../../shared/components/timeline/timeline.component';

type StatutObjectif = 'DANS_LES_TEMPS' | 'EN_RETARD' | 'ATTEINT';
type DashboardTimelineItem = TimelineItem & { mois: number };

@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    ButtonModule,
    CardModule,
    ChartModule,
    SelectButtonModule,
    SkeletonModule,
    CarteBilanComponent,
    KpiChipRowComponent,
    MemberRecapCardComponent,
    MetricRingComponent,
    ObjectiveProgressComponent,
    PageNavComponent,
    StatGridComponent,
    TabGroupComponent,
    TabPanelComponent,
    TimelineComponent,
  ],
  templateUrl: './dashboard.component.html',
  styleUrl: './dashboard.component.scss',
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

  readonly t = this.i18n.translations();
  readonly deviseBase = this.contexte.deviseBase;
  readonly membres = this.contexte.membres;

  readonly annee = input.required<number, string>({ transform: numberAttribute });
  readonly mois = input<number | undefined, string | undefined>(undefined, {
    transform: (v) => v !== undefined ? Number.parseInt(v, 10) : undefined,
  });

  readonly moisSelectionne = computed(() => {
    const mois = this.mois();
    return mois !== undefined && Number.isFinite(mois) && mois >= 1 && mois <= 12 ? mois : undefined;
  });

  readonly vue = computed<'annee' | 'mois'>(() => this.moisSelectionne() !== undefined ? 'mois' : 'annee');
  readonly ongletAnnee = signal('flux');
  readonly ongletMois = signal('recap');
  readonly vueRecap = signal<'FOYER' | 'MEMBRE' | 'TOUT'>('MEMBRE');
  readonly vueDecomposition = signal<'CATEGORIE' | 'TYPE_POSTE' | 'COMPTE'>('TYPE_POSTE');
  readonly pageNavSelectionForBinding = signal<PageNavSelection>({ mode: 'annee' });
  readonly afficherParMembre = computed(() => this.membres().length > 1);
  readonly vueEffective = computed<'FOYER' | 'MEMBRE' | 'TOUT'>(() =>
    this.afficherParMembre() ? this.vueRecap() : 'FOYER'
  );

  readonly vueOptions = [
    { label: this.t.projection.vueFoyer, value: 'FOYER' },
    { label: this.t.projection.vueParMembre, value: 'MEMBRE' },
    { label: this.t.projection.vueTout, value: 'TOUT' },
  ];

  readonly vueDecompositionOptions = [
    { label: this.t.projection.vueCategorie, value: 'CATEGORIE' },
    { label: this.t.projection.vueTypePoste, value: 'TYPE_POSTE' },
    { label: this.t.projection.vueCompte, value: 'COMPTE' },
  ];

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

  private readonly _ventilationsMoisCle = computed<{ foyerId: string; scenarioId: string; annee: number; mois: number } | null>(() => {
    const ref = this._refCle();
    const mois = this.moisSelectionne();
    return ref && mois !== undefined ? { ...ref, annee: this.annee(), mois } : null;
  });

  private readonly _ventilationsMois = creerChargementReactif(this._ventilationsMoisCle, ({ foyerId, scenarioId, annee, mois }) =>
    this.projSvc.mensuelle(foyerId, scenarioId, annee, mois),
  );

  readonly ventilations = computed(() => this._ventilationsMois.donnees());

  private readonly _ventilationAnnuelleCle = computed(() =>
    this.vue() === 'annee' ? this._projectionAnnuelleCle() : null
  );

  private readonly _ventilationAnnuelle = creerChargementReactif(this._ventilationAnnuelleCle, ({ foyerId, scenarioId, annee }) =>
    forkJoin(Array.from({ length: 12 }, (_, i) => this.projSvc.mensuelle(foyerId, scenarioId, annee, i + 1))),
  );

  readonly ventilationAnnuelle = computed(() => {
    const donnees = this._ventilationAnnuelle.donnees();
    return donnees ? this.sommerVentilations(donnees) : null;
  });

  readonly chargement = computed(() =>
    this._refData.chargement()
    || (this.vue() === 'annee'
      ? this._projectionAnnuelle.chargement() || this._ventilationAnnuelle.chargement()
      : this._ventilationsMois.chargement())
  );

  private pageNavInitialise = false;
  private etaitMonoMembre = false;

  private readonly _normaliserVueEffect = effect(() => {
    const multiMembres = this.afficherParMembre();
    if (!multiMembres) {
      this.etaitMonoMembre = true;
      if (this.vueRecap() !== 'FOYER') {
        this.vueRecap.set('FOYER');
      }
      return;
    }
    if (this.etaitMonoMembre) {
      this.etaitMonoMembre = false;
      if (this.vueRecap() !== 'MEMBRE') {
        this.vueRecap.set('MEMBRE');
      }
    }
  });

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

  private formatMoisCourt(mois: number): string {
    return this.t.mois[mois - 1].slice(0, 3);
  }

  private formatMoisAnnee(iso: string): string {
    return new Intl.DateTimeFormat(this.localeCourante(), { month: 'short', year: 'numeric' }).format(parseIsoDateLocal(iso));
  }

  private severityEffort(taux: number): 'success' | 'warn' | 'danger' {
    if (taux >= 75) return 'danger';
    if (taux >= 50) return 'warn';
    return 'success';
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

  private categorieMontantParMembre(categorieId: string, membreId: string): number {
    return (this.ventilations()?.parCategorieMembre ?? {})[categorieId]?.[membreId] ?? 0;
  }

  private categorieMontantParMembreAnnuel(categorieId: string, membreId: string): number {
    return (this.ventilationAnnuelle()?.parCategorieMembre ?? {})[categorieId]?.[membreId] ?? 0;
  }

  private categorieDepuisPoste(poste: PosteDto): string {
    return poste.categorieId
      ? this.categories().find((categorie) => categorie.id === poste.categorieId)?.libelle ?? ''
      : '';
  }

  readonly foyerInitiales = computed(() => this.initiales(this.contexte.foyerCourant()?.nom ?? this.t.projection.foyer));

  readonly foyerSousTitre = computed(() => {
    const nbMembres = this.membres().length;
    const scenarioNom = this.contexte.scenarioCourant()?.nom ?? '';
    return `${nbMembres} ${this.t.projection.membres} · ${this.t.projection.scenarioMot} ${scenarioNom}`;
  });

  readonly foyerSousTitreAnnuel = this.foyerSousTitre;

  readonly tauxEffort = computed(() =>
    this.decomp.tauxEffort(this.ventilations()?.agregat ?? { revenus: 0, charges: 0, reserves: 0, soldeDisponible: 0 })
  );

  readonly categoriesParType = computed(() => {
    const ventilations = this.ventilations();
    const categories = this.categories();
    const makeList = (type: TypeCategorie) =>
      categories
        .filter((categorie) => categorie.typePoste === type)
        .map((categorie) => ({
          id: categorie.id,
          libelle: categorie.libelle,
          montant: (ventilations?.parCategorie as Record<string, number>)?.[categorie.id] ?? 0,
        }))
        .filter((row) => row.montant !== 0)
        .sort((a, b) => b.montant - a.montant);
    return {
      revenus: makeList('REVENU'),
      charges: makeList('CHARGE'),
      reserves: makeList('RESERVE'),
    };
  });

  readonly membresParType = computed(() => {
    const ventilations = this.ventilations();
    const membres = this.membres();
    const makeList = (type: keyof VentilationAggregatDto) =>
      membres
        .map((membre) => ({
          id: membre.id,
          libelle: membre.nom,
          montant: (ventilations?.parMembre as Record<string, VentilationAggregatDto>)?.[membre.id]?.[type] ?? 0,
        }))
        .filter((row) => row.montant !== 0)
        .sort((a, b) => b.montant - a.montant);
    return {
      revenus: makeList('revenus'),
      charges: makeList('charges'),
      reserves: makeList('reserves'),
    };
  });

  readonly foyerDecomposition = computed(() => this.construireDecomposition(this.categoriesParType()));

  readonly foyerCompteDecomposition = computed<LigneDecomposition[]>(() => {
    const ventilations = this.ventilations();
    if (!ventilations) return [];
    return Object.entries(ventilations.parCompteMembre ?? {})
      .map(([compteId, memMap]) => ({
        id: compteId,
        libelle: this.compteLibelle(compteId),
        montantAbs: Object.values(memMap).reduce((sum, montant) => sum + montant, 0),
        signe: -1 as const,
        tags: this.membresTagsCompte(compteId),
      }))
      .filter((compte) => compte.montantAbs !== 0)
      .sort((a, b) => b.montantAbs - a.montantAbs);
  });

  readonly foyerCascadeDecomposition = computed(() => {
    const ventilations = this.ventilations();
    return ventilations ? this.decomp.foyerCascadeDecomposition(ventilations, this.membres()) : [];
  });

  readonly foyerLignesActuelles = computed(() => {
    switch (this.vueDecomposition()) {
      case 'CATEGORIE': return this.foyerDecomposition();
      case 'COMPTE': return this.foyerCompteDecomposition();
      default: return this.foyerCascadeDecomposition();
    }
  });

  lignesMembre(mc: {
    decomposition: LigneDecomposition[];
    cascadeDecomposition: LigneDecomposition[];
    compteDecomposition: LigneDecomposition[];
  }): LigneDecomposition[] {
    switch (this.vueDecomposition()) {
      case 'CATEGORIE': return mc.decomposition;
      case 'COMPTE': return mc.compteDecomposition;
      default: return mc.cascadeDecomposition;
    }
  }

  readonly membresData = computed(() => {
    const ventilations = this.ventilations();
    if (!ventilations) return [];
    const zero: VentilationAggregatDto = { revenus: 0, charges: 0, reserves: 0, soldeDisponible: 0 };
    const categories = this.categories();
    const nbMembres = this.membres().length;
    return this.membres().map((membre) => {
      const agregat: VentilationAggregatDto = (ventilations.parMembre ?? {})[membre.id] ?? zero;
      const tauxEffort = this.decomp.tauxEffort(agregat);
      const chargesParCompte = Object.entries(ventilations.parCompteMembre ?? {})
        .map(([compteId, memMap]) => ({
          id: compteId,
          libelle: this.compteLibelle(compteId),
          montant: memMap[membre.id] ?? 0,
        }))
        .filter((compte) => compte.montant > 0)
        .sort((a, b) => b.montant - a.montant);
      const makeList = (type: TypeCategorie) =>
        categories
          .filter((categorie) => categorie.typePoste === type)
          .map((categorie) => ({ id: categorie.id, libelle: categorie.libelle, montant: this.categorieMontantParMembre(categorie.id, membre.id) }))
          .filter((row) => row.montant !== 0)
          .sort((a, b) => b.montant - a.montant);
      const detail = {
        revenus: makeList('REVENU'),
        charges: makeList('CHARGE'),
        reserves: makeList('RESERVE'),
      };
      return {
        id: membre.id,
        nom: membre.nom,
        couleur: membre.couleur,
        initiales: this.initiales(membre.nom),
        sousTitre: this.sousTitrePeriode(membre.id),
        rav: agregat.soldeDisponible,
        agregat,
        tauxEffort,
        effortSeverity: this.severityEffort(tauxEffort),
        decomposition: this.construireDecomposition(detail),
        cascadeDecomposition: this.decomp.construireCascadeDecomposition(membre.id, agregat, ventilations, nbMembres),
        compteDecomposition: chargesParCompte.map((compte) => ({
          id: compte.id,
          libelle: compte.libelle,
          montantAbs: compte.montant,
          signe: -1 as const,
          tags: this.membresTagsCompte(compte.id, membre.id),
        })),
        categories: detail,
        chargesParCompte,
        compteChartData: this.buildCompteChartData(chargesParCompte, membre.couleur),
        compteChartHeight: Math.max(chargesParCompte.length * 38 + 16, 160),
      };
    });
  });

  readonly tauxEffortAnnuel = computed(() =>
    this.decomp.tauxEffort(this.ventilationAnnuelle()?.agregat ?? { revenus: 0, charges: 0, reserves: 0, soldeDisponible: 0 })
  );

  readonly foyerDecompositionAnnuel = computed<LigneDecomposition[]>(() => {
    const ventilation = this.ventilationAnnuelle();
    if (!ventilation) return [];
    const categories = this.categories();
    const makeList = (type: TypeCategorie) =>
      this.decomp.listeParCategorie(type, categories, (categorieId) => ventilation.parCategorie[categorieId] ?? 0);
    return this.decomp.construireDecomposition({
      revenus: makeList('REVENU'),
      charges: makeList('CHARGE'),
      reserves: makeList('RESERVE'),
    }, this.objectifs());
  });

  readonly foyerCompteDecompositionAnnuel = computed<LigneDecomposition[]>(() => {
    const ventilation = this.ventilationAnnuelle();
    if (!ventilation) return [];
    return Object.entries(ventilation.parCompteMembre ?? {})
      .map(([compteId, memMap]) => ({
        id: compteId,
        libelle: this.compteLibelle(compteId),
        montantAbs: Object.values(memMap).reduce((sum, montant) => sum + montant, 0),
        signe: -1 as const,
        tags: this.decomp.membresTagsCompte(compteId, this.comptes(), this.membres()),
      }))
      .filter((compte) => compte.montantAbs !== 0)
      .sort((a, b) => b.montantAbs - a.montantAbs);
  });

  readonly foyerCascadeDecompositionAnnuel = computed(() => {
    const ventilation = this.ventilationAnnuelle();
    return ventilation ? this.decomp.foyerCascadeDecomposition(ventilation, this.membres()) : [];
  });

  readonly foyerLignesActuellesAnnuel = computed(() => {
    switch (this.vueDecomposition()) {
      case 'CATEGORIE': return this.foyerDecompositionAnnuel();
      case 'COMPTE': return this.foyerCompteDecompositionAnnuel();
      default: return this.foyerCascadeDecompositionAnnuel();
    }
  });

  lignesMembreAnnuel(mc: {
    decomposition: LigneDecomposition[];
    cascadeDecomposition: LigneDecomposition[];
    compteDecomposition: LigneDecomposition[];
  }): LigneDecomposition[] {
    switch (this.vueDecomposition()) {
      case 'CATEGORIE': return mc.decomposition;
      case 'COMPTE': return mc.compteDecomposition;
      default: return mc.cascadeDecomposition;
    }
  }

  readonly membresDataAnnuel = computed(() => {
    const ventilation = this.ventilationAnnuelle();
    if (!ventilation) return [];
    const zero: VentilationAggregatDto = { revenus: 0, charges: 0, reserves: 0, soldeDisponible: 0 };
    const categories = this.categories();
    const nbMembres = this.membres().length;
    const scenario = this.contexte.scenarioCourant();
    return this.membres().map((membre) => {
      const agregat: VentilationAggregatDto = (ventilation.parMembre ?? {})[membre.id] ?? zero;
      const tauxEffort = this.decomp.tauxEffort(agregat);
      const chargesParCompte = Object.entries(ventilation.parCompteMembre ?? {})
        .map(([compteId, memMap]) => ({
          id: compteId,
          libelle: this.compteLibelle(compteId),
          montant: memMap[membre.id] ?? 0,
        }))
        .filter((compte) => compte.montant > 0)
        .sort((a, b) => b.montant - a.montant);
      const makeList = (type: TypeCategorie) =>
        categories
          .filter((categorie) => categorie.typePoste === type)
          .map((categorie) => ({ id: categorie.id, libelle: categorie.libelle, montant: this.categorieMontantParMembreAnnuel(categorie.id, membre.id) }))
          .filter((row) => row.montant !== 0)
          .sort((a, b) => b.montant - a.montant);
      return {
        id: membre.id,
        nom: membre.nom,
        couleur: membre.couleur,
        initiales: this.initiales(membre.nom),
        sousTitre: this.decomp.sousTitreQuotePartDefaut(scenario, membre.id),
        agregat,
        tauxEffort,
        decomposition: this.decomp.construireDecomposition({
          revenus: makeList('REVENU'),
          charges: makeList('CHARGE'),
          reserves: makeList('RESERVE'),
        }, this.objectifs()),
        cascadeDecomposition: this.decomp.construireCascadeDecomposition(membre.id, agregat, ventilation, nbMembres),
        compteDecomposition: chargesParCompte.map((compte) => ({
          id: compte.id,
          libelle: compte.libelle,
          montantAbs: compte.montant,
          signe: -1 as const,
          tags: this.decomp.membresTagsCompte(compte.id, this.comptes(), this.membres(), membre.id),
        })),
      };
    });
  });

  readonly mixedChartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: { legend: { display: false } },
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
    plugins: { legend: { display: false } },
    scales: {
      x: { grid: { display: false } },
      y: {
        ticks: { callback: (v: unknown) => this.fmtCompact(Number(v)) },
        grid: { color: 'rgba(128,128,128,0.08)' },
      },
    },
  };

  mixedChartData = computed(() => this.buildFoyerChartData(this.projectionAnnuelle()?.mois));

  membreChartsData = computed(() => {
    const projection = this.projectionAnnuelle();
    if (!projection) return [];
    return this.membres().map((membre) => {
      const moisData = projection.moisParMembre[membre.id];
      return {
        membreId: membre.id,
        nom: membre.nom,
        couleur: membre.couleur,
        data: this.buildMembreChartData(moisData),
        dataReel: this.buildMembreChartData(projection.moisParMembreReel?.[membre.id]),
        mois: this.buildMembreMois(moisData),
        total: this.buildMembreTotal(moisData),
      };
    });
  });

  private buildFoyerChartData(mois: { agregat: AggregatDto }[] | undefined): object {
    if (!mois?.length) return {};
    return {
      labels: this.t.mois,
      datasets: [
        {
          type: 'bar',
          label: this.t.projection.charges,
          backgroundColor: 'rgba(239,68,68,0.75)',
          data: mois.map((m) => m.agregat.charges),
          stack: 'depenses',
        },
        {
          type: 'bar',
          label: this.t.projection.reserves,
          backgroundColor: 'rgba(59,130,246,0.75)',
          data: mois.map((m) => m.agregat.reserves),
          stack: 'depenses',
        },
        {
          type: 'line',
          label: this.t.projection.revenus,
          borderColor: '#22c55e',
          backgroundColor: 'rgba(34,197,94,0.08)',
          data: mois.map((m) => m.agregat.revenus),
          tension: 0.3,
          fill: false,
          pointRadius: 4,
          borderWidth: 2,
        },
      ],
    };
  }

  private buildMembreChartData(moisData: AggregatDto[] | undefined): object {
    if (!moisData?.length) return {};
    return {
      labels: this.t.mois,
      datasets: [
        {
          type: 'bar',
          label: this.t.projection.charges,
          backgroundColor: 'rgba(239,68,68,0.75)',
          data: moisData.map((agregat) => agregat.charges),
          stack: 'depenses',
        },
        {
          type: 'bar',
          label: this.t.projection.reserves,
          backgroundColor: 'rgba(59,130,246,0.75)',
          data: moisData.map((agregat) => agregat.reserves),
          stack: 'depenses',
        },
        {
          type: 'line',
          label: this.t.projection.revenus,
          borderColor: '#22c55e',
          backgroundColor: 'rgba(34,197,94,0.08)',
          data: moisData.map((agregat) => agregat.revenus),
          tension: 0.3,
          fill: false,
          pointRadius: 4,
          borderWidth: 2,
        },
      ],
    };
  }

  private buildMembreMois(moisData: AggregatDto[] | undefined): { numero: number; agregat: AggregatDto }[] {
    return moisData?.map((agregat, index) => ({ numero: index + 1, agregat })) ?? [];
  }

  private buildMembreTotal(moisData: AggregatDto[] | undefined): AggregatDto {
    const zero: AggregatDto = { revenus: 0, charges: 0, reserves: 0, soldeDisponible: 0 };
    if (!moisData?.length) return zero;
    return moisData.reduce((acc, agregat) => ({
      revenus: acc.revenus + agregat.revenus,
      charges: acc.charges + agregat.charges,
      reserves: acc.reserves + agregat.reserves,
      soldeDisponible: acc.soldeDisponible + agregat.soldeDisponible,
    }), zero);
  }

  private buildCompteChartData(chargesParCompte: { id: string; libelle: string; montant: number }[], couleur: string): object {
    return {
      labels: chargesParCompte.map((compte) => compte.libelle),
      datasets: [
        {
          label: this.t.projection.charges,
          data: chargesParCompte.map((compte) => compte.montant),
          backgroundColor: couleur,
          borderRadius: 8,
          maxBarThickness: 22,
        },
      ],
    };
  }

  annualKpis = computed<KpiChip[]>(() => {
    const mois = this.projectionAnnuelle()?.mois ?? [];
    const negatifs = mois.filter((item) => item.agregat.soldeDisponible < 0);
    const plusGrosMois = mois.reduce<{ mois: number; montant: number } | null>((best, item) => {
      const montant = item.agregat.charges + item.agregat.reserves;
      return !best || montant > best.montant ? { mois: item.numero, montant } : best;
    }, null);
    const objectifs = this.objectifsRendus();
    const nbAtteints = objectifs.filter((objectif) => objectif.statut === 'ATTEINT').length;
    return [
      {
        label: this.t.dashboard.moisNegatifs,
        value: `${negatifs.length} / 12`,
        hint: negatifs.length ? negatifs.map((item) => this.formatMoisCourt(item.numero)).join(', ') : this.t.dashboard.statutExcedentaire,
        color: negatifs.length ? 'var(--p-red-500)' : 'var(--p-emerald-600)',
      },
      {
        label: this.t.dashboard.tresorerieCumulee,
        value: this.formatMontant(this.tresorerieCumuleeFin()),
        hint: String(this.annee()),
      },
      {
        label: this.t.dashboard.plusGrosMois,
        value: plusGrosMois ? `${this.formatMoisCourt(plusGrosMois.mois)} · ${this.formatMontant(plusGrosMois.montant)}` : '-',
        hint: plusGrosMois ? this.t.mois[plusGrosMois.mois - 1] : undefined,
      },
      {
        label: this.t.dashboard.nbObjectifs,
        value: objectifs.length,
        hint: `${nbAtteints}/${objectifs.length || 0}`,
      },
    ];
  });

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
    const mois = this.projectionAnnuelle()?.mois ?? [];
    const positifs = mois.filter((item) => item.agregat.soldeDisponible >= 0).length;
    const negatifs = Math.max(mois.length - positifs, 0);
    return [
      { value: positifs, color: 'var(--p-emerald-500)' },
      { value: negatifs, color: 'var(--p-red-500)' },
    ];
  });

  readonly ringCenterAnnee = computed(() => {
    const mois = this.projectionAnnuelle()?.mois ?? [];
    const positifs = mois.filter((item) => item.agregat.soldeDisponible >= 0).length;
    const negatifs = Math.max(mois.length - positifs, 0);
    return `${positifs}-${negatifs}`;
  });

  readonly statsAnnee = computed<StatItem[]>(() => {
    const total = this.projectionAnnuelle()?.totalAnnuel ?? { revenus: 0, charges: 0, reserves: 0, soldeDisponible: 0 };
    const mois = this.projectionAnnuelle()?.mois ?? [];
    const tauxReserve = total.revenus > 0 ? (total.reserves / total.revenus) * 100 : 0;
    const tauxSolde = total.revenus > 0 ? (total.soldeDisponible / total.revenus) * 100 : 0;
    const moisSousSeuil = mois.filter((item) => item.agregat.soldeDisponible < 500).length;
    return [
      {
        label: this.t.dashboard.soldeRestant,
        value: this.formatMontant(total.soldeDisponible),
        color: total.soldeDisponible >= 0 ? 'var(--p-emerald-600)' : 'var(--p-red-500)',
      },
      { label: this.t.dashboard.tauxDeReserve, value: `${this.formatPct(tauxReserve)} %` },
      { label: this.t.dashboard.tauxDeSolde, value: `${this.formatPct(tauxSolde)} %` },
      {
        label: this.t.dashboard.moisSousSeuilRisque,
        value: String(moisSousSeuil),
        color: moisSousSeuil > 0 ? 'var(--p-amber-500)' : undefined,
      },
    ];
  });

  readonly statusAnnee = computed<StatGridStatusTag>(() => {
    const total = this.projectionAnnuelle()?.totalAnnuel ?? { revenus: 0, charges: 0, reserves: 0, soldeDisponible: 0 };
    const moisNegatifs = (this.projectionAnnuelle()?.mois ?? []).filter((item) => item.agregat.soldeDisponible < 0).length;
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
    return mois === undefined
      ? []
      : this.postes().filter((poste) => this.posteActifSurMois(poste, this.annee(), mois));
  });

  readonly chargesSuresMois = computed(() =>
    this.postesActifsMois()
      .filter((poste) => poste.type === 'CHARGE' && poste.nature === 'EFFECTIF')
      .reduce((sum, poste) => sum + Math.abs(poste.montantMensualise ?? poste.montant), 0)
  );

  readonly margeVariableMois = computed(() =>
    this.postesActifsMois()
      .filter((poste) => poste.nature === 'ESTIMATION')
      .reduce((sum, poste) => sum + Math.abs(poste.montantMensualise ?? poste.montant) * ((poste.estimPourcentage ?? 0) / 100), 0)
  );

  readonly ringSegmentsMois = computed<MetricRingSegment[]>(() => {
    const rav = this.ventilations()?.agregat.soldeDisponible ?? 0;
    const marge = this.margeVariableMois();
    return [
      { value: this.chargesSuresMois(), color: 'var(--p-red-400)' },
      { value: marge * 2, color: 'var(--p-amber-400)' },
      { value: this.ventilations()?.agregat.reserves ?? 0, color: 'var(--p-blue-400)' },
      { value: Math.max(rav - marge, 0), color: 'var(--p-emerald-500)' },
    ];
  });

  readonly ringCenterMois = computed(() => this.formatMontant(this.ventilations()?.agregat.soldeDisponible ?? 0));

  readonly statsMois = computed<StatItem[]>(() => {
    const rav = this.ventilations()?.agregat.soldeDisponible ?? 0;
    const marge = this.margeVariableMois();
    const reserves = this.ventilations()?.agregat.reserves ?? 0;
    return [
      { label: this.t.dashboard.chargesSures, value: this.formatMontant(this.chargesSuresMois()) },
      { label: this.t.dashboard.margeVariable, value: `± ${this.formatMontant(marge)}` },
      { label: this.t.dashboard.reserves, value: this.formatMontant(reserves) },
      { label: this.t.dashboard.fourchetteDuMois, value: `${this.formatMontant(rav - marge)} - ${this.formatMontant(rav + marge)}` },
    ];
  });

  readonly statusMois = computed<StatGridStatusTag>(() => {
    const rav = this.ventilations()?.agregat.soldeDisponible ?? 0;
    const marge = this.margeVariableMois();
    if (rav < 0) {
      return { value: this.t.dashboard.statutDeficitaire, severity: 'danger' };
    }
    if (rav - marge < 0) {
      return { value: this.t.dashboard.statutASurveiller, severity: 'warn' };
    }
    return { value: this.t.dashboard.statutEquilibre, severity: 'success' };
  });

  readonly tresorerieCumuleeValeurs = computed(() => {
    const projection = this.projectionAnnuelle();
    const scenario = this.contexte.scenarioCourant();
    if (!projection || !scenario) return [];
    let cumul = scenario.tresorerieInitiale;
    return projection.mois.map((item) => {
      cumul += item.agregat.soldeDisponible;
      return cumul;
    });
  });

  readonly tresorerieCumuleeData = computed(() => {
    const valeurs = this.tresorerieCumuleeValeurs();
    if (!valeurs.length) return {};
    return {
      labels: this.t.mois,
      datasets: [
        {
          type: 'line',
          label: this.t.dashboard.tresorerieCumulee,
          borderColor: '#6366f1',
          backgroundColor: 'rgba(99,102,241,0.12)',
          data: valeurs,
          tension: 0.25,
          fill: true,
          pointRadius: 3,
          borderWidth: 2,
        },
      ],
    };
  });

  private tresorerieCumuleeFin(): number {
    const valeurs = this.tresorerieCumuleeValeurs();
    return valeurs.length ? valeurs[valeurs.length - 1] : this.contexte.scenarioCourant()?.tresorerieInitiale ?? 0;
  }

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

  readonly objectifsRendus = computed(() =>
    this.objectifs().map((objectif) => {
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
    return this.objectifs()
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

  private posteImpactMensuel(poste: PosteDto): number {
    const montant = Math.abs(poste.montantMensualise ?? poste.montant);
    return poste.type === 'REVENU' ? montant : -montant;
  }

  /**
   * Impact affiché pour l'événement "début" d'un poste. Si le poste est issu d'une révision
   * (`posteOrigineId`), affiche l'écart entre l'ancien et le nouveau montant plutôt que le
   * montant brut, avec la même convention de signe/couleur selon le type (revenu = positif/vert,
   * charge ou réserve = négatif/rouge).
   */
  private posteImpactDebut(poste: PosteDto): number {
    const montantNouveau = Math.abs(poste.montantMensualise ?? poste.montant);
    let magnitude = montantNouveau;
    if (poste.posteOrigineId) {
      const origine = this.postes().find((p) => p.id === poste.posteOrigineId);
      if (origine) {
        const montantOrigine = Math.abs(origine.montantMensualise ?? origine.montant);
        magnitude = Math.abs(montantNouveau - montantOrigine);
      }
    }
    return poste.type === 'REVENU' ? magnitude : -magnitude;
  }

  readonly evenementsAnnee = computed<DashboardTimelineItem[]>(() => {
    const annee = this.annee();
    return this.postes()
      .flatMap((poste) => {
        const items: DashboardTimelineItem[] = [];
        if (poste.debut && this.dateDansAnnee(poste.debut, annee)) {
          const debut = parseIsoDateLocal(poste.debut);
          items.push({
            when: this.t.mois[debut.getMonth()],
            emoji: '▶️',
            title: poste.description,
            impact: this.posteImpactDebut(poste),
            meta: this.categorieDepuisPoste(poste),
            mois: debut.getMonth() + 1,
          });
        }
        if (poste.fin && this.dateDansAnnee(poste.fin, annee)) {
          const fin = parseIsoDateLocal(poste.fin);
          items.push({
            when: this.t.mois[fin.getMonth()],
            emoji: '⏹️',
            title: poste.description,
            impact: -this.posteImpactMensuel(poste),
            meta: this.categorieDepuisPoste(poste),
            mois: fin.getMonth() + 1,
          });
        }
        return items;
      })
      .sort((a, b) => a.mois - b.mois || a.title.localeCompare(b.title));
  });

  readonly evenementsMois = computed(() => {
    const mois = this.moisSelectionne();
    return mois === undefined ? [] : this.evenementsAnnee().filter((item) => item.mois === mois);
  });

  private dateDansAnnee(iso: string, annee: number): boolean {
    return parseIsoDateLocal(iso).getFullYear() === annee;
  }

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
    void this.router.navigate(['/f', foyerId, 'dashboard', String(annee)], { queryParamsHandling: 'preserve' });
  }

  private naviguerVersMois(annee: number, mois: number): void {
    const foyerId = this.contexte.foyerId();
    if (!foyerId) return;
    void this.router.navigate(['/f', foyerId, 'dashboard', String(annee), String(mois).padStart(2, '0')], { queryParamsHandling: 'preserve' });
  }

  readonly moisSummary = computed<PageNavMonthSummary[]>(() => {
    const projection = this.projectionAnnuelle();
    if (!projection) {
      return this.t.mois.map((label, index) => ({ mois: index + 1, label: label.slice(0, 3), solde: 0 }));
    }
    return projection.mois.map((mois) => ({
      mois: mois.numero,
      label: this.formatMoisCourt(mois.numero),
      solde: mois.agregat.soldeDisponible,
    }));
  });

  private sommerVentilations(mois: VentilationsDto[]): VentilationLike {
    const agregat: VentilationAggregatDto = { revenus: 0, charges: 0, reserves: 0, soldeDisponible: 0 };
    const parMembre: Record<string, VentilationAggregatDto> = {};
    const parCategorie: Record<string, number> = {};
    const parCategorieMembre: Record<string, Record<string, number>> = {};
    const parCompteMembre: Record<string, Record<string, number>> = {};
    const parMembreSplit: Record<string, VentilationSplitDto> = {};

    for (const ventilation of mois) {
      agregat.revenus += ventilation.agregat.revenus;
      agregat.charges += ventilation.agregat.charges;
      agregat.reserves += ventilation.agregat.reserves;
      agregat.soldeDisponible += ventilation.agregat.soldeDisponible;

      for (const [membreId, data] of Object.entries(ventilation.parMembre ?? {})) {
        const acc = parMembre[membreId] ??= { revenus: 0, charges: 0, reserves: 0, soldeDisponible: 0 };
        acc.revenus += data.revenus;
        acc.charges += data.charges;
        acc.reserves += data.reserves;
        acc.soldeDisponible += data.soldeDisponible;
      }
      for (const [categorieId, montant] of Object.entries(ventilation.parCategorie ?? {})) {
        parCategorie[categorieId] = (parCategorie[categorieId] ?? 0) + montant;
      }
      for (const [categorieId, memMap] of Object.entries(ventilation.parCategorieMembre ?? {})) {
        const acc = parCategorieMembre[categorieId] ??= {};
        for (const [membreId, montant] of Object.entries(memMap)) {
          acc[membreId] = (acc[membreId] ?? 0) + montant;
        }
      }
      for (const [compteId, memMap] of Object.entries(ventilation.parCompteMembre ?? {})) {
        const acc = parCompteMembre[compteId] ??= {};
        for (const [membreId, montant] of Object.entries(memMap)) {
          acc[membreId] = (acc[membreId] ?? 0) + montant;
        }
      }
      for (const [membreId, split] of Object.entries(ventilation.parMembreSplit ?? {})) {
        const acc = parMembreSplit[membreId] ??= {
          revenusPerso: 0,
          revenusPartage: 0,
          chargesPerso: 0,
          chargesPartage: 0,
          reservesPerso: 0,
          reservesPartage: 0,
        };
        acc.revenusPerso += split.revenusPerso;
        acc.revenusPartage += split.revenusPartage;
        acc.chargesPerso += split.chargesPerso;
        acc.chargesPartage += split.chargesPartage;
        acc.reservesPerso += split.reservesPerso;
        acc.reservesPartage += split.reservesPartage;
      }
    }

    return { agregat, parMembre, parCategorie, parCategorieMembre, parCompteMembre, parMembreSplit };
  }
}
