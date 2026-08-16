import { CommonModule } from '@angular/common';
import { Component, input } from '@angular/core';
import { TagModule } from 'primeng/tag';
import { ButtonModule } from 'primeng/button';
import { TooltipModule } from 'primeng/tooltip';

export type KpiChipSeverity = 'success' | 'warn' | 'danger' | 'info' | 'secondary';

/** Action rapide optionnelle affichée en icône dans le coin du chip (ex. PR6 —
 *  créer/modifier une allocation d'argent de poche directement depuis le KPI
 *  du dashboard mensuel, sans naviguer vers l'écran de gestion dédié). */
export interface KpiChipAction {
  icon: string;
  ariaLabel: string;
  onClick: () => void;
}

export interface KpiChip {
  label: string;
  value: string | number;
  hint?: string;
  color?: string;
  severity?: KpiChipSeverity;
  action?: KpiChipAction;
}

@Component({
  selector: 'app-kpi-chip',
  standalone: true,
  imports: [CommonModule, TagModule, ButtonModule, TooltipModule],
  template: `
    <div class="kpi-chip">
      <div class="kpi-content">
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
      @if (chip().action; as action) {
        <p-button [icon]="action.icon" [text]="true" styleClass="kpi-action"
                  [ariaLabel]="action.ariaLabel" [pTooltip]="action.ariaLabel"
                  (click)="action.onClick()" />
      }
    </div>
  `,
  styles: [`
    .kpi-chip {
      height: 100%;
      border: 1px solid var(--app-line);
      background: var(--app-bg);
      border-radius: var(--p-content-border-radius);
      display: flex;
      flex-direction: row;
      align-items: stretch;
      overflow: hidden;
    }

    .kpi-content {
      flex: 1 1 auto;
      min-width: 0;
      padding: 0.75rem 0.75rem;
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

    /* Bouton d'action (ex. créer/modifier l'allocation d'argent de poche) affiché
       en bande verticale sur toute la hauteur du chip, icône centrée, plutôt
       qu'un petit bouton dans le coin. */
    :host ::ng-deep .kpi-action.p-button {
      flex: 0 0 auto;
      height: 100%;
      border-radius: 0;
      border-left: 1px solid var(--app-line);
      display: flex;
      align-items: center;
      justify-content: center;
    }

    .kpi-label {
      font-size: 10px;
      line-height: 1.2;
      text-transform: uppercase;
      letter-spacing: 0.08em;
      color: var(--app-ink-muted);
      font-weight: 700;
    }

    .kpi-value {
      font-size: 14px;
      line-height: 1.2;
      font-weight: 800;
      color: var(--app-ink);
      word-break: break-word;
    }

    .kpi-hint {
      font-size: 11px;
      line-height: 1.25;
      color: var(--app-ink-muted);
    }
  `],
})
export class KpiChipComponent {
  readonly chip = input.required<KpiChip>();
}
