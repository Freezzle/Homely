import { CommonModule } from '@angular/common';
import { Component, computed, inject, input } from '@angular/core';
import { CardModule } from 'primeng/card';
import { TagModule } from 'primeng/tag';
import { ChartModule } from 'primeng/chart';
import { SkeletonModule } from 'primeng/skeleton';
import { TranslateService } from '@ngx-translate/core';
import { MontantPipe } from '../../../core/pipes/format.pipes';
import { I18nService } from '../../../core/i18n/i18n.service';
import { localeDeLangue } from '../../../core/i18n/locale.util';
import { CompteRecapMensuelDto, CompteTresorerieDto } from '../../../core/models/api.models';

/** Vue-modèle prête à l'emploi pour une card de compte — calculée une fois par
 *  `ComptesMembreRecapComponent` (pas de recalcul dans le template). */
interface CompteCardVm {
  compteId: string;
  libelle: string;
  virementsEntrants: number;
  entrees: number;
  sortiesPlanifiees: number;
  sortiesEchues: number;
  virementsSortants: number;
  soldeRestant: number;
  insuffisant: boolean;
  montantManquant: number;
  messageAVirer: string;
  chartData: unknown;
}

/**
 * Récapitulatif mensuel de trésorerie par compte (dashboard, vue membre) : une card par
 * compte avec virements entrants simulés, entrées/sorties échues, solde restant, alerte
 * d'insuffisance et mini-timeline (trésorerie cumulée sur 4 mois). Purement
 * présentationnel — reçoit ses données déjà calculées côté serveur via `@Input`.
 */
@Component({
  selector: 'app-comptes-membre-recap',
  standalone: true,
  imports: [CommonModule, CardModule, TagModule, ChartModule, SkeletonModule, MontantPipe],
  templateUrl: './comptes-membre-recap.component.html',
  styleUrl: './comptes-membre-recap.component.scss',
})
export class ComptesMembreRecapComponent {
  private readonly i18n = inject(I18nService);
  private readonly translate = inject(TranslateService);
  protected readonly t = this.i18n.translations();

  readonly recaps = input<CompteRecapMensuelDto[]>([]);
  readonly tresoreries = input<CompteTresorerieDto[]>([]);
  readonly devise = input<string>('CHF');
  readonly chargement = input<boolean>(false);

  protected readonly cartes = computed<CompteCardVm[]>(() => {
    const tresoParCompte = new Map(this.tresoreries().map((t) => [t.compteId, t]));
    return this.recaps().map((r) => ({
      compteId: r.compteId,
      libelle: r.libelleCompte,
      virementsEntrants: r.virementsEntrants,
      entrees: r.entrees,
      sortiesPlanifiees: r.sortiesPlanifiees,
      sortiesEchues: r.sortiesEchues,
      virementsSortants: r.virementsSortants,
      soldeRestant: r.soldeRestant,
      insuffisant: r.insuffisant,
      montantManquant: r.montantManquant,
      messageAVirer: this.t.dashboard.comptesAVirer.replace('{{montant}}', this.formatMontant(r.montantManquant)),
      chartData: this.construireChartData(tresoParCompte.get(r.compteId)),
    }));
  });

  /** Mêmes options visuelles que les graphiques de l'onglet « Graphiques » du
   *  dashboard annuel (interaction par index, grille discrète, ticks compacts). */
  protected readonly chartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    interaction: { mode: 'index', intersect: false },
    plugins: {
      legend: { display: false },
      tooltip: {
        mode: 'index',
        intersect: false,
        callbacks: {
          label: (ctx: { parsed: { y: number } }) => this.formatMontant(ctx.parsed.y),
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
    elements: {
      point: { radius: 3, hoverRadius: 4 },
    },
  };

  private construireChartData(treso: CompteTresorerieDto | undefined) {
    if (!treso || !treso.points.length) return {};
    return {
      labels: treso.points.map((p) => this.libelleMoisCourt(p.mois)),
      datasets: [
        {
          type: 'line',
          label: this.t.dashboard.tresorerieCumulee,
          data: treso.points.map((p) => p.tresorerieCumulee),
          borderColor: '#42A5F5',
          backgroundColor: 'rgb(66 165 245 / 0.39)',
          fill: true,
          tension: 0.25,
          pointRadius: 3,
          borderWidth: 1,
        },
      ],
    };
  }

  private fmtCompact(v: number): string {
    return new Intl.NumberFormat(localeDeLangue(this.translate.currentLang()), {
      notation: 'compact',
      maximumFractionDigits: 1,
    }).format(v);
  }

  private libelleMoisCourt(mois: number): string {
    const d = new Date(2000, mois - 1, 1);
    return new Intl.DateTimeFormat(localeDeLangue(this.translate.currentLang()), { month: 'short' }).format(d);
  }

  private formatMontant(value: number): string {
    return new Intl.NumberFormat(localeDeLangue(this.translate.currentLang()), {
      style: 'currency',
      currency: this.devise(),
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(value);
  }
}
