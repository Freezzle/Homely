import { ChangeDetectionStrategy, Component, input, model } from '@angular/core';

const VALEURS = [1, 2, 3, 4, 5] as const;

/**
 * Échelle de notation de 1 à 5 (design system) : cinq boutons égaux, remplis en
 * dégradé jusqu'à la valeur choisie, encadrés par un libellé minimum et maximum.
 * Remplace les `p-slider` 1–5 (importance, potentiel d'optimisation, dérive).
 */
@Component({
  selector: 'app-echelle-notation',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="flex items-baseline justify-between gap-3">
      <span class="libelle">{{ label() }}</span>
      @if (question()) {
        <span class="question">{{ question() }}</span>
      }
    </div>

    <div class="echelle" role="group" [attr.aria-label]="label()">
      @for (v of valeurs; track v) {
        <button
          type="button"
          class="cran"
          [class.cran--rempli]="v <= value()"
          [class.cran--courant]="v === value()"
          [attr.aria-pressed]="v === value()"
          [attr.aria-label]="ariaCran(v)"
          (click)="value.set(v)"
        >{{ v }}</button>
      }
    </div>

    <div class="flex items-baseline justify-between gap-3">
      <span class="borne">{{ libelleMin() }}</span>
      <span class="borne">{{ libelleMax() }}</span>
    </div>
  `,
  styles: [`
    :host { display: block; }

    .libelle { font-size: var(--app-text-sm); font-weight: 600; color: var(--app-ink); }

    .question { font-size: var(--app-text-xs); color: var(--app-ink-muted); text-align: right; }

    .echelle {
      display: grid;
      grid-template-columns: repeat(5, 1fr);
      gap: var(--app-space-2);
      margin: var(--app-space-2) 0 var(--app-space-1);
    }

    .cran {
      height: 44px;
      background: var(--app-card);
      border: 1px solid var(--app-line-3);
      border-radius: var(--app-radius-item);
      color: var(--app-ink-muted);
      font-variant-numeric: tabular-nums;
      cursor: pointer;
    }

    .cran:hover { border-color: var(--p-primary-color); }

    .cran--rempli { background: var(--app-selection-bg); color: var(--app-ink); }

    .cran--courant {
      border: 2px solid var(--p-primary-color);
      background: var(--app-selection-bg-fort);
      color: var(--p-primary-color);
      font-weight: 700;
    }

    .borne { font-size: var(--app-text-xs); color: var(--app-ink-muted); }
  `],
})
export class EchelleNotationComponent {
  readonly value = model<number>(3);
  readonly label = input.required<string>();
  readonly question = input<string>('');
  readonly libelleMin = input<string>('');
  readonly libelleMax = input<string>('');
  /** Gabarit accessible, ex. « {{label}} : {{n}} sur 5 » (fourni déjà traduit). */
  readonly gabaritAria = input<string>('');

  protected readonly valeurs = VALEURS;

  protected ariaCran(n: number): string {
    const gabarit = this.gabaritAria();
    if (!gabarit) return `${this.label()} : ${n} / 5`;
    return gabarit.replace('{{label}}', this.label()).replace('{{n}}', String(n));
  }
}
