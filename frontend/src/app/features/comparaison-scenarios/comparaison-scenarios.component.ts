import { CommonModule } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, effect, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { forkJoin } from 'rxjs';
import { ButtonModule } from 'primeng/button';
import { CardModule } from 'primeng/card';
import { ContexteService } from '../../core/services/contexte.service';
import { I18nService } from '../../core/i18n/i18n.service';
import { ScenarioService } from '../../core/services/scenario-poste.service';
import { CategorieService } from '../../core/services/referentiel.service';
import { CategorieDto, ScenarioDto } from '../../core/models/api.models';
import { SelectButtonComponent } from '../../shared/components/form-fields';
import { SoldeMensuelChartComponent } from './components/solde-mensuel-chart/solde-mensuel-chart.component';
import { CategoriesEcartTableComponent } from './components/categories-ecart-table/categories-ecart-table.component';
import { CascadeBudgetaireComponent } from './components/cascade-budgetaire/cascade-budgetaire.component';
import { HeatmapEcartComponent } from './components/heatmap-ecart/heatmap-ecart.component';
import { PostesDiffListComponent } from './components/postes-diff-list/postes-diff-list.component';
import { FiltresComparaisonComponent, PerimetreOption } from './components/filtres-comparaison.component';
import { ComparaisonScenariosDataService } from './data/comparaison-scenarios-data.service';
import { Perimetre, ScenarioComparaisonData } from './data/comparaison-scenarios.models';
import {
  anneesCommunes, construireCascade, construireCategoriesEcart, construireHeatmap, construirePostesDiff,
} from './data/comparaison-scenarios.util';

type VueCascade = 'MOIS' | 'ANNEE';
const MOIS_INITIAL = 5; // index 0-11 : mai (feature_5_bis §7)

/**
 * Écran « Comparaison de deux scénarios » (docs/features/feature_5_bis.md).
 *
 * Page smart, seul composant qui appelle le backend et détient l'état
 * (`EtatComparaison`, doc §10). Distribue les données déjà agrégées aux
 * composants dumb : filtres, chart, table, cascade, heatmap, diff.
 *
 * **Layout** : les sections sont empilées verticalement dans des `<p-card>`
 * (pas d'onglets — feature_5_bis §2). Aucune règle moteur réinventée côté
 * front : uniquement de l'assemblage/diff de données agrégées côté serveur.
 *
 * Le composant `IndicateurEcartComponent` (§4) n'est volontairement pas
 * instancié ici (« retiré pour désencombrer l'écran ») ; son contrat reste
 * exposé par le shared kit pour un futur réemploi.
 */
@Component({
  selector: 'app-comparaison-scenarios',
  standalone: true,
  imports: [
    CommonModule, FormsModule, ButtonModule, CardModule, SelectButtonComponent,
    FiltresComparaisonComponent,
    SoldeMensuelChartComponent, CategoriesEcartTableComponent,
    CascadeBudgetaireComponent, HeatmapEcartComponent, PostesDiffListComponent,
  ],
  templateUrl: './comparaison-scenarios.component.html',
  styleUrl: './comparaison-scenarios.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ComparaisonScenariosComponent {
  protected readonly contexte = inject(ContexteService);
  private readonly i18n = inject(I18nService);
  protected readonly t = this.i18n.translations();
  private readonly scenarioSvc = inject(ScenarioService);
  private readonly categorieSvc = inject(CategorieService);
  private readonly dataSvc = inject(ComparaisonScenariosDataService);

  protected readonly scenarios = signal<ScenarioDto[]>([]);
  protected readonly categories = signal<CategorieDto[]>([]);
  protected readonly chargement = signal(false);

  protected readonly scenarioA = signal<ScenarioDto | null>(null);
  protected readonly scenarioB = signal<ScenarioDto | null>(null);
  protected readonly annee = signal<number | null>(null);
  protected readonly perimetre = signal<Perimetre>('foyer');
  protected readonly vueCascade = signal<VueCascade>('ANNEE');
  protected readonly moisCascade = signal(MOIS_INITIAL);

  protected readonly perimetreOptions = computed<PerimetreOption[]>(() => [
    { label: this.t.comparaisonScenarios.filtres.perimetreFoyer, value: 'foyer' as Perimetre },
    ...this.contexte.membres().map(m => ({ label: m.nom, value: m.id as Perimetre })),
  ]);

  protected readonly pasAssezDeScenarios = computed(() => this.scenarios().length < 2);

  protected readonly anneesOptions = computed(() => {
    const a = this.scenarioA();
    const b = this.scenarioB();
    if (!a || !b) return [];
    return anneesCommunes(a, b);
  });

  private readonly donneesA = signal<ScenarioComparaisonData | null>(null);
  private readonly donneesB = signal<ScenarioComparaisonData | null>(null);
  private readonly mensuelA = signal<import('../../core/models/api.models').VentilationsDto[]>([]);
  private readonly mensuelB = signal<import('../../core/models/api.models').VentilationsDto[]>([]);

  protected readonly labelsMois = computed(() => this.t.mois.map(m => m.slice(0, 3)));

  protected readonly cascadeEtapes = computed(() => {
    const a = this.donneesA();
    const b = this.donneesB();
    if (!a || !b) return [];
    const labels = {
      revenus: this.t.comparaisonScenarios.cascade.revenus,
      charges: this.t.comparaisonScenarios.cascade.charges,
      reserves: this.t.comparaisonScenarios.cascade.reserves,
      rav: this.t.comparaisonScenarios.cascade.rav,
      argentPoche: this.t.comparaisonScenarios.cascade.argentPoche,
      soldeDisponible: this.t.comparaisonScenarios.cascade.soldeDisponible,
    };
    if (this.vueCascade() === 'ANNEE') {
      return construireCascade(a.totalAnnuel, b.totalAnnuel, labels);
    }
    return construireCascade(a.moisAgregats[this.moisCascade()], b.moisAgregats[this.moisCascade()], labels);
  });

  protected readonly cascadeEnTete = computed(() => {
    const annee = this.annee() ?? 0;
    if (this.vueCascade() === 'ANNEE') {
      return this.t.comparaisonScenarios.cascade.enTeteAnnee.replace('{annee}', String(annee));
    }
    const mois = this.t.mois[this.moisCascade()] ?? '';
    return this.t.comparaisonScenarios.cascade.enTeteMois
      .replace('{mois}', mois)
      .replace('{annee}', String(annee));
  });

  protected readonly vueCascadeOptions = computed(() => [
    { label: this.t.comparaisonScenarios.cascade.vueMois, value: 'MOIS' as VueCascade },
    { label: this.t.comparaisonScenarios.cascade.vueAnnee, value: 'ANNEE' as VueCascade },
  ]);

  /** Options du sélecteur de mois (feature_5_bis §7) : libellés courts (3 lettres). */
  protected readonly moisOptions = computed(() =>
    this.labelsMois().map((label, index) => ({ label, value: index })));

  protected readonly categoriesEcart = computed(() => {
    const a = this.donneesA();
    const b = this.donneesB();
    if (!a || !b) return [];
    return construireCategoriesEcart(this.categories(), a.parCategorie, b.parCategorie);
  });

  protected readonly postesDiff = computed(() => {
    const a = this.donneesA();
    const b = this.donneesB();
    if (!a || !b) return [];
    const categoriesParId = Object.fromEntries(this.categories().map(c => [c.id, c]));
    return construirePostesDiff(a.postes, b.postes, categoriesParId);
  });

  protected readonly heatmapLignes = computed(() => {
    const a = this.donneesA();
    const b = this.donneesB();
    const mA = this.mensuelA();
    const mB = this.mensuelB();
    if (!a || !b || !mA.length || !mB.length) return [];
    return construireHeatmap(
      this.categories(), mA, mB,
      a.moisAgregats.map(m => m.argentPoche), b.moisAgregats.map(m => m.argentPoche),
      this.perimetre(), this.t.comparaisonScenarios.indicateurs.argentPoche,
    );
  });

  protected readonly devise = computed(() => this.contexte.deviseBase());

  private readonly _chargerReferentiels = effect(() => {
    const foyerId = this.contexte.foyerId();
    if (!foyerId) return;
    this.scenarioSvc.lister(foyerId).subscribe(scenarios => {
      this.scenarios.set(scenarios);
      if (!this.scenarioA()) {
        // Défaut A = scénario de référence (doc feature §3).
        const reference = scenarios.find(s => s.estReference) ?? scenarios[0] ?? null;
        this.scenarioA.set(reference);
        // Défaut B = un autre scénario (doc feature §3).
        const autres = scenarios
          .filter(s => s.id !== reference?.id)
          .sort((a, b) => b.dateModification.localeCompare(a.dateModification));
        this.scenarioB.set(autres[0] ?? reference);
      }
    });
    this.categorieSvc.lister(foyerId).subscribe(categories => this.categories.set(categories));
  });

  private readonly _syncAnnee = effect(() => {
    const options = this.anneesOptions();
    const anneeReference = this.scenarioA()?.anneeDepart;
    if (options.length && !options.includes(this.annee() ?? -1)) {
      this.annee.set(anneeReference !== undefined && options.includes(anneeReference) ? anneeReference : options[0]);
    }
  });

  private readonly _charger = effect(() => {
    const foyerId = this.contexte.foyerId();
    const a = this.scenarioA();
    const b = this.scenarioB();
    const annee = this.annee();
    const perimetre = this.perimetre();
    if (!foyerId || !a || !b || annee === null) return;

    this.chargement.set(true);
    forkJoin({
      donneesA: this.dataSvc.chargerScenario(foyerId, a.id, annee, perimetre),
      donneesB: this.dataSvc.chargerScenario(foyerId, b.id, annee, perimetre),
      mensuelA: this.dataSvc.chargerVentilationsMensuelles(foyerId, a.id, annee),
      mensuelB: this.dataSvc.chargerVentilationsMensuelles(foyerId, b.id, annee),
    }).subscribe({
      next: ({ donneesA, donneesB, mensuelA, mensuelB }) => {
        this.donneesA.set(donneesA);
        this.donneesB.set(donneesB);
        this.mensuelA.set(mensuelA);
        this.mensuelB.set(mensuelB);
        this.chargement.set(false);
      },
      error: () => this.chargement.set(false),
    });
  });

  protected readonly soldesA = computed(() => this.donneesA()?.moisAgregats.map(m => m.soldeDisponible) ?? []);
  protected readonly soldesB = computed(() => this.donneesB()?.moisAgregats.map(m => m.soldeDisponible) ?? []);

  protected changerScenarioA(scenario: ScenarioDto): void {
    if (scenario.id === this.scenarioB()?.id) {
      this.scenarioB.set(this.scenarioA());
    }
    this.scenarioA.set(scenario);
  }

  protected changerScenarioB(scenario: ScenarioDto): void {
    if (scenario.id === this.scenarioA()?.id) {
      this.scenarioA.set(this.scenarioB());
    }
    this.scenarioB.set(scenario);
  }

  protected moisPrecedent(): void {
    this.moisCascade.update(v => (v > 0 ? v - 1 : 11));
  }

  protected moisSuivant(): void {
    this.moisCascade.update(v => (v < 11 ? v + 1 : 0));
  }
}

