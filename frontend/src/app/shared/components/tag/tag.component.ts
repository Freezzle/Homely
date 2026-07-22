import { Component, computed, input } from '@angular/core';
import { normaliserCouleur, couleurTexteContraste } from '../../utils/couleur.util';

/**
 * Tag « couleur + texte » réutilisable (ex. tag membre) : fond coloré, texte contrasté
 * automatiquement pour rester lisible quelle que soit la couleur fournie.
 * Reprend le style utilisé pour les tags membre (`postes-liste`, `comptes`,
 * `repartition-periodes`) afin d'éviter la duplication de markup/logique couleur.
 */
@Component({
  selector: 'app-tag',
  standalone: true,
  template: `
    <span class="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium leading-none"
          [style.background-color]="couleurFond()"
          [style.color]="couleurTexte()">
      {{ texte() }}
    </span>
  `,
})
export class TagComponent {
  readonly couleur = input<string | null | undefined>();
  readonly texte = input<string>('');

  readonly couleurFond = computed(() => normaliserCouleur(this.couleur()));
  readonly couleurTexte = computed(() => couleurTexteContraste(this.couleurFond()));
}
