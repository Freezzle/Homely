import { CommonModule } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, inject, input } from '@angular/core';
import { ChartModule } from 'primeng/chart';
import { ContexteService } from '../../../../core/services/contexte.service';
import { I18nService } from '../../../../core/i18n/i18n.service';
import { resolveAppColor, withAlpha } from '../../../../shared/utils/css-vars';
import { formatMontant, formatMontantSigne } from '../../data/format-montant.util';

export interface SoldeMensuelChartLabels {
  soldeA: string;
  soldeB: string;
  ecart: string;
}

/**
 * Graphique « solde disponible mois par mois » (docs/features/feature_5_bis §5) :
 *
 * - Série 1 (barres, `--app-success`, opacité .85) : solde disponible mensuel de A.
 * - Série 2 (barres, `--app-info`, opacité .85) : solde disponible mensuel de B.
 * - Série 3 (ligne, axe Y secondaire, `--p-amber-500`) : écart mensuel B − A.
 *
 * Barres arrondies 4px, épaisseur max 22px. Légende en bas. Aucune couleur codée
 * en dur : uniquement des tokens `--app-*` / `--p-*` du thème PrimeNG, résolus en
 * couleurs littérales via `resolveAppColor`/`withAlpha` car Chart.js dessine sur un
 * `<canvas>` et ne résout pas les CSS custom properties (voir shared/utils/css-vars.ts).
 */
@Component({
  selector: 'app-solde-mensuel-chart',
  standalone: true,
  imports: [CommonModule, ChartModule],
  templateUrl: './solde-mensuel-chart.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SoldeMensuelChartComponent {
  private readonly i18n = inject(I18nService);
  private readonly contexte = inject(ContexteService);
  readonly t = this.i18n.translations();

  readonly soldesA = input.required<number[]>();
  readonly soldesB = input.required<number[]>();
  readonly labelsMois = input.required<string[]>();
  readonly labels = input.required<SoldeMensuelChartLabels>();
  readonly devise = input<string>('CHF');

  protected readonly ecarts = computed(() => this.soldesB().map((b, i) => b - (this.soldesA()[i] ?? 0)));

  /** Couleurs de la charte `--app-*` résolues à l'exécution pour Chart.js (le
   *  `<canvas>` ne résout pas les CSS custom properties). Dépend de
   *  `contexte.isDark()` pour se ré-évaluer automatiquement à chaque bascule
   *  de thème, à l'instar de `dashboard-facade.service.ts`. */
  private readonly chartColors = computed(() => {
    void this.contexte.isDark();
    const success = resolveAppColor('--app-success', '#22C55E');
    const info = resolveAppColor('--app-info', '#3B82F6');
    const amber = resolveAppColor('--p-amber-500', '#F59E0B');
    return {
      success,
      successBg: withAlpha(success, 0.85, success),
      info,
      infoBg: withAlpha(info, 0.85, info),
      amber,
    };
  });

  protected readonly data = computed(() => {
    const colors = this.chartColors();
    return {
      labels: this.labelsMois(),
      datasets: [
        {
          type: 'bar',
          label: this.labels().soldeA,
          data: this.soldesA(),
          backgroundColor: colors.successBg,
          borderColor: colors.success,
          borderRadius: 4,
          maxBarThickness: 22,
          yAxisID: 'y',
          order: 2,
        },
        {
          type: 'bar',
          label: this.labels().soldeB,
          data: this.soldesB(),
          backgroundColor: colors.infoBg,
          borderColor: colors.info,
          borderRadius: 4,
          maxBarThickness: 22,
          yAxisID: 'y',
          order: 2,
        },
        {
          type: 'line',
          label: this.labels().ecart,
          data: this.ecarts(),
          borderColor: colors.amber,
          backgroundColor: colors.amber,
          tension: 0.3,
          borderWidth: 2,
          pointRadius: 3,
          pointBackgroundColor: colors.amber,
          yAxisID: 'yEcart',
          order: 1,
        },
      ],
    };
  });

  protected readonly options = computed(() => {
    const devise = this.devise();
    const langue = this.i18n.currentLang();
    return {
      responsive: true,
      maintainAspectRatio: false,
      interaction: { mode: 'index', intersect: false },
      plugins: {
        legend: {
          position: 'bottom',
          labels: { usePointStyle: true, pointStyle: 'circle' },
        },
        tooltip: {
          mode: 'index',
          intersect: false,
          callbacks: {
            label: (ctx: { dataset: { label?: string; yAxisID?: string }; parsed: { y: number } }) => {
              const montant = ctx.dataset.yAxisID === 'yEcart'
                ? formatMontantSigne(ctx.parsed.y, langue)
                : formatMontant(ctx.parsed.y, langue);
              return `${ctx.dataset.label}: ${montant} ${devise}`;
            },
          },
        },
      },
      scales: {
        x: { grid: { display: false } },
        y: {
          position: 'left',
          ticks: { callback: (v: unknown) => formatMontant(Number(v), langue) },
          grid: { color: 'rgba(148, 163, 184, 0.18)' },
        },
        yEcart: {
          position: 'right',
          ticks: { callback: (v: unknown) => formatMontantSigne(Number(v), langue) },
          grid: { display: false },
        },
      },
    };
  });
}

