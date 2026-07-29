import { CommonModule } from '@angular/common';
import { Component, inject, input } from '@angular/core';
import { I18nService } from '../../../core/i18n/i18n.service';
import { localeDeLangue } from '../../../core/i18n/locale.util';

export interface ComparisonRow {
  label: string;
  unit?: string;
  a: number;
  b: number;
  lowerBetter?: boolean;
  formatter?: (v: number) => string;
}

@Component({
  selector: 'app-comparison-bar',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './comparison-bar.component.html',
  styleUrl: './comparison-bar.component.scss',
})
export class ComparisonBarComponent {
  private readonly i18n = inject(I18nService);

  readonly rows = input.required<ComparisonRow[]>();
  readonly colorA = input<string>('var(--p-primary-600)');
  readonly colorB = input<string>('var(--p-violet-500)');

  protected winner(row: ComparisonRow): 'a' | 'b' {
    return row.lowerBetter ? (row.a <= row.b ? 'a' : 'b') : (row.a >= row.b ? 'a' : 'b');
  }

  protected widthFor(row: ComparisonRow, side: 'a' | 'b'): number {
    const winner = this.winner(row);
    const big = Math.max(row.a, row.b) || 1;
    const small = Math.min(row.a, row.b);
    const ratio = (small / big) * 100;
    return side === winner ? 100 : ratio;
  }

  protected format(row: ComparisonRow, value: number): string {
    if (row.formatter) {
      return row.formatter(value);
    }

    return new Intl.NumberFormat(localeDeLangue(this.i18n.currentLang()), {
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(value);
  }
}
