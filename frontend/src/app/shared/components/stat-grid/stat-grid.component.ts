import { CommonModule } from '@angular/common';
import { Component, input } from '@angular/core';
import { TagModule } from 'primeng/tag';

export type StatGridSeverity = 'success' | 'warn' | 'danger' | 'info' | 'secondary';

export interface StatItem {
  label: string;
  value: string;
  color?: string;
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
          <div class="stat-value" [style.color]="stat.color ?? null">{{ stat.value }}</div>
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
      color: var(--p-text-muted-color);
    }

    .stat-value {
      margin-top: 0.15rem;
          font-size: 13px;
      line-height: 1.2;
          font-weight: 700;
      color: var(--p-text-color);
    }
  `],
})
export class StatGridComponent {
  readonly stats = input.required<StatItem[]>();
  readonly statusTag = input<StatGridStatusTag | null>(null);
}
