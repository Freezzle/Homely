import { CommonModule } from '@angular/common';
import { Component, input } from '@angular/core';
import { TagModule } from 'primeng/tag';

export type StatGridSeverity = 'success' | 'warn' | 'danger' | 'info' | 'secondary';

export interface StatItem {
  label: string;
  value: string;
  color?: string;
  /** Texte secondaire affiché en petit à droite de la valeur (ex. marge ± d'une fourchette). */
  subValue?: string;
  /** Couleur du texte secondaire (par défaut, couleur muted). */
  subColor?: string;
}

export interface StatGridStatusTag {
  value: string;
  severity: StatGridSeverity;
}

@Component({
  selector: 'app-stat-grid',
  standalone: true,
  imports: [CommonModule, TagModule],
  template: `
    @if (statusTag(); as tag) {
      <p-tag [value]="tag.value" [severity]="tag.severity" />
    }

    <div class="stat-grid" [class.with-tag]="statusTag()">
      @for (stat of stats(); track stat.label) {
        <div>
          <div class="stat-label">{{ stat.label }}</div>
          <div class="stat-value-row">
            <div class="stat-value" [style.color]="stat.color ?? null">{{ stat.value }}</div>
            @if (stat.subValue) {
              <div class="stat-subvalue" [style.color]="stat.subColor ?? null">{{ stat.subValue }}</div>
            }
          </div>
        </div>
      }
    </div>
  `,
  styles: [`
    .stat-grid {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 9px 22px;
    }

    .stat-grid.with-tag {
      margin-top: 12px;
    }

    .stat-label {
      font-size: 11px;
      line-height: 1.25;
      color: var(--app-ink-muted);
    }

    .stat-value {
      margin-top: 0.15rem;
          font-size: 13px;
      line-height: 1.2;
          font-weight: 700;
      color: var(--app-ink);
    }

    .stat-value-row {
      display: flex;
      align-items: baseline;
      gap: 6px;
      flex-wrap: wrap;
    }

    .stat-subvalue {
      font-size: 11px;
      line-height: 1.2;
      font-weight: 500;
      color: var(--app-ink-muted);
    }
  `],
})
export class StatGridComponent {
  readonly stats = input.required<StatItem[]>();
  readonly statusTag = input<StatGridStatusTag | null>(null);
}
