import { CommonModule } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  HostListener,
  computed,
  effect,
  inject,
  input,
  output,
  untracked,
} from '@angular/core';
import { ButtonModule } from 'primeng/button';
import { TooltipModule } from 'primeng/tooltip';
import { I18nService } from '../../../core/i18n/i18n.service';
import { MontantPipe } from '../../../core/pipes/format.pipes';
import { ViewportService } from '../../../core/services/viewport.service';

export type PeriodMode = 'mois' | 'annee';

export interface PeriodValue {
  mode: PeriodMode;
  monthIndex: number;
  year: number;
}

export interface MonthHealth {
  monthIndex: number;
  amount: number;
  level: 'low' | 'mid' | 'high';
}

interface PeriodRailMonth extends MonthHealth {
  label: string;
  active: boolean;
  ariaLabel: string;
  tooltip: string;
}

@Component({
  selector: 'hly-period-rail',
  standalone: true,
  imports: [CommonModule, ButtonModule, TooltipModule],
  templateUrl: './period-rail.component.html',
  styleUrl: './period-rail.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    class: 'pr-host',
    tabindex: '0',
  },
})
export class PeriodRailComponent {
  protected readonly i18n = inject(I18nService);
  protected readonly viewport = inject(ViewportService);
  private readonly hostElement = inject(ElementRef<HTMLElement>);
  private readonly montantPipe = inject(MontantPipe);

  readonly t = this.i18n.translations();

  readonly value = input.required<PeriodValue>();
  readonly monthsHealth = input.required<MonthHealth[]>();
  readonly minYear = input(2024);
  readonly maxYear = input(2028);

  readonly valueChange = output<PeriodValue>();

  protected readonly isYearMode = computed(() => this.value().mode === 'annee');
  protected readonly canGoPrevYear = computed(() => this.value().year > this.minYear());
  protected readonly canGoNextYear = computed(() => this.value().year < this.maxYear());
  protected readonly titleLine = computed(() => {
    const value = this.value();
    return value.mode === 'mois'
      ? `${this.monthLabel(value.monthIndex)} ${value.year} · ${this.t.periodRail.vueMensuelle}`
      : `${this.i18n.instant('dashboard.vueAnnuelle', { annee: value.year })} · ${this.t.periodRail.vueAnnuelleResume}`;
  });
  protected readonly months = computed<PeriodRailMonth[]>(() => {
    const value = this.value();
    const healthByMonth = new Map<number, MonthHealth>();

    for (const entry of this.monthsHealth()) {
      if (entry.monthIndex >= 0 && entry.monthIndex <= 11 && !healthByMonth.has(entry.monthIndex)) {
        healthByMonth.set(entry.monthIndex, entry);
      }
    }

    return Array.from({ length: 12 }, (_, monthIndex) => {
      const month = healthByMonth.get(monthIndex) ?? { monthIndex, amount: 0, level: 'mid' as const };
      const label = this.monthLabel(monthIndex);
      const levelLabel = this.levelLabel(month.level);
      const amount = this.formatAmount(month.amount);

      return {
        ...month,
        label,
        active: value.mode === 'mois' && value.monthIndex === monthIndex,
        tooltip: this.i18n.instant('periodRail.monthTooltip', { amount, level: levelLabel }),
        ariaLabel: this.i18n.instant('periodRail.monthAriaLabel', {
          month: label,
          year: value.year,
          amount,
          soldeLabel: this.t.periodRail.soldeLabel,
          level: levelLabel,
        }),
      };
    });
  });

  protected readonly yearSummary = computed(() => {
    const value = this.value();
    const healthByMonth = new Map<number, MonthHealth>();

    for (const entry of this.monthsHealth()) {
      if (entry.monthIndex >= 0 && entry.monthIndex <= 11) {
        healthByMonth.set(entry.monthIndex, entry);
      }
    }

    const yearEndHealth = healthByMonth.get(11) ?? { monthIndex: 11, amount: 0, level: 'mid' as const };
    const label = this.i18n.instant('dashboard.vueAnnuelle', { annee: value.year });
    const levelLabel = this.levelLabel(yearEndHealth.level);
    const amount = this.formatAmount(yearEndHealth.amount);

    return {
      label,
      level: yearEndHealth.level,
      tooltip: this.i18n.instant('periodRail.monthTooltip', { amount, level: levelLabel }),
      ariaLabel: this.i18n.instant('periodRail.yearAriaLabel', {
        year: value.year,
        amount,
        soldeLabel: this.t.periodRail.soldeLabel,
        level: levelLabel,
      }),
    };
  });

  private readonly _validateMonthsHealth = effect(() => {
    const monthsHealth = this.monthsHealth();
    const isValidLength = monthsHealth.length === 12;
    const isValidIndexes = monthsHealth.every((entry) => Number.isInteger(entry.monthIndex) && entry.monthIndex >= 0 && entry.monthIndex <= 11);

    if (!isValidLength || !isValidIndexes) {
      console.warn('[PeriodRailComponent] Expected 12 month entries with monthIndex from 0 to 11.', monthsHealth);
    }
  });

  private readonly _centerRememberedMonth = effect(() => {
    const rememberedMonth = this.value().monthIndex;
    this.months();
    this.viewport.estMobile();

    untracked(() => {
      queueMicrotask(() => this.scrollMonthIntoView(rememberedMonth));
    });
  });

  @HostListener('keydown', ['$event'])
  protected onKeydown(event: KeyboardEvent): void {
    if (event.defaultPrevented || event.altKey || event.ctrlKey || event.metaKey) {
      return;
    }

    switch (event.key) {
      case 'ArrowLeft':
        event.preventDefault();
        this.selectRelativeMonth(-1);
        break;
      case 'ArrowRight':
        event.preventDefault();
        this.selectRelativeMonth(1);
        break;
      case 'ArrowUp':
        event.preventDefault();
        this.changeYear(-1);
        break;
      case 'ArrowDown':
        event.preventDefault();
        this.changeYear(1);
        break;
      case 'a':
      case 'A':
        event.preventDefault();
        this.toggleYearMode();
        break;
      default:
        break;
    }
  }

  protected selectMonth(monthIndex: number): void {
    const current = this.value();
    this.emitIfChanged({
      mode: 'mois',
      monthIndex,
      year: current.year,
    });
  }

  protected changeYear(delta: number): void {
    const current = this.value();
    const nextYear = Math.max(this.minYear(), Math.min(this.maxYear(), current.year + delta));

    if (nextYear === current.year) {
      return;
    }

    this.emitIfChanged({
      ...current,
      year: nextYear,
    });
  }

  protected onYearToggleChange(checked: boolean): void {
    const current = this.value();
    this.emitIfChanged({
      ...current,
      mode: checked ? 'annee' : 'mois',
    });
  }

  protected monthTrackBy(index: number, month: PeriodRailMonth): number {
    return month.monthIndex;
  }

  private selectRelativeMonth(delta: number): void {
    const current = this.value();
    let nextYear = current.year;
    let nextMonthIndex = current.monthIndex + delta;

    if (nextMonthIndex < 0) {
      if (current.year <= this.minYear()) {
        return;
      }
      nextYear -= 1;
      nextMonthIndex = 11;
    }

    if (nextMonthIndex > 11) {
      if (current.year >= this.maxYear()) {
        return;
      }
      nextYear += 1;
      nextMonthIndex = 0;
    }

    this.emitIfChanged({
      mode: 'mois',
      monthIndex: nextMonthIndex,
      year: nextYear,
    });
  }

  private emitIfChanged(nextValue: PeriodValue): void {
    const current = this.value();
    if (
      current.mode === nextValue.mode
      && current.monthIndex === nextValue.monthIndex
      && current.year === nextValue.year
    ) {
      return;
    }

    this.valueChange.emit(nextValue);
  }

  private scrollMonthIntoView(monthIndex: number): void {
    const monthButton = this.hostElement.nativeElement
      .querySelector(`.pr-month-btn[data-month-index="${monthIndex}"]`) as HTMLElement | null;
    monthButton?.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' });
  }

  private monthLabel(monthIndex: number): string {
    return this.t.mois[monthIndex] ?? String(monthIndex + 1);
  }

  private levelLabel(level: MonthHealth['level']): string {
    return this.t.periodRail.levels[level];
  }

  private formatAmount(amount: number): string {
    return this.montantPipe.transform(amount);
  }

  protected toggleYearMode(): void {
    this.onYearToggleChange(!this.isYearMode());
  }
}
