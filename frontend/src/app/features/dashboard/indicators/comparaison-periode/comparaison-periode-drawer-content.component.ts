import { Component, ChangeDetectionStrategy, Signal, inject, input } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MontantPipe } from '../../../../core/pipes/format.pipes';
import { I18nService } from '../../../../core/i18n/i18n.service';

/**
 * Payload transmis via `IndicatorDrawerService.open({ data })` — références de signaux pour
 * rester réactif (changement de période) sans dupliquer le calcul des diffs déjà fait dans
 * `DashboardComponent` (`diffRevenusMois`/`diffChargesMois`/... ou leur variante annuelle).
 * `diffArgentPoche` vaut `null` quand la ligne n'est pas applicable (mode foyer).
 */
export interface ComparaisonPeriodeDrawerData {
  diffPrincipal: Signal<number | null>;
  diffRevenus: Signal<number | null>;
  diffCharges: Signal<number | null>;
  diffReserves: Signal<number | null>;
  diffArgentPoche: Signal<number | null> | null;
  devise: Signal<string>;
}

/**
 * Contenu du drawer pour l'indicateur "Comparaison" (mois/année passé·e) : gros KPI en
 * tête reprenant le diff de reste à vivre déjà affiché sur la carte, puis une liste
 * détaillée des diffs par grandeur (revenus, charges, réserves, argent de poche) — même
 * style de liste label/valeur que `comptes-membre-recap`.
 */
@Component({
  selector: 'app-comparaison-periode-drawer-content',
  standalone: true,
  imports: [CommonModule, MontantPipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './comparaison-periode-drawer-content.component.html',
})
export class ComparaisonPeriodeDrawerContentComponent {
  private readonly i18n = inject(I18nService);
  protected readonly t = this.i18n.translations();

  readonly data = input<ComparaisonPeriodeDrawerData>();

  protected diffColor(diff: number | null, inverse: boolean = false): string {
    if (diff === null) return 'var(--p-text-muted-color)';
    return (diff >= 0 && !inverse) || (diff < 0 && inverse) ? 'var(--p-green-500)' : 'var(--p-red-500)';
  }

  protected diffSigne(diff: number): string {
    return diff >= 0 ? '+' : '';
  }
}
