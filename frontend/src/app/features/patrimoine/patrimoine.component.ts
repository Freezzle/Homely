import { Component, inject, signal, computed, OnInit, effect } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ChartModule } from 'primeng/chart';
import { CardModule } from 'primeng/card';
import { TableModule } from 'primeng/table';
import { SkeletonModule } from 'primeng/skeleton';
import { ContexteService } from '../../core/services/contexte.service';
import { ProjectionService } from '../../core/services/projection.service';
import { ActifService, CompteService } from '../../core/services/referentiel.service';
import { PatrimoineDto, ActifDto, CompteDto } from '../../core/models/api.models';
import { MontantPipe } from '../../core/pipes/format.pipes';
import { FR } from '../../core/i18n/fr';

/** T10.6 — Écran Patrimoine */
@Component({
  selector: 'app-patrimoine',
  standalone: true,
  imports: [CommonModule, ChartModule, CardModule, TableModule, SkeletonModule, MontantPipe],
  template: `
    <div class="flex flex-col gap-6">
      <h1 class="text-2xl font-bold">{{ t.patrimoine.titre }}</h1>

      @if (chargement()) {
        <p-skeleton height="320px" />
      } @else if (patrimoine()) {
        <!-- Courbe net worth -->
        <p-card>
          <ng-template pTemplate="header">
            <div class="px-4 pt-4 font-semibold">{{ t.patrimoine.courbe }}</div>
          </ng-template>
          <p-chart type="line" [data]="chartData()" [options]="chartOptions" styleClass="w-full" style="height:320px" />
        </p-card>

        <!-- Cartes résumé dernière année -->
        @if (derniere()) {
          <div class="grid grid-cols-1 md:grid-cols-3 gap-4">
            <p-card styleClass="text-center">
              <div class="text-sm text-surface-500 mb-1">{{ t.patrimoine.patrimoineNet }} {{ derniere()!.annee }}</div>
              <div class="text-2xl font-bold text-primary">{{ derniere()!.patrimoineNet | montant }}</div>
            </p-card>
            <p-card styleClass="text-center">
              <div class="text-sm text-surface-500 mb-1">{{ t.patrimoine.soldesComptes }}</div>
              <div class="text-2xl font-bold text-blue-500">{{ totalComptes() | montant }}</div>
            </p-card>
            <p-card styleClass="text-center">
              <div class="text-sm text-surface-500 mb-1">{{ t.patrimoine.soldesActifs }}</div>
              <div class="text-2xl font-bold text-green-600">{{ totalActifs() | montant }}</div>
            </p-card>
          </div>
        }

        <!-- Tableau évolution annuelle -->
        <p-card>
          <ng-template pTemplate="header">
            <div class="px-4 pt-4 font-semibold">Évolution annuelle</div>
          </ng-template>
          <p-table [value]="patrimoine()!.annees" styleClass="p-datatable-sm p-datatable-striped" scrollable>
            <ng-template pTemplate="header">
              <tr>
                <th>{{ t.patrimoine.annee }}</th>
                <th class="text-right">{{ t.patrimoine.patrimoineNet }}</th>
                @for (compte of comptes(); track compte.id) {
                  <th class="text-right text-xs">{{ compte.libelle }}</th>
                }
                @for (actif of actifs(); track actif.id) {
                  <th class="text-right text-xs">{{ actif.libelle }}</th>
                }
              </tr>
            </ng-template>
            <ng-template pTemplate="body" let-row>
              <tr>
                <td class="font-medium">{{ row.annee }}</td>
                <td class="text-right font-bold" [class.text-green-600]="row.patrimoineNet >= 0" [class.text-red-500]="row.patrimoineNet < 0">
                  {{ row.patrimoineNet | montant }}
                </td>
                @for (compte of comptes(); track compte.id) {
                  <td class="text-right text-surface-500 text-xs">{{ (row.soldesComptes[compte.id] ?? 0) | montant }}</td>
                }
                @for (actif of actifs(); track actif.id) {
                  <td class="text-right text-surface-500 text-xs">{{ (row.soldesActifs[actif.id] ?? 0) | montant }}</td>
                }
              </tr>
            </ng-template>
          </p-table>
        </p-card>
      }
    </div>
  `,
})
export class PatrimoineComponent implements OnInit {
  readonly t = FR;
  private contexte = inject(ContexteService);
  private projSvc = inject(ProjectionService);
  private compteSvc = inject(CompteService);
  private actifSvc = inject(ActifService);

  patrimoine = signal<PatrimoineDto | null>(null);
  comptes = signal<CompteDto[]>([]);
  actifs = signal<ActifDto[]>([]);
  chargement = signal(false);

  readonly chartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: { legend: { display: true, position: 'bottom' as const } },
    scales: {
      y: {
        ticks: {
          callback: (v: number) => Intl.NumberFormat('fr-CH', { notation: 'compact', currency: 'CHF' }).format(v),
        },
      },
    },
  };

  derniere = computed(() => {
    const p = this.patrimoine();
    if (!p || !p.annees.length) return null;
    return p.annees[p.annees.length - 1];
  });

  totalComptes = computed(() => {
    const d = this.derniere();
    if (!d) return 0;
    return Object.values(d.soldesComptes).reduce((s, v) => s + v, 0);
  });

  totalActifs = computed(() => {
    const d = this.derniere();
    if (!d) return 0;
    return Object.values(d.soldesActifs).reduce((s, v) => s + v, 0);
  });

  chartData = computed(() => {
    const p = this.patrimoine();
    if (!p) return {};
    const annees = p.annees.map(a => String(a.annee));
    const palette = ['#6366f1', '#22c55e', '#ef4444', '#f59e0b', '#3b82f6', '#ec4899'];
    const datasets: any[] = [
      {
        label: FR.patrimoine.patrimoineNet,
        data: p.annees.map(a => a.patrimoineNet),
        borderColor: '#6366f1',
        backgroundColor: 'rgba(99,102,241,0.15)',
        fill: true,
        tension: 0.3,
        pointRadius: 3,
        type: 'line',
        order: 0,
      },
      ...this.comptes().map((c, i) => ({
        label: c.libelle,
        data: p.annees.map(a => a.soldesComptes[c.id] ?? 0),
        backgroundColor: palette[(i + 1) % palette.length] + '66',
        stack: 'comptes',
        type: 'bar',
        order: 1,
      })),
    ];
    return { labels: annees, datasets };
  });

  // effect() en initialiseur de champ = contexte d'injection valide ✓
  private readonly _chargerEffect = effect(() => {
    const foyerId = this.contexte.foyerId();
    const scenarioId = this.contexte.scenarioId();
    if (!foyerId || !scenarioId) return;
    this.chargement.set(true);
    this.compteSvc.lister(foyerId).subscribe(c => this.comptes.set(c));
    this.actifSvc.lister(foyerId).subscribe(a => this.actifs.set(a));
    this.projSvc.patrimoine(foyerId, scenarioId).subscribe({
      next: p => { this.patrimoine.set(p); this.chargement.set(false); },
      error: () => this.chargement.set(false),
    });
  });

  ngOnInit(): void {}
}

