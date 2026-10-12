import { ChangeDetectionStrategy, Component, input, model } from '@angular/core';
import { OptionChoix } from '../choix-cartes/option-choix.model';

let compteurId = 0;

/**
 * Groupe de puces à sélection unique (design system). Même API que
 * `app-choix-cartes`, mais rendu en pilules qui passent à la ligne : adapté aux
 * listes longues (catégories) ou aux choix courts (fréquence, préréglages).
 */
@Component({
  selector: 'app-choix-puces',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (label()) {
      <p class="libelle" [id]="labelId">{{ label() }}</p>
    }
    <div class="puces" role="group" [attr.aria-labelledby]="label() ? labelId : null">
      @for (o of options(); track o.value) {
        <button
          type="button"
          class="puce"
          [class.puce--active]="estActive(o)"
          [disabled]="o.desactive === true"
          [attr.aria-pressed]="estActive(o)"
          [attr.title]="o.sousTitre || null"
          (click)="choisir(o)"
        >
          @if (o.couleur) {
            <span class="pastille" [style.background]="o.couleur" aria-hidden="true"></span>
          }
          {{ o.titre }}
        </button>
      }
    </div>
  `,
  styles: [`
    :host { display: block; }

    .libelle {
      font-size: var(--app-text-sm);
      font-weight: 600;
      color: var(--app-ink-muted);
      margin-bottom: var(--app-space-2);
    }

    .puces { display: flex; flex-wrap: wrap; gap: var(--app-space-2); }

    .puce {
      display: inline-flex;
      align-items: center;
      gap: var(--app-space-1-5);
      min-height: 44px;
      padding: var(--app-space-2) var(--app-space-4);
      background: var(--app-card);
      border: 1px solid var(--app-line-3);
      border-radius: var(--app-radius-pill);
      color: var(--app-ink);
      cursor: pointer;
    }

    .puce:hover:not(:disabled) { border-color: var(--p-primary-color); }

    .puce:disabled { opacity: 0.5; cursor: not-allowed; }

    .puce--active {
      border: 2px solid var(--p-primary-color);
      background: var(--app-selection-bg);
      color: var(--p-primary-color);
      font-weight: 600;
      padding: calc(var(--app-space-2) - 1px) calc(var(--app-space-4) - 1px);
    }

    .pastille {
      width: 10px;
      height: 10px;
      border-radius: var(--app-radius-pill);
      flex: 0 0 auto;
    }
  `],
})
export class ChoixPucesComponent<T> {
  readonly options = input.required<readonly OptionChoix<T>[]>();
  readonly value = model<T | null>(null);
  readonly label = input<string>('');

  protected readonly labelId = `choix-puces-${++compteurId}`;

  protected estActive(o: OptionChoix<T>): boolean {
    return this.value() === o.value;
  }

  protected choisir(o: OptionChoix<T>): void {
    if (o.desactive) return;
    this.value.set(o.value);
  }
}
