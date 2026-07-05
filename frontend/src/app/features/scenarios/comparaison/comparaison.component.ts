import { Component, inject, signal, computed, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ChartModule } from 'primeng/chart';
import { CardModule } from 'primeng/card';
import { TableModule } from 'primeng/table';
import { MultiSelectModule } from 'primeng/multiselect';
import { SkeletonModule } from 'primeng/skeleton';
import { ButtonModule } from 'primeng/button';
import { TagModule } from 'primeng/tag';
import { ContexteService } from '../../../core/services/contexte.service';
import { ProjectionService } from '../../../core/services/projection.service';
import { ScenarioService } from '../../../core/services/scenario-poste.service';
import { ComparaisonDto, ScenarioDto } from '../../../core/models/api.models';
import { MontantPipe } from '../../../core/pipes/format.pipes';
import { FR } from '../../../core/i18n/fr';

/** T10.8 — Comparaison multi-scénarios */
@Component({
  selector: 'app-comparaison',
  standalone: true,
  providers: [],
  imports: [
    CommonModule, FormsModule,
    ChartModule, CardModule, TableModule, MultiSelectModule,
    SkeletonModule, ButtonModule, TagModule, MontantPipe,
  ],
  template: `
    <div class="flex flex-col gap-6">
      <div class="flex items-center gap-4">
        <h1 class="text-2xl font-bold flex-1">{{ t.comparaison.titre }}</h1>
      </div>

      <!-- Sélection des scénarios -->
      <p-card>
        <div class="flex items-end gap-4 flex-wrap">
          <div class="flex flex-col gap-1 flex-1 min-w-64">
            <label class="text-sm font-medium">{{ t.comparaison.selectionner }}</label>
            <p-multiselect
              [options]="scenariosDisponibles()"
              [(ngModel)]="selectionnes"
              optionLabel="nom"
              optionValue="id"
              styleClass="w-full"
              [maxSelectedLabels]="4"
            />
          </div>
          <p-button [label]="t.commun.confirmer" icon="pi pi-play"
                    (click)="comparer()" [disabled]="selectionnes.length < 2" [loading]="chargement()" />
        </div>
      </p-card>

      @if (chargement()) {
        <p-skeleton height="320px" />
      } @else if (comparaison()) {
        <!-- Graphique trésorerie comparée -->
        <p-card>
          <ng-template pTemplate="header">
            <div class="px-4 pt-4 font-semibold">{{ t.comparaison.tresorerie }}</div>
          </ng-template>
          <p-chart type="line" [data]="tresoChartData()" [options]="lineOptions" styleClass="w-full" style="height:320px" />
        </p-card>

        <!-- Graphique solde disponible comparé -->
        <p-card>
          <ng-template pTemplate="header">
            <div class="px-4 pt-4 font-semibold">{{ t.comparaison.solde }}</div>
          </ng-template>
          <p-chart type="bar" [data]="soldeChartData()" [options]="barOptions" styleClass="w-full" style="height:320px" />
        </p-card>

        <!-- Tableau des écarts -->
        <p-card>
          <ng-template pTemplate="header">
            <div class="px-4 pt-4 font-semibold">{{ t.comparaison.ecart }}</div>
          </ng-template>
          <p-table [value]="comparaison()!.series" styleClass="p-datatable-sm p-datatable-striped" scrollable>
            <ng-template pTemplate="header">
              <tr>
                <th>{{ t.patrimoine.annee }}</th>
                @for (nom of comparaison()!.nomScenarios; track nom) {
                  <th class="text-right text-xs">{{ nom }}</th>
                }
                <th class="text-right text-xs">Écart (max-min)</th>
              </tr>
            </ng-template>
            <ng-template pTemplate="body" let-row>
              <tr>
                <td class="font-medium">{{ row.annee }}</td>
                @for (id of comparaison()!.scenarioIds; track id) {
                  <td class="text-right">{{ (row.tresorerieParScenario[id] ?? 0) | montant }}</td>
                }
                <td class="text-right font-semibold text-blue-500">
                  {{ ecart(row) | montant }}
                </td>
              </tr>
            </ng-template>
          </p-table>
        </p-card>
      }
    </div>
  `,
})
export class ComparaisonComponent implements OnInit {
  readonly t = FR;
  private contexte = inject(ContexteService);
  private projSvc = inject(ProjectionService);
  private scenarioSvc = inject(ScenarioService);

  comparaison = signal<ComparaisonDto | null>(null);
  scenariosDisponibles = signal<ScenarioDto[]>([]);
  selectionnes: string[] = [];
  chargement = signal(false);

  private palette = ['#6366f1', '#22c55e', '#ef4444', '#f59e0b', '#3b82f6', '#ec4899', '#14b8a6', '#8b5cf6'];

  readonly lineOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: { legend: { position: 'bottom' as const } },
    scales: {
      y: {
        ticks: {
          callback: (v: number) => Intl.NumberFormat('fr-CH', { notation: 'compact' }).format(v),
        },
      },
    },
  };

  readonly barOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: { legend: { position: 'bottom' as const } },
    scales: {
      y: {
        ticks: {
          callback: (v: number) => Intl.NumberFormat('fr-CH', { notation: 'compact' }).format(v),
        },
      },
    },
  };

  tresoChartData = computed(() => {
    const c = this.comparaison();
    if (!c) return {};
    return {
      labels: c.series.map(s => String(s.annee)),
      datasets: c.scenarioIds.map((id, i) => ({
        label: c.nomScenarios[i],
        data: c.series.map(s => s.tresorerieParScenario[id] ?? 0),
        borderColor: this.palette[i % this.palette.length],
        backgroundColor: this.palette[i % this.palette.length] + '22',
        fill: false,
        tension: 0.3,
        pointRadius: 3,
      })),
    };
  });

  soldeChartData = computed(() => {
    const c = this.comparaison();
    if (!c) return {};
    return {
      labels: c.series.map(s => String(s.annee)),
      datasets: c.scenarioIds.map((id, i) => ({
        label: c.nomScenarios[i],
        data: c.series.map(s => s.soldeParScenario[id] ?? 0),
        backgroundColor: this.palette[i % this.palette.length] + '99',
      })),
    };
  });

  ngOnInit(): void {
    const foyerId = this.contexte.foyerId();
    if (foyerId) {
      this.scenarioSvc.lister(foyerId).subscribe(s => {
        this.scenariosDisponibles.set(s);
        // Pré-sélectionner le scénario de référence + 1 autre
        const ids = s.map(sc => sc.id);
        this.selectionnes = ids.slice(0, Math.min(2, ids.length));
        if (this.selectionnes.length >= 2) this.comparer();
      });
    }
  }

  comparer(): void {
    const foyerId = this.contexte.foyerId();
    if (!foyerId || this.selectionnes.length < 2) return;
    this.chargement.set(true);
    this.projSvc.comparaison(foyerId, this.selectionnes).subscribe({
      next: c => { this.comparaison.set(c); this.chargement.set(false); },
      error: () => this.chargement.set(false),
    });
  }

  ecart(row: any): number {
    const c = this.comparaison();
    if (!c) return 0;
    const vals = c.scenarioIds.map(id => row.tresorerieParScenario[id] ?? 0);
    return Math.max(...vals) - Math.min(...vals);
  }
}

