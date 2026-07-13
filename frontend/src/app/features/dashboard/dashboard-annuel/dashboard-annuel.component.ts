import { Component, inject, signal, computed, OnInit, effect } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { SelectModule } from 'primeng/select';
import { SelectButtonModule } from 'primeng/selectbutton';
import { TableModule } from 'primeng/table';
import { ChartModule } from 'primeng/chart';
import { SkeletonModule } from 'primeng/skeleton';
import { CardModule } from 'primeng/card';
import { ContexteService } from '../../../core/services/contexte.service';
import { ProjectionService } from '../../../core/services/projection.service';
import { ProjectionAnnuelleDto, AggregatDto } from '../../../core/models/api.models';
import { MontantPipe } from '../../../core/pipes/format.pipes';
import { FR } from '../../../core/i18n/fr';

@Component({
  selector: 'app-dashboard-annuel',
  standalone: true,
  imports: [CommonModule, FormsModule, SelectModule, SelectButtonModule, TableModule, ChartModule,
            SkeletonModule, CardModule, MontantPipe],
  template: `
    <div class="flex flex-col gap-6">

      <!-- ── En-tête ───────────────────────────────────────────────────────── -->
      <div class="flex flex-col sm:flex-row sm:items-center gap-3">
        <div class="flex-1 min-w-0">
          <h1 class="text-2xl font-bold">{{ t.nav.dashboardAnnuel }}</h1>
          <p class="text-sm text-surface-500 mt-0.5">Vue consolidée des flux annuels du foyer</p>
        </div>
        @if (afficherParMembre()) {
          <p-selectButton [options]="vueOptions" [ngModel]="vue()" (ngModelChange)="vue.set($event)"
                          optionLabel="label" optionValue="value" [allowEmpty]="false"
                          styleClass="shrink-0" />
        }
        <p-select appendTo="body" [options]="annees" [(ngModel)]="anneeSelectionnee"
                  (onChange)="charger()" styleClass="w-32 shrink-0" />
      </div>

      <!-- ── Skeletons ─────────────────────────────────────────────────────── -->
      @if (chargement()) {
        <div class="grid grid-cols-2 lg:grid-cols-4 gap-4">
          @for (i of [1,2,3,4]; track i) { <p-skeleton height="104px" borderRadius="12px" /> }
        </div>
        <p-skeleton height="340px" borderRadius="12px" />
        <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
          @for (i of [1,2]; track i) { <p-skeleton height="260px" borderRadius="12px" /> }
        </div>
        <p-skeleton height="400px" borderRadius="12px" />

      } @else if (projection()) {

        <!-- ① KPI annuels — 2 cols mobile · 4 cols desktop ─────────────────── -->
        <div class="grid grid-cols-2 lg:grid-cols-4 gap-4">

          <p-card styleClass="border-l-4 border-green-500">
            <div class="flex items-start justify-between gap-2">
              <div class="min-w-0">
                <div class="text-xs font-semibold text-surface-400 uppercase tracking-wide mb-2">{{ t.projection.revenus }}</div>
                <div class="text-xl font-bold text-green-600 truncate">{{ projection()!.totalAnnuel.revenus | montant }}</div>
                <div class="text-xs text-surface-400 mt-1.5">≈ {{ fmtMensuel(projection()!.totalAnnuel.revenus) }}&thinsp;/&thinsp;mois</div>
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
                <div class="text-xl font-bold text-red-500 truncate">{{ projection()!.totalAnnuel.charges | montant }}</div>
                <div class="text-xs text-surface-400 mt-1.5">≈ {{ fmtMensuel(projection()!.totalAnnuel.charges) }}&thinsp;/&thinsp;mois</div>
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
                <div class="text-xl font-bold text-blue-500 truncate">{{ projection()!.totalAnnuel.reserves | montant }}</div>
                <div class="text-xs text-surface-400 mt-1.5">≈ {{ fmtMensuel(projection()!.totalAnnuel.reserves) }}&thinsp;/&thinsp;mois</div>
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
                     [class.text-emerald-600]="projection()!.totalAnnuel.soldeDisponible >= 0"
                     [class.text-red-500]="projection()!.totalAnnuel.soldeDisponible < 0">
                  {{ projection()!.totalAnnuel.soldeDisponible | montant }}
                </div>
                <div class="text-xs text-surface-400 mt-1.5">≈ {{ fmtMensuel(projection()!.totalAnnuel.soldeDisponible) }}&thinsp;/&thinsp;mois</div>
              </div>
              <span class="w-9 h-9 rounded-full flex items-center justify-center shrink-0 mt-0.5"
                    [ngClass]="projection()!.totalAnnuel.soldeDisponible >= 0
                      ? 'bg-emerald-100 dark:bg-emerald-900/20'
                      : 'bg-red-100 dark:bg-red-900/20'">
                <i class="pi text-xs"
                   [ngClass]="projection()!.totalAnnuel.soldeDisponible >= 0
                     ? 'pi-check-circle text-emerald-600'
                     : 'pi-exclamation-triangle text-red-500'"></i>
              </span>
            </div>
          </p-card>
        </div>

        <!-- ② Graphique mixte foyer — pleine largeur ────────────────────────── -->
        @if (vue() !== 'MEMBRE') {
        <p-card>
          <ng-template pTemplate="header">
            <div class="px-5 pt-5 pb-0 flex flex-col sm:flex-row sm:items-start gap-2 sm:gap-4">
              <div class="flex-1">
                <div class="font-semibold text-base">Flux mensuels {{ anneeSelectionnee }}</div>
                <div class="text-xs text-surface-400 mt-0.5">Barres empilées = charges + réserves · Ligne verte = revenus</div>
              </div>
              <div class="flex flex-wrap gap-3 text-xs text-surface-500 shrink-0">
                <span class="flex items-center gap-1.5">
                  <span class="inline-block w-3 h-3 rounded bg-red-400 opacity-80"></span>{{ t.projection.charges }}
                </span>
                <span class="flex items-center gap-1.5">
                  <span class="inline-block w-3 h-3 rounded bg-blue-400 opacity-80"></span>{{ t.projection.reserves }}
                </span>
                <span class="flex items-center gap-1.5">
                  <span class="inline-block w-5 h-0.5 bg-green-500 rounded mt-px"></span>{{ t.projection.revenus }}
                </span>
              </div>
            </div>
          </ng-template>
          <div class="pt-4">
            <p-chart type="bar" [data]="mixedChartData()" [options]="mixedChartOptions"
                     class="w-full block" style="height:320px" />
          </div>
        </p-card>
        }

        <!-- ③ Graphiques par membre — 2 colonnes, toujours visibles ──────────── -->
        @if (afficherParMembre() && vue() !== 'FOYER') {
        <div>
          <div class="flex items-center gap-3 mb-4">
            <div class="h-px flex-1 bg-surface-200 dark:bg-surface-700"></div>
            <span class="text-xs font-bold text-surface-400 uppercase tracking-widest flex items-center gap-2">
              <i class="pi pi-users text-sm"></i>&nbsp;Contribution par membre
            </span>
            <div class="h-px flex-1 bg-surface-200 dark:bg-surface-700"></div>
          </div>
          <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
            @for (mc of membreChartsData(); track mc.membreId) {
              <p-card>
                <ng-template pTemplate="header">
                  <div class="px-5 pt-4 pb-2 flex items-center gap-3">
                    <span class="inline-block w-4 h-4 rounded-full border-2 border-surface-0 shadow"
                          [style.background-color]="mc.couleur"></span>
                    <span class="font-semibold">{{ mc.nom }}</span>
                    <span class="ml-auto text-xs text-surface-400">{{ anneeSelectionnee }}</span>
                  </div>
                </ng-template>
                <p-chart type="bar" [data]="mc.data" [options]="mixedChartOptions"
                         class="w-full block" style="height:220px" />

                <!-- Détail mensuel par membre -->
                <div class="mt-4">
                  <div class="text-xs font-semibold text-surface-400 uppercase tracking-wide mb-2 flex items-center gap-1.5">
                    <i class="pi pi-table text-xs"></i>{{ t.projection.detailMensuelParMembre }}
                  </div>

                  <!-- Desktop / tablette : table scrollable -->
                  <div class="hidden sm:block overflow-x-auto">
                    <p-table [value]="mc.mois" styleClass="p-datatable-sm p-datatable-striped" scrollable>
                      <ng-template pTemplate="header">
                        <tr>
                          <th class="min-w-14">{{ t.projection.mois }}</th>
                          <th class="text-right">{{ t.projection.revenus }}</th>
                          <th class="text-right">{{ t.projection.charges }}</th>
                          <th class="text-right">{{ t.projection.reserves }}</th>
                          <th class="text-right">{{ t.projection.solde }}</th>
                        </tr>
                      </ng-template>
                      <ng-template pTemplate="body" let-m>
                        <tr>
                          <td class="font-medium">{{ t.mois[m.numero - 1] }}</td>
                          <td class="text-right text-green-600 tabular-nums">{{ m.agregat.revenus | montant }}</td>
                          <td class="text-right text-red-500 tabular-nums">{{ m.agregat.charges | montant }}</td>
                          <td class="text-right text-blue-500 tabular-nums">{{ m.agregat.reserves | montant }}</td>
                          <td class="text-right font-semibold tabular-nums"
                              [class.text-emerald-600]="m.agregat.soldeDisponible >= 0"
                              [class.text-red-500]="m.agregat.soldeDisponible < 0">
                            {{ m.agregat.soldeDisponible | montant }}
                          </td>
                        </tr>
                      </ng-template>
                      <ng-template pTemplate="footer">
                        <tr class="font-bold bg-surface-100 dark:bg-surface-800">
                          <td>{{ t.projection.totalAnnee }}</td>
                          <td class="text-right text-green-600 tabular-nums">{{ mc.total.revenus | montant }}</td>
                          <td class="text-right text-red-500 tabular-nums">{{ mc.total.charges | montant }}</td>
                          <td class="text-right text-blue-500 tabular-nums">{{ mc.total.reserves | montant }}</td>
                          <td class="text-right tabular-nums"
                              [class.text-emerald-600]="mc.total.soldeDisponible >= 0"
                              [class.text-red-500]="mc.total.soldeDisponible < 0">
                            {{ mc.total.soldeDisponible | montant }}
                          </td>
                        </tr>
                      </ng-template>
                    </p-table>
                  </div>

                  <!-- Mobile : cartes compactes par mois -->
                  <div class="sm:hidden space-y-2">
                    @for (m of mc.mois; track m.numero) {
                      <div class="rounded-xl bg-surface-50 dark:bg-surface-800 p-3">
                        <div class="flex items-center justify-between mb-2">
                          <span class="font-semibold text-sm w-10">{{ t.mois[m.numero - 1] }}</span>
                          <span class="text-sm font-bold tabular-nums"
                                [class.text-emerald-600]="m.agregat.soldeDisponible >= 0"
                                [class.text-red-500]="m.agregat.soldeDisponible < 0">
                            {{ m.agregat.soldeDisponible | montant }}
                          </span>
                        </div>
                        <div class="grid grid-cols-3 gap-1 text-center">
                          <div>
                            <div class="text-xs text-surface-400">{{ t.projection.revenus }}</div>
                            <div class="text-xs font-semibold text-green-600 tabular-nums">{{ m.agregat.revenus | montant }}</div>
                          </div>
                          <div>
                            <div class="text-xs text-surface-400">{{ t.projection.charges }}</div>
                            <div class="text-xs font-semibold text-red-500 tabular-nums">{{ m.agregat.charges | montant }}</div>
                          </div>
                          <div>
                            <div class="text-xs text-surface-400">{{ t.projection.reserves }}</div>
                            <div class="text-xs font-semibold text-blue-500 tabular-nums">{{ m.agregat.reserves | montant }}</div>
                          </div>
                        </div>
                      </div>
                    }
                    <div class="rounded-xl bg-surface-100 dark:bg-surface-700 p-3 border border-surface-200 dark:border-surface-600">
                      <div class="flex items-center justify-between mb-2">
                        <span class="font-bold text-sm">{{ t.projection.totalAnnee }}</span>
                        <span class="font-bold text-sm tabular-nums"
                              [class.text-emerald-600]="mc.total.soldeDisponible >= 0"
                              [class.text-red-500]="mc.total.soldeDisponible < 0">
                          {{ mc.total.soldeDisponible | montant }}
                        </span>
                      </div>
                      <div class="grid grid-cols-3 gap-1 text-center">
                        <div>
                          <div class="text-xs text-surface-400">{{ t.projection.revenus }}</div>
                          <div class="text-xs font-semibold text-green-600 tabular-nums">{{ mc.total.revenus | montant }}</div>
                        </div>
                        <div>
                          <div class="text-xs text-surface-400">{{ t.projection.charges }}</div>
                          <div class="text-xs font-semibold text-red-500 tabular-nums">{{ mc.total.charges | montant }}</div>
                        </div>
                        <div>
                          <div class="text-xs text-surface-400">{{ t.projection.reserves }}</div>
                          <div class="text-xs font-semibold text-blue-500 tabular-nums">{{ mc.total.reserves | montant }}</div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </p-card>
            }
          </div>
        </div>
        }

        <!-- ④ Tableau mensuel détaillé ─────────────────────────────────────── -->
        @if (vue() !== 'MEMBRE') {
        <p-card>
          <ng-template pTemplate="header">
            <div class="px-5 pt-5 pb-3 flex items-center gap-2">
              <i class="pi pi-table text-surface-400"></i>
              <span class="font-semibold text-base">Détail mensuel {{ anneeSelectionnee }}</span>
            </div>
          </ng-template>

          <!-- Desktop / tablette : table scrollable -->
          <div class="hidden sm:block overflow-x-auto">
            <p-table [value]="projection()!.mois" styleClass="p-datatable-sm p-datatable-striped" scrollable>
              <ng-template pTemplate="header">
                <tr>
                  <th class="min-w-16">{{ t.projection.mois }}</th>
                  <th class="text-right">{{ t.projection.revenus }}</th>
                  <th class="text-right">{{ t.projection.charges }}</th>
                  <th class="text-right">{{ t.projection.reserves }}</th>
                  <th class="text-right">{{ t.projection.solde }}</th>
                </tr>
              </ng-template>
              <ng-template pTemplate="body" let-m>
                <tr>
                  <td class="font-medium">{{ t.mois[m.numero - 1] }}</td>
                  <td class="text-right text-green-600 tabular-nums">{{ m.agregat.revenus | montant }}</td>
                  <td class="text-right text-red-500 tabular-nums">{{ m.agregat.charges | montant }}</td>
                  <td class="text-right text-blue-500 tabular-nums">{{ m.agregat.reserves | montant }}</td>
                  <td class="text-right font-semibold tabular-nums"
                      [class.text-emerald-600]="m.agregat.soldeDisponible >= 0"
                      [class.text-red-500]="m.agregat.soldeDisponible < 0">
                    {{ m.agregat.soldeDisponible | montant }}
                  </td>
                </tr>
              </ng-template>
              <ng-template pTemplate="footer">
                <tr class="font-bold bg-surface-100 dark:bg-surface-800">
                  <td>{{ t.projection.totalAnnee }}</td>
                  <td class="text-right text-green-600 tabular-nums">{{ projection()!.totalAnnuel.revenus | montant }}</td>
                  <td class="text-right text-red-500 tabular-nums">{{ projection()!.totalAnnuel.charges | montant }}</td>
                  <td class="text-right text-blue-500 tabular-nums">{{ projection()!.totalAnnuel.reserves | montant }}</td>
                  <td class="text-right tabular-nums"
                      [class.text-emerald-600]="projection()!.totalAnnuel.soldeDisponible >= 0"
                      [class.text-red-500]="projection()!.totalAnnuel.soldeDisponible < 0">
                    {{ projection()!.totalAnnuel.soldeDisponible | montant }}
                  </td>
                </tr>
              </ng-template>
            </p-table>
          </div>

          <!-- Mobile : cartes compactes par mois -->
          <div class="sm:hidden space-y-2">
            @for (m of projection()!.mois; track m.numero) {
              <div class="rounded-xl bg-surface-50 dark:bg-surface-800 p-3">
                <div class="flex items-center justify-between mb-2">
                  <span class="font-semibold text-sm w-10">{{ t.mois[m.numero - 1] }}</span>
                  <span class="text-sm font-bold tabular-nums"
                        [class.text-emerald-600]="m.agregat.soldeDisponible >= 0"
                        [class.text-red-500]="m.agregat.soldeDisponible < 0">
                    {{ m.agregat.soldeDisponible | montant }}
                  </span>
                </div>
                <div class="grid grid-cols-3 gap-1 text-center">
                  <div>
                    <div class="text-xs text-surface-400">Revenus</div>
                    <div class="text-xs font-semibold text-green-600 tabular-nums">{{ m.agregat.revenus | montant }}</div>
                  </div>
                  <div>
                    <div class="text-xs text-surface-400">Charges</div>
                    <div class="text-xs font-semibold text-red-500 tabular-nums">{{ m.agregat.charges | montant }}</div>
                  </div>
                  <div>
                    <div class="text-xs text-surface-400">Réserves</div>
                    <div class="text-xs font-semibold text-blue-500 tabular-nums">{{ m.agregat.reserves | montant }}</div>
                  </div>
                </div>
              </div>
            }
            <div class="rounded-xl bg-surface-100 dark:bg-surface-700 p-3 border border-surface-200 dark:border-surface-600">
              <div class="flex items-center justify-between mb-2">
                <span class="font-bold text-sm">{{ t.projection.totalAnnee }}</span>
                <span class="font-bold text-sm tabular-nums"
                      [class.text-emerald-600]="projection()!.totalAnnuel.soldeDisponible >= 0"
                      [class.text-red-500]="projection()!.totalAnnuel.soldeDisponible < 0">
                  {{ projection()!.totalAnnuel.soldeDisponible | montant }}
                </span>
              </div>
              <div class="grid grid-cols-3 gap-1 text-center">
                <div>
                  <div class="text-xs text-surface-400">Revenus</div>
                  <div class="text-xs font-semibold text-green-600 tabular-nums">{{ projection()!.totalAnnuel.revenus | montant }}</div>
                </div>
                <div>
                  <div class="text-xs text-surface-400">Charges</div>
                  <div class="text-xs font-semibold text-red-500 tabular-nums">{{ projection()!.totalAnnuel.charges | montant }}</div>
                </div>
                <div>
                  <div class="text-xs text-surface-400">Réserves</div>
                  <div class="text-xs font-semibold text-blue-500 tabular-nums">{{ projection()!.totalAnnuel.reserves | montant }}</div>
                </div>
              </div>
            </div>
          </div>
        </p-card>
        }
      }
    </div>
  `,
})
export class DashboardAnnuelComponent implements OnInit {
  readonly t = FR;
  private contexte = inject(ContexteService);
  private projSvc  = inject(ProjectionService);

  projection  = signal<ProjectionAnnuelleDto | null>(null);
  chargement  = signal(false);
  membres     = this.contexte.membres;

  // ── Vue Foyer / Par membre / Les deux ────────────────────────────────────────
  vue = signal<'FOYER' | 'MEMBRE' | 'TOUT'>('MEMBRE');
  afficherParMembre = computed(() => this.membres().length > 1);
  readonly vueOptions = [
    { label: this.t.projection.vueFoyer,     value: 'FOYER'  },
    { label: this.t.projection.vueParMembre, value: 'MEMBRE' },
    { label: this.t.projection.vueTout,      value: 'TOUT'   },
  ];

  anneeSelectionnee = new Date().getFullYear();
  annees: number[]  = Array.from({ length: 9 }, (_, i) => new Date().getFullYear() + i);

  // ── Helpers formatage ──────────────────────────────────────��────────────────
  private readonly fmtCompact = (v: number) =>
    Intl.NumberFormat('fr-CH', { notation: 'compact', maximumFractionDigits: 1 }).format(v);

  readonly fmtMensuel = (v: number) =>
    Intl.NumberFormat('fr-CH', { notation: 'compact', maximumFractionDigits: 0 }).format(v / 12);

  soldeCardBorder = computed(() =>
    (this.projection()?.totalAnnuel.soldeDisponible ?? 0) >= 0
      ? 'border-emerald-500'
      : 'border-red-500'
  );

  // ── Options Chart.js ────────────────────────────────────────────────────────
  readonly mixedChartOptions = {
    responsive: true, maintainAspectRatio: false,
    plugins: { legend: { display: false } },
    scales: {
      x: { grid: { display: false } },
      y: {
        ticks: { callback: (v: any) => this.fmtCompact(Number(v)) },
        grid:  { color: 'rgba(128,128,128,0.08)' },
      },
    },
  };

  // ── Computed chart data ─────────────────────────────────────────────────────
  mixedChartData = computed(() => this.buildFoyerChartData(this.projection()?.mois));

  private buildFoyerChartData(mois: { agregat: AggregatDto }[] | undefined): object {
    if (!mois || !mois.length) return {};
    return {
      labels: this.t.mois,
      datasets: [
        {
          type: 'bar', label: this.t.projection.charges,
          backgroundColor: 'rgba(239,68,68,0.75)',
          data: mois.map(m => m.agregat.charges),
          stack: 'depenses',
        },
        {
          type: 'bar', label: this.t.projection.reserves,
          backgroundColor: 'rgba(59,130,246,0.75)',
          data: mois.map(m => m.agregat.reserves),
          stack: 'depenses',
        },
        {
          type: 'line', label: this.t.projection.revenus,
          borderColor: '#22c55e', backgroundColor: 'rgba(34,197,94,0.08)',
          data: mois.map(m => m.agregat.revenus),
          tension: 0.3, fill: false, pointRadius: 4, borderWidth: 2,
        },
      ],
    };
  }

  membreChartsData = computed(() => {
    const p = this.projection();
    if (!p) return [];
    return this.membres().map(m => {
      const moisData = p.moisParMembre[m.id];
      return {
        membreId: m.id,
        nom:      m.nom,
        couleur:  m.couleur,
        data:     this.buildMembreChartData(moisData),
        dataReel: this.buildMembreChartData(p.moisParMembreReel?.[m.id]),
        mois:     this.buildMembreMois(moisData),
        total:    this.buildMembreTotal(moisData),
      };
    });
  });

  private buildMembreMois(moisData: AggregatDto[] | undefined): { numero: number; agregat: AggregatDto }[] {
    if (!moisData || !moisData.length) return [];
    return moisData.map((agregat, i) => ({ numero: i + 1, agregat }));
  }

  private buildMembreTotal(moisData: AggregatDto[] | undefined): AggregatDto {
    const zero: AggregatDto = { revenus: 0, charges: 0, reserves: 0, soldeDisponible: 0 };
    if (!moisData || !moisData.length) return zero;
    return moisData.reduce((acc, ag) => ({
      revenus:         acc.revenus + ag.revenus,
      charges:         acc.charges + ag.charges,
      reserves:        acc.reserves + ag.reserves,
      soldeDisponible: acc.soldeDisponible + ag.soldeDisponible,
    }), zero);
  }

  private buildMembreChartData(moisData: AggregatDto[] | undefined): object {
    if (!moisData || !moisData.length) return {};
    return {
      labels: this.t.mois,
      datasets: [
        {
          type: 'bar', label: this.t.projection.charges,
          backgroundColor: 'rgba(239,68,68,0.75)',
          data: moisData.map(ag => ag.charges),
          stack: 'depenses',
        },
        {
          type: 'bar', label: this.t.projection.reserves,
          backgroundColor: 'rgba(59,130,246,0.75)',
          data: moisData.map(ag => ag.reserves),
          stack: 'depenses',
        },
        {
          type: 'line', label: this.t.projection.revenus,
          borderColor: '#22c55e', backgroundColor: 'rgba(34,197,94,0.08)',
          data: moisData.map(ag => ag.revenus),
          tension: 0.3, fill: false, pointRadius: 4, borderWidth: 2,
        },
      ],
    };
  }

  // ── Effets & chargement ─────────────────────────────────────────────────────

  private readonly _initEffect = effect(() => {
    const sc = this.contexte.scenarioCourant();
    const foyerId = this.contexte.foyerId();
    if (sc) {
      this.annees = Array.from({ length: sc.horizonAnnees }, (_, i) => sc.anneeDepart + i);
      this.anneeSelectionnee = sc.anneeDepart;
    }
    if (foyerId && sc) this.charger();
  });

  ngOnInit(): void {}

  charger(): void {
    const foyerId    = this.contexte.foyerId();
    const scenarioId = this.contexte.scenarioId();
    if (!foyerId || !scenarioId) return;
    this.chargement.set(true);
    this.projSvc.annuelle(foyerId, scenarioId, this.anneeSelectionnee).subscribe({
      next: p => { this.projection.set(p); this.chargement.set(false); },
      error: () => this.chargement.set(false),
    });
  }
}
