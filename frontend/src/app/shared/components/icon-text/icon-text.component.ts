import { CommonModule } from '@angular/common';
import { Component, input } from '@angular/core';
import { TooltipModule } from 'primeng/tooltip';

/**
 * Icône + texte, alignés en `gap-3`. Le texte peut être masqué (`afficherTexte`
 * = false) : dans ce cas seule l'icône est rendue, avec le texte reporté en
 * `pTooltip` pour rester consultable au survol.
 *
 * Couleurs par défaut alignées sur la charte graphique (`_app-tokens.css`) :
 * icône neutre (`--app-neutre`), texte encre (`--app-ink`).
 */
@Component({
  selector: 'app-icon-text',
  standalone: true,
  imports: [CommonModule, TooltipModule],
  template: `
    <div class="inline-flex items-center gap-2">
      <i [class]="icone()"
         [style.color]="couleurIcone()"
         [pTooltip]="afficherTexte() ? undefined : texte()"></i>
      @if (afficherTexte()) {
        <span [style.color]="couleurTexte()">{{ texte() }}</span>
      }
    </div>
  `,
})
export class IconTextComponent {
  /** Classes de l'icône PrimeNG, ex. `'pi pi-info-circle'`. */
  readonly icone = input.required<string>();
  /** Texte affiché à côté de l'icône, ou reporté en tooltip si `afficherTexte` est faux. */
  readonly texte = input.required<string>();
  readonly afficherTexte = input<boolean>(true);
  readonly couleurIcone = input<string>('var(--app-neutre)');
  readonly couleurTexte = input<string>('var(--app-ink)');
}
