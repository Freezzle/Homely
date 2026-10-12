import {
  ChangeDetectionStrategy, Component, ElementRef, afterNextRender, input, model, signal, viewChildren,
} from '@angular/core';
import { normaliserCouleur } from '../../utils/couleur.util';

/** "rgb(99, 102, 241)" → "#6366f1". Renvoie `null` si la couleur n'est pas résoluble. */
function rgbVersHex(rgb: string): string | null {
  const m = rgb.match(/^rgba?\((\d+),\s*(\d+),\s*(\d+)/);
  if (!m) return null;
  return '#' + [1, 2, 3].map(i => Number(m[i]).toString(16).padStart(2, '0')).join('');
}

/**
 * Palette des 10 tons catégoriels de la charte (`--app-categorie-1..10`) : un
 * choix rapide de couleur pour un membre.
 *
 * Aucune valeur CSS en dur : les pastilles rendent les tokens, et la couleur
 * **résolue** (hex) est lue sur l'élément une fois rendu — c'est elle qui est
 * remontée, car les DTO stockent un hex.
 */
@Component({
  selector: 'app-palette-couleurs',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (label()) {
      <p class="libelle">{{ label() }}</p>
    }
    <div class="palette" role="group" [attr.aria-label]="label() || null">
      @for (c of couleurs; track c) {
        <button
          #pastille
          type="button"
          class="pastille"
          [class.pastille--active]="estActive(c)"
          [style.background]="'var(--app-categorie-' + c + ')'"
          [attr.aria-pressed]="estActive(c)"
          [attr.aria-label]="ariaPastille(c)"
          (click)="choisir(c)"
        ></button>
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

    .palette { display: flex; flex-wrap: wrap; gap: var(--app-space-2); }

    .pastille {
      width: 44px;
      height: 44px;
      border: 2px solid transparent;
      border-radius: var(--app-radius-pill);
      box-shadow: inset 0 0 0 2px var(--app-card);
      cursor: pointer;
    }

    .pastille:hover { border-color: var(--app-line-3); }

    .pastille--active { border-color: var(--app-ink); }
  `],
})
export class PaletteCouleursComponent {
  /** Couleur courante, en hexadécimal (format attendu par les DTO). */
  readonly value = model<string | null>(null);
  readonly label = input<string>('');
  /** Gabarit accessible, ex. « Couleur {{n}} » (fourni déjà traduit). */
  readonly gabaritAria = input<string>('{{n}}');

  protected readonly couleurs = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10] as const;

  private readonly pastilles = viewChildren<ElementRef<HTMLElement>>('pastille');
  /** Couleurs résolues (hex), lues sur le DOM une fois les pastilles rendues. */
  private readonly hex = signal<string[]>([]);

  constructor() {
    afterNextRender(() => {
      this.hex.set(
        this.pastilles().map(p => rgbVersHex(getComputedStyle(p.nativeElement).backgroundColor) ?? ''),
      );
    });
  }

  protected estActive(n: number): boolean {
    const hex = this.hex()[n - 1];
    // La valeur stockée peut l'être avec ou sans `#` (cf. `normaliserCouleur`).
    return !!hex && normaliserCouleur(this.value()).toLowerCase() === hex;
  }

  protected choisir(n: number): void {
    const hex = this.hex()[n - 1];
    if (hex) this.value.set(hex);
  }

  protected ariaPastille(n: number): string {
    return this.gabaritAria().replace('{{n}}', String(n));
  }
}
