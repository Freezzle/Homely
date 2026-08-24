import { CommonModule } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, inject, input } from '@angular/core';
import { TooltipModule } from 'primeng/tooltip';
import { I18nService } from '../../../core/i18n/i18n.service';
import { localeDeLangue } from '../../../core/i18n/locale.util';
import { MontantPipe } from '../../../core/pipes/format.pipes';

export interface AmountBarItem {
  key: string;
  label: string;
  amount: number;
  color: string;
  icon?: string;
  helpText?: string;
  emphasis?: boolean;
}

@Component({
  selector: 'hly-amount-bar-list',
  standalone: true,
  imports: [CommonModule, TooltipModule, MontantPipe],
  templateUrl: './amount-bar-list.component.html',
  styleUrl: './amount-bar-list.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AmountBarListComponent {
  private readonly i18n = inject(I18nService);

  readonly items = input.required<AmountBarItem[]>();
  readonly reference = input<number | undefined>(undefined);
  readonly devise = input<string | undefined>(undefined);
  readonly locale = input<string>(localeDeLangue(this.i18n.currentLang()));

  private readonly effectiveReference = computed(() => {
    const reference = this.reference();
    if (reference != null) {
      return reference;
    }

    return this.items().reduce((max, item) => Math.max(max, item.amount), 0);
  });

  protected percent(item: AmountBarItem): number {
    const reference = this.effectiveReference();
    if (reference <= 0) {
      return 0;
    }

    return Math.max(0, Math.min(100, (item.amount / reference) * 100));
  }
}
