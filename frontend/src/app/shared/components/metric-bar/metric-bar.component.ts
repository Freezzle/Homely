import { CommonModule } from '@angular/common';
import { Component, computed, input } from '@angular/core';
import { MeterGroupModule, MeterItem } from 'primeng/metergroup';

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
  imports: [CommonModule, MeterGroupModule],
  templateUrl: './metric-bar.component.html',
  styleUrl: './metric-bar.component.scss',
})
export class MetricBarComponent {
  readonly segments = input.required<MetricBarSegment[]>();
  /** Libellé du premier item affiché au-dessus de la barre (ex. Revenus), sans pourcentage. */
  readonly leadLabel = input<string>('');
  /** Montant déjà formaté du premier item. */
  readonly leadValue = input<string>('');

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
}
