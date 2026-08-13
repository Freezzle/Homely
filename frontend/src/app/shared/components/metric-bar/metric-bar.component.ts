import { CommonModule } from '@angular/common';
import { Component, computed, input } from '@angular/core';
import { MeterGroupModule, MeterItem } from 'primeng/metergroup';
import { formatTaux } from '../../utils/format-taux.util';
import { MontantPipe } from '../../../core/pipes/format.pipes';

export interface MetricBarSegment {
  /** Libellé du segment (affiché par `p-meterGroup` avec son pourcentage). */
  label: string;
  /** Valeur utilisée pour calculer la part du segment dans la barre. */
  value: number;
  color: string;
}

@Component({
  selector: 'app-metric-bar',
  standalone: true,
  imports: [CommonModule, MeterGroupModule, MontantPipe],
  templateUrl: './metric-bar.component.html',
  styleUrl: './metric-bar.component.scss',
})
export class MetricBarComponent {
  readonly segments = input.required<MetricBarSegment[]>();
  /** Libellé du premier item affiché au-dessus de la barre (ex. Revenus), sans pourcentage. */
  readonly leadLabel = input<string>('');
  /** Montant déjà formaté du premier item. */
  readonly leadValue = input<string>('');
  /** Mode d'affichage du libellé de chaque segment : `'percent'` (défaut, part du
   *  segment dans le total) ou `'montant'` (valeur brute formatée en devise). */
  readonly displayMode = input<'percent' | 'montant'>('percent');
  /** Devise utilisée pour le formatage en mode `'montant'`. */
  readonly devise = input<string>('CHF');

  protected readonly meterItems = computed<MeterItem[]>(() =>
    this.segments().map((segment) => ({
      label: segment.label,
      value: segment.value,
      color: segment.color,
    }))
  );

  protected readonly total = computed(() =>
    this.segments().reduce((acc, segment) => acc + Math.max(segment.value, 0), 0) || 1
  );

  /** Pourcentage d'un segment (0-100), formaté avec au plus 1 décimale via `formatTaux` —
   *  remplace l'arrondi à l'entier fait par défaut par `p-meterGroup`. */
  protected percentLabel(value: number | undefined): string {
    const pct = ((value ?? 0) / this.total()) * 100;
    return formatTaux(Math.max(0, Math.min(100, pct)));
  }
}

