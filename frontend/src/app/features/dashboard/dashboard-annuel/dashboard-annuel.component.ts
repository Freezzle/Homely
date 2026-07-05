import { Component, inject, signal, computed, OnInit, effect } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { SelectModule } from 'primeng/select';
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
  imports: [CommonModule, FormsModule, SelectModule, TableModule, ChartModule,
            SkeletonModule, CardModule, MontantPipe],
  template: `
    <div class="flex flex-col gap-6">
      <!-- En-tête + sélecteur année -->
      <div class="flex items-center gap-4">
        <h1 class="text-2xl font-bold flex-1">{{ t.nav.dashboardAnnuel }}</h1>
        <p-select appendTo="body" [options]="annees" [(ngModel)]="anneeSelectionnee"
                  (onChange)="charger()" styleClass="w-28" />
      </div>

      @if (chargement()) {
        <div class="grid grid-cols-2 md:grid-cols-4 gap-4">
          @for (i of [1,2,3,4]; track i) { <p-skeleton height="96px" /> }
        </div>
        <p-skeleton height="340px" />
        <p-skeleton height="300px" />
      } @else if (projection()) {

        <!-- ① KPI cards -->
        <div class="grid grid-cols-2 md:grid-cols-4 gap-4">
          <p-card styleClass="text-center">
            <div class="text-xs text-surface-500 mb-1 uppercase tracking-wide">{{ t.projection.revenus }}</div>
            <div class="text-xl font-bold text-green-600">{{ projection()!.totalAnnuel.revenus | montant }}</div>
          </p-card>
          <p-card styleClass="text-center">
            <div class="text-xs text-surface-500 mb-1 uppercase tracking-wide">{{ t.projection.charges }}</div>
            <div class="text-xl font-bold text-red-500">{{ projection()!.totalAnnuel.charges | montant }}</div>
          </p-card>
          <p-card styleClass="text-center">
            <div class="text-xs text-surface-500 mb-1 uppercase tracking-wide">{{ t.projection.reserves }}</div>
            <div class="text-xl font-bold text-blue-500">{{ projection()!.totalAnnuel.reserves | montant }}</div>
          </p-card>
          <p-card styleClass="text-center">
            <div class="text-xs text-surface-500 mb-1 uppercase tracking-wide">{{ t.projection.solde }}</div>
            <div class="text-xl font-bold"
                 [class.text-green-600]="projection()!.totalAnnuel.soldeDisponible >= 0"
                 [class.text-red-500]="projection()!.totalAnnuel.soldeDisponible < 0">
              {{ projection()!.totalAnnuel.soldeDisponible | montant }}
            </div>
          </p-card>
        </div>

        <!-- ② Graphique mixte : barres empilées charges+réserves + lignes revenus/solde -->
        <p-card>
          <ng-template pTemplate="header">
            <div class="px-4 pt-4 font-semibold">
              Flux mensuels {{ anneeSelectionnee }}
              <span class="text-xs font-normal text-surface-400 ml-2">barres = charges+réserves · lignes = revenus · solde</span>
            </div>
          </ng-template>
          <p-chart type="bar" [data]="mixedChartData()" [options]="mixedChartOptions"
                   styleClass="w-full" style="height:340px" />
        </p-card>

        <!-- ③ Un flux mensuel par membre -->
        @for (mc of membreChartsData(); track mc.membreId) {
          <p-card>
            <ng-template pTemplate="header">
              <div class="px-4 pt-4 font-semibold flex items-center gap-2">
                <span class="inline-block w-3 h-3 rounded-full border border-surface-300"
                      [style.background-color]="mc.couleur"></span>
                {{ mc.nom }} — {{ anneeSelectionnee }}
                <span class="text-xs font-normal text-surface-400 ml-1">barres = charges+réserves · lignes = revenus · solde</span>
              </div>
            </ng-template>
            <p-chart type="bar" [data]="mc.data" [options]="mixedChartOptions"
                     styleClass="w-full" style="height:300px" />
          </p-card>
        }

        <!-- ④ Tableau mensuel -->
        <p-card>
          <ng-template pTemplate="header">
            <div class="px-4 pt-4 font-semibold">Détail mensuel {{ anneeSelectionnee }}</div>
          </ng-template>
          <p-table [value]="projection()!.mois" styleClass="p-datatable-sm p-datatable-striped" scrollable>
            <ng-template pTemplate="header">
              <tr>
                <th>{{ t.projection.mois }}</th>
                <th class="text-right">{{ t.projection.revenus }}</th>
                <th class="text-right">{{ t.projection.charges }}</th>
                <th class="text-right">{{ t.projection.reserves }}</th>
                <th class="text-right">{{ t.projection.solde }}</th>
              </tr>
            </ng-template>
            <ng-template pTemplate="body" let-m>
              <tr>
                <td>{{ t.mois[m.numero - 1] }}</td>
                <td class="text-right text-green-600">{{ m.agregat.revenus | montant }}</td>
                <td class="text-right text-red-500">{{ m.agregat.charges | montant }}</td>
                <td class="text-right text-blue-500">{{ m.agregat.reserves | montant }}</td>
                <td class="text-right font-semibold"
                    [class.text-green-600]="m.agregat.soldeDisponible >= 0"
                    [class.text-red-500]="m.agregat.soldeDisponible < 0">
                  {{ m.agregat.soldeDisponible | montant }}
                </td>
              </tr>
            </ng-template>
            <ng-template pTemplate="footer">
              <tr class="font-bold bg-surface-100 dark:bg-surface-800">
                <td>{{ t.projection.totalAnnee }}</td>
                <td class="text-right text-green-600">{{ projection()!.totalAnnuel.revenus | montant }}</td>
                <td class="text-right text-red-500">{{ projection()!.totalAnnuel.charges | montant }}</td>
                <td class="text-right text-blue-500">{{ projection()!.totalAnnuel.reserves | montant }}</td>
                <td class="text-right"
                    [class.text-green-600]="projection()!.totalAnnuel.soldeDisponible >= 0"
                    [class.text-red-500]="projection()!.totalAnnuel.soldeDisponible < 0">
                  {{ projection()!.totalAnnuel.soldeDisponible | montant }}
                </td>
              </tr>
            </ng-template>
          </p-table>
        </p-card>
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

  anneeSelectionnee = new Date().getFullYear();
  annees: number[]  = Array.from({ length: 9 }, (_, i) => new Date().getFullYear() + i);

  // ── Helpers formatage axes ──────────────────────────────────────────────────
  private readonly fmtCompact = (v: number) =>
    Intl.NumberFormat('fr-CH', { notation: 'compact', maximumFractionDigits: 1 }).format(v);

  // ── Options Chart.js — partagées pour tous les graphiques mixtes ────────────
  readonly mixedChartOptions = {
    responsive: true, maintainAspectRatio: false,
    plugins: { legend: { position: 'bottom' as const } },
    scales: {
      x: {},
      y: { ticks: { callback: (v: number) => this.fmtCompact(v) } },
    },
  };

  // ── Computed chart data ─────────────────────────────────────────────────────

  /** ② Graphique mixte : barres empilées charges+réserves, lignes revenus + solde */
  mixedChartData = computed(() => {
    const p = this.projection();
    if (!p) return {};
    return {
      labels: this.t.mois,
      datasets: [
        {
          type: 'bar', label: this.t.projection.charges,
          backgroundColor: 'rgba(239,68,68,0.75)',
          data: p.mois.map(m => m.agregat.charges),
          stack: 'depenses',
        },
        {
          type: 'bar', label: this.t.projection.reserves,
          backgroundColor: 'rgba(59,130,246,0.75)',
          data: p.mois.map(m => m.agregat.reserves),
          stack: 'depenses',
        },
        {
          type: 'line', label: this.t.projection.revenus,
          borderColor: '#22c55e', backgroundColor: 'rgba(34,197,94,0.08)',
          data: p.mois.map(m => m.agregat.revenus),
          tension: 0.3, fill: false, pointRadius: 4, borderWidth: 2,
        },
      ],
    };
  });

  /** ③ Un chart par membre — datasets identiques au flux mensuel (barres+lignes) */
  membreChartsData = computed(() => {
    const p = this.projection();
    if (!p) return [];
    return this.membres().map(m => ({
      membreId: m.id,
      nom:      m.nom,
      couleur:  m.couleur,
      data:     this.buildMembreChartData(p, m.id),
    }));
  });

  private buildMembreChartData(p: ProjectionAnnuelleDto, membreId: string): object {
    const moisData = (p.moisParMembre)[membreId] ?? [];
    return {
      labels: this.t.mois,
      datasets: [
        {
          type: 'bar', label: this.t.projection.charges,
          backgroundColor: 'rgba(239,68,68,0.75)',
          data: moisData.map((ag: AggregatDto) => ag.charges),
          stack: 'depenses',
        },
        {
          type: 'bar', label: this.t.projection.reserves,
          backgroundColor: 'rgba(59,130,246,0.75)',
          data: moisData.map((ag: AggregatDto) => ag.reserves),
          stack: 'depenses',
        },
        {
          type: 'line', label: this.t.projection.revenus,
          borderColor: '#22c55e', backgroundColor: 'rgba(34,197,94,0.08)',
          data: moisData.map((ag: AggregatDto) => ag.revenus),
          tension: 0.3, fill: false, pointRadius: 4, borderWidth: 2,
        },
      ],
    };
  }

  /** ③b — supprimé (trésorerie pluriannuelle retirée) */

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
