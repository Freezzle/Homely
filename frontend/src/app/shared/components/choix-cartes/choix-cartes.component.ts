import { ChangeDetectionStrategy, Component, computed, input, model } from '@angular/core';
import { OptionChoix } from './option-choix.model';

let compteurId = 0;

/**
 * Groupe de cartes à sélection unique (design system) : une grille de vrais
 * `<button>` portant un titre et un sous-titre facultatif. Remplace les
 * `p-selectbutton` quand chaque choix a besoin d'une explication courte.
 *
 * Purement présentationnel : aucune logique métier, la valeur est pilotée via
 * `model()` (`[(value)]` ou `[value]` + `(valueChange)`).
 */
@Component({
  selector: 'app-choix-cartes',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (label()) {
      <p class="libelle" [id]="labelId">{{ label() }}</p>
    }
    <div
      class="cartes"
      role="group"
      [attr.aria-labelledby]="label() ? labelId : null"
      [style.grid-template-columns]="colonnes()"
    >
      @for (o of options(); track o.value) {
        <button
          type="button"
          class="carte"
          [class.carte--active]="estActive(o)"
          [disabled]="o.desactive === true"
          [attr.aria-pressed]="estActive(o)"
          (click)="choisir(o)"
        >
          <span class="titre">{{ o.titre }}</span>
          @if (o.sousTitre || o.pastilles?.length) {
            <span class="ligne-sous-titre">
              @if (o.pastilles?.length) {
                <span class="pastilles" aria-hidden="true">
                  @for (p of o.pastilles; track p.libelle) {
                    <span class="pastille" [style.background]="p.couleur"></span>
                  }
                </span>
              }
              @if (o.sousTitre) {
                <span class="sous-titre">{{ o.sousTitre }}</span>
              }
            </span>
          }
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

    .cartes { display: grid; gap: var(--app-space-2); }

    .carte {
      display: flex;
      flex-direction: column;
      justify-content: center;
      gap: var(--app-space-0-5);
      min-height: 56px;
      padding: var(--app-space-2-5) var(--app-space-3-5);
      text-align: left;
      background: var(--app-card);
      border: 1px solid var(--app-line-3);
      border-radius: var(--app-radius-card);
      color: var(--app-ink);
      cursor: pointer;
    }

    .carte:hover:not(:disabled) { border-color: var(--p-primary-color); }

    .carte:disabled { opacity: 0.5; cursor: not-allowed; }

    .carte--active {
      border: 2px solid var(--p-primary-color);
      background: var(--app-selection-bg);
      padding: calc(var(--app-space-2-5) - 1px) calc(var(--app-space-3-5) - 1px);
    }

    .carte--active .titre { color: var(--p-primary-color); }

    .titre { font-weight: 600; }

    .sous-titre {
      font-size: var(--app-text-xs);
      color: var(--app-ink-muted);
    }

    .ligne-sous-titre {
      display: flex;
      align-items: center;
      gap: var(--app-space-1-5);
      min-width: 0;
    }

    .pastilles {
      display: inline-flex;
      flex: 0 0 auto;
      align-items: center;
    }

    /* Pastilles légèrement chevauchées : elles se lisent comme un groupe de personnes. */
    .pastille {
      width: 10px;
      height: 10px;
      border-radius: var(--app-radius-pill);
      border: 1px solid var(--app-card);
    }

    .pastille + .pastille { margin-left: -3px; }
  `],
})
export class ChoixCartesComponent<T> {
  readonly options = input.required<readonly OptionChoix<T>[]>();
  readonly value = model<T | null>(null);
  readonly label = input<string>('');
  /** Largeur minimale d'une carte — permet des grilles plus ou moins denses. */
  readonly largeurMin = input<string>('9rem');

  protected readonly labelId = `choix-cartes-${++compteurId}`;

  protected readonly colonnes = computed(() => `repeat(auto-fill, minmax(${this.largeurMin()}, 1fr))`);

  protected estActive(o: OptionChoix<T>): boolean {
    return this.value() === o.value;
  }

  protected choisir(o: OptionChoix<T>): void {
    if (o.desactive) return;
    this.value.set(o.value);
  }
}
