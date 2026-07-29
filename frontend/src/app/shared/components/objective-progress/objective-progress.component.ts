import { CommonModule } from '@angular/common';
import { Component, computed, input } from '@angular/core';
import { ProgressBarModule } from 'primeng/progressbar';
import { TagModule } from 'primeng/tag';

export type ObjectiveProgressSeverity = 'success' | 'warn' | 'danger' | 'info' | 'secondary';

@Component({
  selector: 'app-objective-progress',
  standalone: true,
  imports: [CommonModule, TagModule, ProgressBarModule],
  template: `
    <div class="obj-item">
      <div class="obj-top">
        <b>{{ emoji() }} {{ name() }}</b>
        <p-tag [value]="status()" [severity]="severity()" />
      </div>
      <p-progressbar [value]="pctClamped()" [showValue]="false" [style]="{ height: '7px' }" />
      @if (meta()) {
        <div class="obj-meta">{{ meta() }}</div>
      }
    </div>
  `,
  styles: [`
    .obj-item {
      display: flex;
      flex-direction: column;
      gap: 0.6rem;
    }

    .obj-top {
      display: flex;
      justify-content: space-between;
      align-items: center;
      gap: 0.8rem;
    }

    .obj-meta {
      font-size: 0.8rem;
      line-height: 1.25;
      color: var(--p-text-muted-color);
    }
  `],
})
export class ObjectiveProgressComponent {
  readonly emoji = input<string>('🎯');
  readonly name = input.required<string>();
  readonly status = input.required<string>();
  readonly severity = input<ObjectiveProgressSeverity>('info');
  readonly pct = input.required<number>();
  readonly meta = input<string>('');

  protected readonly pctClamped = computed(() => Math.max(0, Math.min(100, this.pct())));
}
