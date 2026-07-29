import { CommonModule } from '@angular/common';
import { Component, computed, input } from '@angular/core';

export interface MetricRingSegment {
  value: number;
  color: string;
  label?: string;
}

@Component({
  selector: 'app-metric-ring',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './metric-ring.component.html',
  styleUrl: './metric-ring.component.scss',
})
export class MetricRingComponent {
  readonly segments = input.required<MetricRingSegment[]>();
  readonly centerValue = input.required<string>();
  readonly centerLabel = input<string>('');
  readonly size = input<number>(168);
  readonly showLegend = input<boolean>(false);

  protected readonly gradient = computed(() => {
    const segs = this.segments();
    const total = segs.reduce((a, s) => a + Math.max(s.value, 0), 0) || 1;
    let acc = 0;

    return segs
      .map((segment) => {
        const from = (acc / total) * 100;
        acc += Math.max(segment.value, 0);
        const to = (acc / total) * 100;
        return `${segment.color} ${from}% ${to}%`;
      })
      .join(', ');
  });

  protected readonly legendSegments = computed(() =>
    this.segments().filter((segment) => !!segment.label)
  );
}
