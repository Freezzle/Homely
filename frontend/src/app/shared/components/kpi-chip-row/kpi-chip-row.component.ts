import { CommonModule } from '@angular/common';
import { Component, input } from '@angular/core';
import { KpiChip, KpiChipComponent } from '../kpi-chip/kpi-chip.component';

@Component({
  selector: 'app-kpi-chip-row',
  standalone: true,
  imports: [CommonModule, KpiChipComponent],
  template: `
    @if (items()) {
      <div class="kpi-row">
        @for (item of items()!; track item.label) {
          <app-kpi-chip [chip]="item" />
        }
      </div>
    } @else {
      <div class="kpi-row"><ng-content /></div>
    }
  `,
  styles: [`
    .kpi-row {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(160px, 1fr));
      gap: 10px;
    }
  `],
})
export class KpiChipRowComponent {
  readonly items = input<KpiChip[] | undefined>(undefined);
}
