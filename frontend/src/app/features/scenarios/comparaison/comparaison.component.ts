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
import { I18nService } from '../../../core/i18n/i18n.service';

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
  templateUrl: './comparaison.component.html',
})
export class ComparaisonComponent implements OnInit {
  private readonly i18n = inject(I18nService);
  readonly t = this.i18n.translations();
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

