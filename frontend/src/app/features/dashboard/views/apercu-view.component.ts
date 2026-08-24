import { CommonModule } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { CardModule } from 'primeng/card';
import { ChartModule } from 'primeng/chart';
import { KpiChipRowComponent } from '../../../shared/components/kpi-chip-row/kpi-chip-row.component';
import { AmountBarListComponent } from '../../../shared/components/amount-bar-list/amount-bar-list.component';
import { withAlpha } from '../../../shared/utils/css-vars';
import { DashboardSectionComponent } from '../shared/components/dashboard-section/dashboard-section.component';
import { IndicatorCardComponent } from '../shared/components/indicator-card/indicator-card.component';
import { DashboardFacadeService } from '../shared/services/dashboard-facade.service';

@Component({
  selector: 'app-apercu-view',
  standalone: true,
  imports: [
    CommonModule,
    CardModule,
    ChartModule,
    KpiChipRowComponent,
    AmountBarListComponent,
    DashboardSectionComponent,
    IndicatorCardComponent,
  ],
  templateUrl: './apercu-view.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ApercuViewComponent {
  protected readonly facade = inject(DashboardFacadeService);

  protected readonly fluxMensuelChartData = computed(() => {
    const base = this.facade.mixedChartData() as { labels?: unknown[]; datasets?: Array<Record<string, unknown>> };
    const labels = Array.isArray(base?.labels) ? base.labels : [];
    const datasets = Array.isArray(base?.datasets) ? base.datasets : [];

    if (!labels.length || !datasets.length) {
      return base;
    }

    const period = this.facade.periodValue();
    const activeIndex = period.mode === 'mois' ? period.monthIndex : null;

    return {
      ...base,
      datasets: datasets.map((dataset) => {
        const data = Array.isArray(dataset['data']) ? dataset['data'] : [];
        const baseColor = typeof dataset['backgroundColor'] === 'string'
          ? dataset['backgroundColor']
          : typeof dataset['borderColor'] === 'string'
            ? dataset['borderColor']
            : '#94A3B8';

        if (dataset['type'] === 'bar') {
          return {
            ...dataset,
            backgroundColor: data.map((_, index) => this.opacityColor(baseColor, activeIndex, index)),
          };
        }

        if (dataset['type'] === 'line') {
          const pointRadius = data.map((_, index) => activeIndex !== null && index === activeIndex ? 5 : 2);
          return {
            ...dataset,
            pointRadius,
            pointHoverRadius: pointRadius.map((radius) => radius + 1),
            pointBackgroundColor: data.map((_, index) => this.opacityColor(baseColor, activeIndex, index)),
            pointBorderColor: data.map(() => 'var(--app-card)'),
          };
        }

        return dataset;
      }),
    };
  });

  protected readonly fluxMensuelChartOptions = {
    ...this.facade.mixedChartOptions,
    onClick: (_event: unknown, elements: { index: number }[]) => {
      const monthIndex = elements?.[0]?.index;
      if (monthIndex === undefined) {
        return;
      }

      const current = this.facade.periodValue();
      this.facade.onPeriodChange({ mode: 'mois', monthIndex, year: current.year });
    },
  };

  protected openIndicator(item: { indicator: any; data: unknown }): void {
    this.facade.ouvrirIndicateur(this.facade.dashboardViewLabel('apercu'), item.indicator, item.data);
  }

  private opacityColor(color: string, activeIndex: number | null, monthIndex: number): string {
    return withAlpha(color, activeIndex !== null && monthIndex === activeIndex ? 0.95 : 0.5, color);
  }
}
