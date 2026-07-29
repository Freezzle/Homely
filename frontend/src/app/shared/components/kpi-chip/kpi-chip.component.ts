import { CommonModule } from '@angular/common';
import { Component, input } from '@angular/core';
import { TagModule } from 'primeng/tag';

export type KpiChipSeverity = 'success' | 'warn' | 'danger' | 'info' | 'secondary';

export interface KpiChip {
  label: string;
  value: string | number;
  hint?: string;
  color?: string;
  severity?: KpiChipSeverity;
}

@Component({
  selector: 'app-kpi-chip',
  standalone: true,
  imports: [CommonModule, TagModule],
  template: `
    <div class="kpi-chip">
      <div class="kpi-head">
        <div class="kpi-label">{{ chip().label }}</div>
        @if (chip().severity; as severity) {
          <p-tag [value]="severity" [severity]="severity" />
        }
      </div>
      <div class="kpi-value" [style.color]="chip().color ?? null">{{ chip().value }}</div>
      @if (chip().hint; as hint) {
        <div class="kpi-hint">{{ hint }}</div>
      }
    </div>
  `,
  styles: [`
    .kpi-chip {
      height: 100%;
      border: 1px solid var(--p-content-border-color);
      background: var(--p-surface-50);
      border-radius: var(--p-content-border-radius);
      padding: 0.85rem 0.95rem;
      display: flex;
      flex-direction: column;
      gap: 0.3rem;
    }

    .kpi-head {
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
      gap: 0.6rem;
    }

    .kpi-label {
      font-size: 10px;
      line-height: 1.2;
      text-transform: uppercase;
      letter-spacing: 0.08em;
      color: var(--p-text-muted-color);
      font-weight: 700;
    }

    .kpi-value {
      font-size: 17px;
      line-height: 1.2;
      font-weight: 800;
      color: var(--p-text-color);
      word-break: break-word;
    }

    .kpi-hint {
      font-size: 11px;
      line-height: 1.25;
      color: var(--p-text-muted-color);
    }
  `],
})
export class KpiChipComponent {
  readonly chip = input.required<KpiChip>();
}
