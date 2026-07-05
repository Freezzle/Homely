import { Component, inject, signal, computed, OnInit, effect } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { SelectModule } from 'primeng/select';
import { ChartModule } from 'primeng/chart';
import { CardModule } from 'primeng/card';
import { SkeletonModule } from 'primeng/skeleton';
import { ContexteService } from '../../../core/services/contexte.service';
import { ProjectionService } from '../../../core/services/projection.service';
import { CategorieService, CompteService } from '../../../core/services/referentiel.service';
import { VentilationsDto, VentilationAggregatDto, CategorieDto, CompteDto, TypeCategorie } from '../../../core/models/api.models';
import { MontantPipe } from '../../../core/pipes/format.pipes';
import { FR } from '../../../core/i18n/fr';

@Component({
  selector: 'app-dashboard-mensuel',
  standalone: true,
  imports: [CommonModule, FormsModule, SelectModule, ChartModule, CardModule, SkeletonModule, MontantPipe],
  template: `
    <div class="flex flex-col gap-6">

      <!-- En-tête + sélecteurs -->
      <div class="flex items-center gap-4 flex-wrap">
        <h1 class="text-2xl font-bold flex-1">{{ t.nav.dashboardMensuel }}</h1>
        <p-select appendTo="body" [options]="annees" [(ngModel)]="annee"
                  (onChange)="charger()" styleClass="w-28" />
        <p-select appendTo="body" [options]="moisOptions" [(ngModel)]="mois"
                  optionLabel="label" optionValue="value"
                  (onChange)="charger()" styleClass="w-36" />
      </div>

      @if (chargement()) {
        <div class="grid grid-cols-2 md:grid-cols-4 gap-4">
          @for (i of [1,2,3,4]; track i) { <p-skeleton height="80px" /> }
        </div>
        <p-skeleton height="280px" />
        <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
          @for (i of [1,2]; track i) { <p-skeleton height="220px" /> }
        </div>
      } @else if (ventilations()) {

        <!-- ① KPI foyer -->
        <div class="grid grid-cols-2 md:grid-cols-4 gap-4">
          <p-card styleClass="text-center">
            <div class="text-xs text-surface-500 mb-1 uppercase tracking-wide">{{ t.projection.revenus }}</div>
            <div class="text-xl font-bold text-green-600">{{ ventilations()!.agregat.revenus | montant }}</div>
          </p-card>
          <p-card styleClass="text-center">
            <div class="text-xs text-surface-500 mb-1 uppercase tracking-wide">{{ t.projection.charges }}</div>
            <div class="text-xl font-bold text-red-500">{{ ventilations()!.agregat.charges | montant }}</div>
          </p-card>
          <p-card styleClass="text-center">
            <div class="text-xs text-surface-500 mb-1 uppercase tracking-wide">{{ t.projection.reserves }}</div>
            <div class="text-xl font-bold text-blue-500">{{ ventilations()!.agregat.reserves | montant }}</div>
          </p-card>
          <p-card styleClass="text-center">
            <div class="text-xs text-surface-500 mb-1 uppercase tracking-wide">{{ t.projection.solde }}</div>
            <div class="text-xl font-bold"
                 [class.text-green-600]="ventilations()!.agregat.soldeDisponible >= 0"
                 [class.text-red-500]="ventilations()!.agregat.soldeDisponible < 0">
              {{ ventilations()!.agregat.soldeDisponible | montant }}
            </div>
          </p-card>
        </div>

        <!-- ② Ventilations par catégorie (revenus / charges / réserves) -->
        <div class="grid grid-cols-1 md:grid-cols-3 gap-4">

          <!-- Revenus par catégorie -->
          <p-card>
            <ng-template pTemplate="header">
              <div class="px-4 pt-4 pb-2 flex items-center justify-between">
                <span class="font-semibold text-green-600">{{ t.projection.revenus }}</span>
                <span class="text-xs text-surface-400">{{ t.mois[mois - 1] }} {{ annee }}</span>
              </div>
            </ng-template>
            <div class="space-y-0.5">
              @for (row of categoriesParType().revenus; track row.libelle) {
                <div class="flex justify-between text-sm py-1 border-b border-surface-100 dark:border-surface-800">
                  <span class="truncate mr-2 text-surface-700 dark:text-surface-200">{{ row.libelle }}</span>
                  <span class="font-medium text-green-600 shrink-0">{{ row.montant | montant }}</span>
                </div>
              }
              @if (categoriesParType().revenus.length === 0) {
                <div class="text-xs text-surface-400 italic text-center py-3">{{ t.commun.aucunResultat }}</div>
              } @else {
                <div class="flex justify-between text-sm font-bold pt-2">
                  <span>Total</span>
                  <span class="text-green-600">{{ totalParType().revenus | montant }}</span>
                </div>
              }
            </div>
          </p-card>

          <!-- Charges par catégorie -->
          <p-card>
            <ng-template pTemplate="header">
              <div class="px-4 pt-4 pb-2 flex items-center justify-between">
                <span class="font-semibold text-red-500">{{ t.projection.charges }}</span>
                <span class="text-xs text-surface-400">{{ t.mois[mois - 1] }} {{ annee }}</span>
              </div>
            </ng-template>
            <div class="space-y-0.5">
              @for (row of categoriesParType().charges; track row.libelle) {
                <div class="flex justify-between text-sm py-1 border-b border-surface-100 dark:border-surface-800">
                  <span class="truncate mr-2 text-surface-700 dark:text-surface-200">{{ row.libelle }}</span>
                  <span class="font-medium text-red-500 shrink-0">{{ row.montant | montant }}</span>
                </div>
              }
              @if (categoriesParType().charges.length === 0) {
                <div class="text-xs text-surface-400 italic text-center py-3">{{ t.commun.aucunResultat }}</div>
              } @else {
                <div class="flex justify-between text-sm font-bold pt-2">
                  <span>Total</span>
                  <span class="text-red-500">{{ totalParType().charges | montant }}</span>
                </div>
              }
            </div>
          </p-card>

          <!-- Réserves par catégorie -->
          <p-card>
            <ng-template pTemplate="header">
              <div class="px-4 pt-4 pb-2 flex items-center justify-between">
                <span class="font-semibold text-blue-500">{{ t.projection.reserves }}</span>
                <span class="text-xs text-surface-400">{{ t.mois[mois - 1] }} {{ annee }}</span>
              </div>
            </ng-template>
            <div class="space-y-0.5">
              @for (row of categoriesParType().reserves; track row.libelle) {
                <div class="flex justify-between text-sm py-1 border-b border-surface-100 dark:border-surface-800">
                  <span class="truncate mr-2 text-surface-700 dark:text-surface-200">{{ row.libelle }}</span>
                  <span class="font-medium text-blue-500 shrink-0">{{ row.montant | montant }}</span>
                </div>
              }
              @if (categoriesParType().reserves.length === 0) {
                <div class="text-xs text-surface-400 italic text-center py-3">{{ t.commun.aucunResultat }}</div>
              } @else {
                <div class="flex justify-between text-sm font-bold pt-2">
                  <span>Total</span>
                  <span class="text-blue-500">{{ totalParType().reserves | montant }}</span>
                </div>
              }
            </div>
          </p-card>
        </div>

        <!-- ③ Séparateur "Par membre" -->
        <div class="flex items-center gap-3">
          <div class="h-px flex-1 bg-surface-200 dark:bg-surface-700"></div>
          <span class="text-sm font-semibold text-surface-500 uppercase tracking-wider">Par membre</span>
          <div class="h-px flex-1 bg-surface-200 dark:bg-surface-700"></div>
        </div>

        <!-- ③ Cartes par membre -->
        <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
          @for (mc of membresData(); track mc.id) {
            <p-card>
              <ng-template pTemplate="header">
                <div class="px-4 pt-4 pb-2 flex items-center justify-between">
                  <div class="flex items-center gap-2">
                    <span class="inline-block w-3 h-3 rounded-full border border-surface-300"
                          [style.background-color]="mc.couleur"></span>
                    <span class="font-semibold text-lg">{{ mc.nom }}</span>
                  </div>
                  @if (mc.agregat.revenus > 0) {
                    <span class="text-xs px-2 py-0.5 rounded-full font-medium"
                          [class.bg-green-100]="mc.tauxEffort < 50"  [class.text-green-700]="mc.tauxEffort < 50"
                          [class.bg-amber-100]="mc.tauxEffort >= 50 && mc.tauxEffort < 75"
                          [class.text-amber-700]="mc.tauxEffort >= 50 && mc.tauxEffort < 75"
                          [class.bg-red-100]="mc.tauxEffort >= 75"   [class.text-red-700]="mc.tauxEffort >= 75">
                      Effort {{ mc.tauxEffort | number:'1.0-0' }} %
                    </span>
                  }
                </div>
              </ng-template>

              <!-- KPI compacts du membre -->
              <div class="grid grid-cols-4 gap-2 mb-4 text-center">
                <div>
                  <div class="text-xs text-surface-400 mb-0.5">Revenus</div>
                  <div class="text-sm font-bold text-green-600">{{ mc.agregat.revenus | montant }}</div>
                </div>
                <div>
                  <div class="text-xs text-surface-400 mb-0.5">Charges</div>
                  <div class="text-sm font-bold text-red-500">{{ mc.agregat.charges | montant }}</div>
                </div>
                <div>
                  <div class="text-xs text-surface-400 mb-0.5">Réserves</div>
                  <div class="text-sm font-bold text-blue-500">{{ mc.agregat.reserves | montant }}</div>
                </div>
                <div>
                  <div class="text-xs text-surface-400 mb-0.5">Solde</div>
                  <div class="text-sm font-bold"
                       [class.text-green-600]="mc.agregat.soldeDisponible >= 0"
                       [class.text-red-500]="mc.agregat.soldeDisponible < 0">
                    {{ mc.agregat.soldeDisponible | montant }}
                  </div>
                </div>
              </div>

              <!-- Charges du membre par compte -->
              @if (mc.chargesParCompte.length > 0) {
                <div class="text-xs text-surface-400 mb-1 font-medium uppercase tracking-wide">
                  Charges par compte
                </div>
                <p-chart type="bar" [data]="mc.chartData" [options]="membreChartOptions"
                         [style]="'height:' + mc.chartHeight + 'px'" />
              } @else {
                <div class="text-xs text-surface-400 italic text-center py-3">
                  Aucune charge ce mois
                </div>
              }
            </p-card>
          }
        </div>
      }
    </div>
  `,
})
export class DashboardMensuelComponent implements OnInit {
  readonly t = FR;
  private contexte     = inject(ContexteService);
  private projSvc      = inject(ProjectionService);
  private categorieSvc = inject(CategorieService);
  private compteSvc    = inject(CompteService);

  ventilations = signal<VentilationsDto | null>(null);
  categories   = signal<CategorieDto[]>([]);
  comptes      = signal<CompteDto[]>([]);
  chargement   = signal(false);

  annee = new Date().getFullYear();
  mois  = new Date().getMonth() + 1;

  annees: number[]  = Array.from({ length: 9 }, (_, i) => new Date().getFullYear() + i);
  moisOptions       = FR.mois.map((label, i) => ({ label, value: i + 1 }));
  membres           = this.contexte.membres;

  private readonly palette = [
    '#6366f1','#22c55e','#ef4444','#f59e0b',
    '#3b82f6','#ec4899','#14b8a6','#8b5cf6',
    '#f97316','#84cc16','#06b6d4','#a855f7',
  ];

  private readonly fmtCompact = (v: number) =>
    Intl.NumberFormat('fr-CH', { notation: 'compact', maximumFractionDigits: 1 }).format(v);

  // ── Options ─────────────────────────────────────────────────────────────────


  readonly gaugeOptions = {
    rotation: -90, circumference: 180, cutout: '72%',
    responsive: true, maintainAspectRatio: false,
    plugins: { legend: { display: false }, tooltip: { enabled: false } },
  };

  readonly membreChartOptions = {
    indexAxis: 'y' as const,
    responsive: true, maintainAspectRatio: false,
    plugins: { legend: { display: false } },
    scales: { x: { ticks: { callback: (v: number) => this.fmtCompact(v) } } },
  };

  // ── Helpers ─────────────────────────────────────────────────────────────────

  private categorieLibelle(id: string): string {
    return this.categories().find(c => c.id === id)?.libelle ?? id.substring(0, 8) + '…';
  }

  private compteLibelle(id: string): string {
    return this.comptes().find(c => c.id === id)?.libelle ?? id.substring(0, 8) + '…';
  }

  // ── Computed ─────────────────────────────────────────────────────────────────

  /** Taux d'effort foyer (charges / revenus) */
  tauxEffort = computed(() => {
    const ag = this.ventilations()?.agregat;
    if (!ag || ag.revenus <= 0) return 0;
    return Math.min((ag.charges / ag.revenus) * 100, 100);
  });

  /** Demi-donut jauge taux d'effort */
  gaugeChartData = computed(() => {
    const t = this.tauxEffort();
    const color = t < 50 ? '#22c55e' : t < 75 ? '#f59e0b' : '#ef4444';
    return { datasets: [{ data: [t, 100 - t], backgroundColor: [color, '#e5e7eb'], borderWidth: 0 }] };
  });

  /** Listes de catégories ventilées par type (REVENU / CHARGE / RESERVE) */
  categoriesParType = computed(() => {
    const v = this.ventilations();
    const cats = this.categories();
    const makeList = (type: TypeCategorie) =>
      cats
        .filter(c => c.typePoste === type)
        .map(c => ({ libelle: c.libelle, montant: (v?.parCategorie as Record<string, number>)?.[c.id] ?? 0 }))
        .filter(r => r.montant !== 0)
        .sort((a, b) => b.montant - a.montant);
    return {
      revenus:  makeList('REVENU'),
      charges:  makeList('CHARGE'),
      reserves: makeList('RESERVE'),
    };
  });

  /** Totaux par type pour la ligne de total */
  totalParType = computed(() => {
    const d = this.categoriesParType();
    const sum = (rows: { montant: number }[]) => rows.reduce((s, r) => s + r.montant, 0);
    return { revenus: sum(d.revenus), charges: sum(d.charges), reserves: sum(d.reserves) };
  });

  /** Données enrichies par membre : KPIs + barres par compte + taux effort individuel */
  membresData = computed(() => {
    const v = this.ventilations();
    if (!v) return [];
    const zero: VentilationAggregatDto = { revenus: 0, charges: 0, reserves: 0, soldeDisponible: 0 };
    return this.membres().map(m => {
      const agregat: VentilationAggregatDto = v.parMembre[m.id] ?? zero;
      const tauxEffort = agregat.revenus > 0
        ? Math.min((agregat.charges / agregat.revenus) * 100, 100)
        : 0;
      const chargesParCompte = Object.entries(v.parCompteMembre)
        .map(([compteId, memMap]) => ({
          libelle: this.compteLibelle(compteId),
          montant: memMap[m.id] ?? 0,
        }))
        .filter(c => c.montant > 0)
        .sort((a, b) => b.montant - a.montant);

      return {
        id: m.id, nom: m.nom, couleur: m.couleur,
        agregat, tauxEffort, chargesParCompte,
        chartHeight: Math.max(chargesParCompte.length * 36 + 16, 56),
        chartData: {
          labels: chargesParCompte.map(c => c.libelle),
          datasets: [{
            data: chargesParCompte.map(c => c.montant),
            backgroundColor: this.palette.slice(0, chargesParCompte.length),
            borderRadius: 3, borderWidth: 0,
          }],
        },
      };
    });
  });

  // ── Effets & chargement ──────────────────────────────────────────────────────

  private readonly _initEffect = effect(() => {
    const sc      = this.contexte.scenarioCourant();
    const foyerId = this.contexte.foyerId();
    if (sc) {
      this.annees = Array.from({ length: sc.horizonAnnees }, (_, i) => sc.anneeDepart + i);
      this.annee  = sc.anneeDepart;
    }
    if (foyerId && sc) {
      this.categorieSvc.lister(foyerId).subscribe(c => this.categories.set(c));
      this.compteSvc.lister(foyerId).subscribe(c => this.comptes.set(c));
      this.charger();
    }
  });

  ngOnInit(): void {}

  /** Un seul appel API par changement de mois (plus de projectionAnnuelle redondante) */
  charger(): void {
    const foyerId    = this.contexte.foyerId();
    const scenarioId = this.contexte.scenarioId();
    if (!foyerId || !scenarioId) return;
    this.chargement.set(true);
    this.projSvc.mensuelle(foyerId, scenarioId, this.annee, this.mois).subscribe({
      next: v => { this.ventilations.set(v); this.chargement.set(false); },
      error: () => this.chargement.set(false),
    });
  }
}
