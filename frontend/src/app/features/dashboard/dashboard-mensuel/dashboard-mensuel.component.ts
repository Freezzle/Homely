import { Component, inject, signal, computed, OnInit, effect } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { SelectModule } from 'primeng/select';
import { ChartModule } from 'primeng/chart';
import { CardModule } from 'primeng/card';
import { SkeletonModule } from 'primeng/skeleton';
import { forkJoin } from 'rxjs';
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

      <!-- ── En-tête + sélecteurs ──────────────────────────────────────────── -->
      <div class="flex flex-col sm:flex-row sm:items-center gap-3">
        <div class="flex-1 min-w-0">
          <h1 class="text-2xl font-bold">{{ t.nav.dashboardMensuel }}</h1>
          <p class="text-sm text-surface-500 mt-0.5">
            Ventilation détaillée de {{ t.mois[mois - 1] }} {{ annee }}
          </p>
        </div>
        <div class="flex gap-2 shrink-0">
          <p-select appendTo="body" [options]="annees" [(ngModel)]="annee"
                    (onChange)="charger()" styleClass="w-28" />
          <p-select appendTo="body" [options]="moisOptions" [(ngModel)]="mois"
                    optionLabel="label" optionValue="value"
                    (onChange)="charger()" styleClass="w-36" />
        </div>
      </div>

      <!-- ── Skeletons ─────────────────────────────────────────────────────── -->
      @if (chargement()) {
        <div class="grid grid-cols-2 lg:grid-cols-4 gap-4">
          @for (i of [1,2,3,4]; track i) { <p-skeleton height="104px" borderRadius="12px" /> }
        </div>
        <p-skeleton height="80px" borderRadius="12px" />
        <div class="grid grid-cols-1 sm:grid-cols-3 gap-4">
          @for (i of [1,2,3]; track i) { <p-skeleton height="260px" borderRadius="12px" /> }
        </div>
        <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
          @for (i of [1,2]; track i) { <p-skeleton height="240px" borderRadius="12px" /> }
        </div>

      } @else if (ventilations()) {

        <!-- ① KPI foyer — 2 cols mobile · 4 cols desktop ───────────────────── -->
        <div class="grid grid-cols-2 lg:grid-cols-4 gap-4">

          <p-card styleClass="border-l-4 border-green-500">
            <div class="flex items-start justify-between gap-2">
              <div class="min-w-0">
                <div class="text-xs font-semibold text-surface-400 uppercase tracking-wide mb-2">{{ t.projection.revenus }}</div>
                <div class="text-xl font-bold text-green-600 truncate">{{ ventilations()!.agregat.revenus | montant }}</div>
                <div class="text-xs text-surface-400 mt-1.5">{{ t.mois[mois - 1] }} {{ annee }}</div>
              </div>
              <span class="w-9 h-9 rounded-full bg-green-100 dark:bg-green-900/20 flex items-center justify-center shrink-0 mt-0.5">
                <i class="pi pi-arrow-up text-green-600 text-xs"></i>
              </span>
            </div>
          </p-card>

          <p-card styleClass="border-l-4 border-red-500">
            <div class="flex items-start justify-between gap-2">
              <div class="min-w-0">
                <div class="text-xs font-semibold text-surface-400 uppercase tracking-wide mb-2">{{ t.projection.charges }}</div>
                <div class="text-xl font-bold text-red-500 truncate">{{ ventilations()!.agregat.charges | montant }}</div>
                <div class="text-xs text-surface-400 mt-1.5">{{ t.mois[mois - 1] }} {{ annee }}</div>
              </div>
              <span class="w-9 h-9 rounded-full bg-red-100 dark:bg-red-900/20 flex items-center justify-center shrink-0 mt-0.5">
                <i class="pi pi-arrow-down text-red-500 text-xs"></i>
              </span>
            </div>
          </p-card>

          <p-card styleClass="border-l-4 border-blue-500">
            <div class="flex items-start justify-between gap-2">
              <div class="min-w-0">
                <div class="text-xs font-semibold text-surface-400 uppercase tracking-wide mb-2">{{ t.projection.reserves }}</div>
                <div class="text-xl font-bold text-blue-500 truncate">{{ ventilations()!.agregat.reserves | montant }}</div>
                <div class="text-xs text-surface-400 mt-1.5">{{ t.mois[mois - 1] }} {{ annee }}</div>
              </div>
              <span class="w-9 h-9 rounded-full bg-blue-100 dark:bg-blue-900/20 flex items-center justify-center shrink-0 mt-0.5">
                <i class="pi pi-wallet text-blue-500 text-xs"></i>
              </span>
            </div>
          </p-card>

          <p-card [styleClass]="'border-l-4 ' + soldeCardBorder()">
            <div class="flex items-start justify-between gap-2">
              <div class="min-w-0">
                <div class="text-xs font-semibold text-surface-400 uppercase tracking-wide mb-2">{{ t.projection.solde }}</div>
                <div class="text-xl font-bold truncate"
                     [class.text-emerald-600]="ventilations()!.agregat.soldeDisponible >= 0"
                     [class.text-red-500]="ventilations()!.agregat.soldeDisponible < 0">
                  {{ ventilations()!.agregat.soldeDisponible | montant }}
                </div>
                <div class="text-xs text-surface-400 mt-1.5">{{ t.mois[mois - 1] }} {{ annee }}</div>
              </div>
              <span class="w-9 h-9 rounded-full flex items-center justify-center shrink-0 mt-0.5"
                    [ngClass]="ventilations()!.agregat.soldeDisponible >= 0
                      ? 'bg-emerald-100 dark:bg-emerald-900/20'
                      : 'bg-red-100 dark:bg-red-900/20'">
                <i class="pi text-xs"
                   [ngClass]="ventilations()!.agregat.soldeDisponible >= 0
                     ? 'pi-check-circle text-emerald-600'
                     : 'pi-exclamation-triangle text-red-500'"></i>
              </span>
            </div>
          </p-card>
        </div>

        <!-- ② Taux d'effort — barre de progression visuelle ─────────────────── -->
        <p-card>
          <div class="flex flex-col gap-2">
            <div class="flex items-center justify-between">
              <div>
                <span class="text-sm font-semibold text-surface-700 dark:text-surface-200">Taux d'effort du foyer</span>
                <span class="text-xs text-surface-400 ml-2">charges / revenus du mois</span>
              </div>
               <span class="text-base font-bold px-2.5 py-0.5 rounded-lg"
                     [class.text-green-700]="tauxEffort() < 50"
                     [class.bg-green-100]="tauxEffort() < 50"
                     [class.text-amber-700]="tauxEffort() >= 50 && tauxEffort() < 75"
                     [class.bg-amber-100]="tauxEffort() >= 50 && tauxEffort() < 75"
                     [class.text-red-700]="tauxEffort() >= 75"
                     [class.bg-red-100]="tauxEffort() >= 75">
                 {{ tauxEffortStr() }}&thinsp;%
              </span>
            </div>
            <div class="w-full h-3 bg-surface-100 dark:bg-surface-700 rounded-full overflow-hidden">
              <div class="h-full rounded-full transition-all duration-500"
                     [style.width.%]="tauxEffort()"
                    [class.bg-green-500]="tauxEffort() < 50"
                    [class.bg-amber-400]="tauxEffort() >= 50 && tauxEffort() < 75"
                    [class.bg-red-500]="tauxEffort() >= 75">
              </div>
            </div>
            <div class="flex justify-between text-xs text-surface-400">
              <span>0 %</span>
              <span class="text-amber-500 font-medium">50 %</span>
              <span class="text-red-500 font-medium">75 %</span>
              <span>100 %</span>
            </div>
          </div>
        </p-card>

        <!-- ③ Ventilations par catégorie — 1 col mobile · 3 cols sm+ ─────────── -->
        <div class="grid grid-cols-1 sm:grid-cols-3 gap-4">

          <!-- Revenus -->
          <p-card>
            <ng-template pTemplate="header">
              <div class="px-4 pt-4 pb-2 flex items-center justify-between">
                <div class="flex items-center gap-2">
                  <span class="w-2.5 h-2.5 rounded-full bg-green-500 inline-block shrink-0"></span>
                  <span class="font-semibold text-green-600">{{ t.projection.revenus }}</span>
                </div>
                <span class="text-xs text-surface-400">{{ t.mois[mois - 1] }} {{ annee }}</span>
              </div>
            </ng-template>
            <div class="space-y-0.5">
              @for (row of categoriesParType().revenus; track row.libelle) {
                <div class="flex justify-between items-center text-sm py-1.5 border-b border-surface-100 dark:border-surface-800 last:border-0">
                  <span class="truncate mr-3 text-surface-700 dark:text-surface-200">{{ row.libelle }}</span>
                  <span class="font-semibold text-green-600 shrink-0 tabular-nums">{{ row.montant | montant }}</span>
                </div>
              }
              @if (categoriesParType().revenus.length === 0) {
                <div class="text-xs text-surface-400 italic text-center py-4">{{ t.commun.aucunResultat }}</div>
              } @else {
                <div class="flex justify-between text-sm font-bold pt-2 mt-1 border-t-2 border-green-200 dark:border-green-900">
                  <span>Total</span>
                  <span class="text-green-600 tabular-nums">{{ totalParType().revenus | montant }}</span>
                </div>
              }
            </div>
          </p-card>

          <!-- Charges -->
          <p-card>
            <ng-template pTemplate="header">
              <div class="px-4 pt-4 pb-2 flex items-center justify-between">
                <div class="flex items-center gap-2">
                  <span class="w-2.5 h-2.5 rounded-full bg-red-500 inline-block shrink-0"></span>
                  <span class="font-semibold text-red-500">{{ t.projection.charges }}</span>
                </div>
                <span class="text-xs text-surface-400">{{ t.mois[mois - 1] }} {{ annee }}</span>
              </div>
            </ng-template>
            <div class="space-y-0.5">
              @for (row of categoriesParType().charges; track row.libelle) {
                <div class="flex justify-between items-center text-sm py-1.5 border-b border-surface-100 dark:border-surface-800 last:border-0">
                  <span class="truncate mr-3 text-surface-700 dark:text-surface-200">{{ row.libelle }}</span>
                  <span class="font-semibold text-red-500 shrink-0 tabular-nums">{{ row.montant | montant }}</span>
                </div>
              }
              @if (categoriesParType().charges.length === 0) {
                <div class="text-xs text-surface-400 italic text-center py-4">{{ t.commun.aucunResultat }}</div>
              } @else {
                <div class="flex justify-between text-sm font-bold pt-2 mt-1 border-t-2 border-red-200 dark:border-red-900">
                  <span>Total</span>
                  <span class="text-red-500 tabular-nums">{{ totalParType().charges | montant }}</span>
                </div>
              }
            </div>
          </p-card>

          <!-- Réserves -->
          <p-card>
            <ng-template pTemplate="header">
              <div class="px-4 pt-4 pb-2 flex items-center justify-between">
                <div class="flex items-center gap-2">
                  <span class="w-2.5 h-2.5 rounded-full bg-blue-500 inline-block shrink-0"></span>
                  <span class="font-semibold text-blue-500">{{ t.projection.reserves }}</span>
                </div>
                <span class="text-xs text-surface-400">{{ t.mois[mois - 1] }} {{ annee }}</span>
              </div>
            </ng-template>
            <div class="space-y-0.5">
              @for (row of categoriesParType().reserves; track row.libelle) {
                <div class="flex justify-between items-center text-sm py-1.5 border-b border-surface-100 dark:border-surface-800 last:border-0">
                  <span class="truncate mr-3 text-surface-700 dark:text-surface-200">{{ row.libelle }}</span>
                  <span class="font-semibold text-blue-500 shrink-0 tabular-nums">{{ row.montant | montant }}</span>
                </div>
              }
              @if (categoriesParType().reserves.length === 0) {
                <div class="text-xs text-surface-400 italic text-center py-4">{{ t.commun.aucunResultat }}</div>
              } @else {
                <div class="flex justify-between text-sm font-bold pt-2 mt-1 border-t-2 border-blue-200 dark:border-blue-900">
                  <span>Total</span>
                  <span class="text-blue-500 tabular-nums">{{ totalParType().reserves | montant }}</span>
                </div>
              }
            </div>
          </p-card>
        </div>

        <!-- ④ Par membre — 2 colonnes, toujours visibles ────────────────────── -->
        <div>
          <div class="flex items-center gap-3 mb-4">
            <div class="h-px flex-1 bg-surface-200 dark:bg-surface-700"></div>
            <span class="text-xs font-bold text-surface-400 uppercase tracking-widest flex items-center gap-2">
              <i class="pi pi-users text-sm"></i>&nbsp;Par membre
            </span>
            <div class="h-px flex-1 bg-surface-200 dark:bg-surface-700"></div>
          </div>

          <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
            @for (mc of membresData(); track mc.id) {
              <p-card>
                <ng-template pTemplate="header">
                  <div class="px-4 pt-4 pb-2 flex items-center justify-between">
                    <div class="flex items-center gap-2">
                      <span class="inline-block w-4 h-4 rounded-full border-2 border-surface-0 shadow"
                            [style.background-color]="mc.couleur"></span>
                      <span class="font-semibold text-base">{{ mc.nom }}</span>
                    </div>
                    @if (mc.agregat.revenus > 0) {
                      <span class="text-xs px-2.5 py-0.5 rounded-full font-semibold"
                     [class.bg-green-100]="mc.tauxEffort < 50"
                             [class.text-green-700]="mc.tauxEffort < 50"
                             [class.bg-amber-100]="mc.tauxEffort >= 50 && mc.tauxEffort < 75"
                             [class.text-amber-700]="mc.tauxEffort >= 50 && mc.tauxEffort < 75"
                             [class.bg-red-100]="mc.tauxEffort >= 75"
                             [class.text-red-700]="mc.tauxEffort >= 75">
                         Effort {{ mc.tauxEffortStr }}&thinsp;%
                      </span>
                    }
                  </div>
                </ng-template>

                <!-- KPI 2×2 -->
                <div class="grid grid-cols-2 gap-2 mb-4">
                  <div class="text-center p-2 rounded-lg bg-surface-50 dark:bg-surface-800">
                    <div class="text-xs text-surface-400 mb-0.5">Revenus</div>
                    <div class="text-sm font-bold text-green-600 tabular-nums">{{ mc.agregat.revenus | montant }}</div>
                  </div>
                  <div class="text-center p-2 rounded-lg bg-surface-50 dark:bg-surface-800">
                    <div class="text-xs text-surface-400 mb-0.5">Charges</div>
                    <div class="text-sm font-bold text-red-500 tabular-nums">{{ mc.agregat.charges | montant }}</div>
                  </div>
                  <div class="text-center p-2 rounded-lg bg-surface-50 dark:bg-surface-800">
                    <div class="text-xs text-surface-400 mb-0.5">Réserves</div>
                    <div class="text-sm font-bold text-blue-500 tabular-nums">{{ mc.agregat.reserves | montant }}</div>
                  </div>
                  <div class="text-center p-2 rounded-lg bg-surface-50 dark:bg-surface-800">
                    <div class="text-xs text-surface-400 mb-0.5">Solde</div>
                    <div class="text-sm font-bold tabular-nums"
                         [class.text-emerald-600]="mc.agregat.soldeDisponible >= 0"
                         [class.text-red-500]="mc.agregat.soldeDisponible < 0">
                      {{ mc.agregat.soldeDisponible | montant }}
                    </div>
                  </div>
                </div>

                <!-- Graphique charges par compte -->
                @if (mc.chargesParCompte.length > 0) {
                  <div class="text-xs font-semibold text-surface-400 uppercase tracking-wide mb-2">
                    Charges par compte
                  </div>
                  <p-chart type="bar" [data]="mc.chartData" [options]="membreChartOptions"
                           [style]="'height:' + mc.chartHeight + 'px'" class="w-full block" />
                } @else {
                  <div class="text-xs text-surface-400 italic text-center py-3">
                    Aucune charge ce mois
                  </div>
                }
              </p-card>
            }
          </div>
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

  // membres provient du contexte global (chargé par le Shell)
  readonly membres = this.contexte.membres;

  annee = new Date().getFullYear();
  mois  = new Date().getMonth() + 1;

  annees: number[]  = Array.from({ length: 9 }, (_, i) => new Date().getFullYear() + i);
  moisOptions       = FR.mois.map((label, i) => ({ label, value: i + 1 }));

  private readonly palette = [
    '#6366f1','#22c55e','#ef4444','#f59e0b',
    '#3b82f6','#ec4899','#14b8a6','#8b5cf6',
    '#f97316','#84cc16','#06b6d4','#a855f7',
  ];

  private readonly fmtCompact = (v: number) =>
    Intl.NumberFormat('fr-CH', { notation: 'compact', maximumFractionDigits: 1 }).format(v);

  formatPct(v: number): string {
    return Intl.NumberFormat('fr-CH', { minimumFractionDigits: 0, maximumFractionDigits: 1 }).format(v);
  }

  // ── Helpers ─────────────────────────────────────────────────────────────────

  soldeCardBorder = computed(() =>
    (this.ventilations()?.agregat.soldeDisponible ?? 0) >= 0
      ? 'border-emerald-500'
      : 'border-red-500'
  );

  private compteLibelle(id: string): string {
    return this.comptes().find(c => c.id === id)?.libelle ?? id.substring(0, 8) + '…';
  }

  // ── Options Chart.js ─────────────────────────────────────────────────────────

  readonly membreChartOptions = {
    indexAxis: 'y' as const,
    responsive: true, maintainAspectRatio: false,
    plugins: { legend: { display: false } },
    scales: {
      x: {
        ticks: { callback: (v: any) => this.fmtCompact(Number(v)) },
        grid:  { color: 'rgba(128,128,128,0.08)' },
      },
      y: { grid: { display: false } },
    },
  };

  // ── Computed ─────────────────────────────────────────────────────────────────

  tauxEffort = computed(() => {
    const ag = this.ventilations()?.agregat;
    if (!ag || ag.revenus <= 0) return 0;
    return Math.min((ag.charges / ag.revenus) * 100, 100);
  });

  tauxEffortStr = computed(() => this.formatPct(this.tauxEffort()));

  categoriesParType = computed(() => {
    const v    = this.ventilations();
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

  totalParType = computed(() => {
    const d   = this.categoriesParType();
    const sum = (rows: { montant: number }[]) => rows.reduce((s, r) => s + r.montant, 0);
    return { revenus: sum(d.revenus), charges: sum(d.charges), reserves: sum(d.reserves) };
  });

  membresData = computed(() => {
    const v = this.ventilations();
    if (!v) return [];
    const zero: VentilationAggregatDto = { revenus: 0, charges: 0, reserves: 0, soldeDisponible: 0 };
    return this.membres().map(m => {
      const agregat: VentilationAggregatDto = (v.parMembre ?? {})[m.id] ?? zero;
        const tauxEffort = agregat.revenus > 0
        ? Math.min((agregat.charges / agregat.revenus) * 100, 100)
        : 0;
      const tauxEffortStr = this.formatPct(tauxEffort);
      const chargesParCompte = Object.entries(v.parCompteMembre ?? {})
        .map(([compteId, memMap]) => ({
          libelle: this.compteLibelle(compteId),
          montant: memMap[m.id] ?? 0,
        }))
        .filter(c => c.montant > 0)
        .sort((a, b) => b.montant - a.montant);

      return {
        id: m.id, nom: m.nom, couleur: m.couleur,
        agregat, tauxEffort, tauxEffortStr, chargesParCompte,
        chartHeight: Math.max(chargesParCompte.length * 38 + 16, 56),
        chartData: {
          labels: chargesParCompte.map(c => c.libelle),
          datasets: [{
            data: chargesParCompte.map(c => c.montant),
            backgroundColor: this.palette.slice(0, chargesParCompte.length),
            borderRadius: 4, borderWidth: 0,
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
      forkJoin([
        this.categorieSvc.lister(foyerId),
        this.compteSvc.lister(foyerId),
      ]).subscribe(([cats, cptes]) => {
        this.categories.set(cats);
        this.comptes.set(cptes);
        this.charger();
      });
    }
  });

  ngOnInit(): void {}

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
