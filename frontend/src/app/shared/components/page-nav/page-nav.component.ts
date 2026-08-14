import { Component, OnInit, inject, input, model } from '@angular/core';
import { MontantPipe } from '../../../core/pipes/format.pipes';
import { I18nService } from '../../../core/i18n/i18n.service';
import { ViewportService } from '../../../core/services/viewport.service';

export interface PageNavMonthSummary {
  mois: number;
  label: string;
  solde: number;
}

export interface PageNavSelection {
  mode: 'annee' | 'mois';
  mois?: number;
}

@Component({
  selector: 'app-page-nav',
  standalone: true,
  imports: [MontantPipe],
  template: `
    @if (viewport.estCompact()) {
      <div class="pn-chip-bar">
        <button
          type="button"
          class="pn-chip"
          [class.cur]="selection().mode === 'annee'"
          (click)="selectAnnee()">
          <span>{{ t.dashboard.vueDensemble }}</span>
          <span class="pn-s pn-s-pos">{{ annee() }}</span>
        </button>
        @for (m of months(); track m.mois) {
          <button
            type="button"
            class="pn-chip"
            [class.cur]="selection().mode === 'mois' && selection().mois === m.mois"
            (click)="selectMois(m.mois)">
            <span class="pn-chip-label">{{ m.label }}</span>
            <span class="pn-chip-s" [class.pn-s-pos]="m.solde >= 0" [class.pn-s-neg]="m.solde < 0">
              {{ m.solde >= 0 ? '+' : '' }}{{ m.solde | montant }}
            </span>
          </button>
        }
      </div>
    } @else {
      <aside class="pn-aside">
        <div class="pn-label">{{ t.dashboard.periode }}</div>
        <button
          type="button"
          class="pn-item"
          [class.cur]="selection().mode === 'annee'"
          (click)="selectAnnee()">
          <span>{{ t.dashboard.vueDensemble }}</span>
          <span class="pn-s pn-s-pos">{{ annee() }}</span>
        </button>
        @for (m of months(); track m.mois) {
          <button
            type="button"
            class="pn-item"
            [class.cur]="selection().mode === 'mois' && selection().mois === m.mois"
            (click)="selectMois(m.mois)">
            <span>{{ m.label }}</span>
            <span class="pn-s" [class.pn-s-pos]="m.solde >= 0" [class.pn-s-neg]="m.solde < 0">
              {{ m.solde >= 0 ? '+' : '' }}{{ m.solde | montant }}
            </span>
          </button>
        }
      </aside>
    }
  `,
  styles: [`
    .pn-aside {
      display: flex;
      flex-direction: column;
      gap: 2px;
      padding: 16px 12px;
      background: var(--app-card);
      border-left: 1px solid var(--app-line);
      height: 100%;
      overflow-y: auto;
    }

    .pn-label {
      margin-bottom: 6px;
      color: var(--app-ink-muted);
      font-size: 12px;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: 0.04em;
    }

    .pn-item {
      display: flex;
      justify-content: space-between;
      align-items: center;
      gap: 6px;
      padding: 6px 10px;
      border-radius: 8px;
      color: var(--app-ink-muted);
      font-size: 12px;
      font-weight: 600;
      background: transparent;
      border: none;
      cursor: pointer;
      width: 100%;
      text-align: left;
      font-family: inherit;
    }

    .pn-item:hover {
      background: var(--app-line-2);
      color: var(--app-ink);
    }

    .pn-item.cur {
      background: var(--p-primary-50);
      color: var(--app-ink);
      font-weight: 700;
      box-shadow: inset 2.5px 0 0 var(--p-primary-color);
    }

    .pn-s {
      font-family: var(--font-mono);
      font-variant-numeric: tabular-nums;
      font-size: 12px;
    }

    .pn-s-pos {
      color: var(--app-positif);
    }

    .pn-s-neg {
      color: var(--app-negatif);
    }

    .pn-chip-bar {
      display: flex;
      gap: 6px;
      overflow-x: auto;
      padding: 10px 20px;
      background: var(--app-card);
      border-bottom: 1px solid var(--app-line);
      scrollbar-width: none;
    }

    .pn-chip-bar::-webkit-scrollbar {
      display: none;
    }

    .pn-chip {
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 1px;
      flex-shrink: 0;
      border: 1.5px solid var(--app-line);
      background: var(--app-card);
      border-radius: 14px;
      padding: 5px 13px;
      font-size: 12px;
      font-weight: 700;
      color: var(--app-ink-muted);
      cursor: pointer;
      font-family: inherit;
    }

    .pn-chip.cur {
      border-color: var(--p-primary-color);
      background: var(--p-primary-50);
      color: var(--app-ink);
    }

    .pn-chip-label {
      white-space: nowrap;
    }

    .pn-chip-s {
      font-family: var(--font-mono);
      font-variant-numeric: tabular-nums;
      font-size: 10px;
      font-weight: 600;
      white-space: nowrap;
    }
  `],
})
export class PageNavComponent implements OnInit {
  private readonly i18n = inject(I18nService);
  protected readonly viewport = inject(ViewportService);
  readonly t = this.i18n.translations();

  readonly annee = input.required<number>();
  readonly months = input.required<PageNavMonthSummary[]>();
  readonly selection = model.required<PageNavSelection>();

  ngOnInit(): void {
    if (this.months().length !== 12) {
      console.warn(`[PageNavComponent] Expected 12 months, received ${this.months().length}.`);
    }
  }

  protected selectAnnee(): void {
    this.selection.set({ mode: 'annee' });
  }

  protected selectMois(mois: number): void {
    this.selection.set({ mode: 'mois', mois });
  }
}
