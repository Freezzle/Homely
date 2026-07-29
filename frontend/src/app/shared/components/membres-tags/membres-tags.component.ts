import { Component, input } from '@angular/core';
import { TagComponent } from '../tag/tag.component';
import { MembreDto } from '../../../core/models/api.models';

/**
 * Liste de tags membre (couleur + nom), affichés en ligne avec retour à la ligne
 * automatique. Reprend le markup utilisé initialement dans `postes-liste`,
 * `comptes` et `repartition-periodes` pour afficher les membres rattachés à un
 * compte/poste, factorisé ici pour éviter la duplication.
 */
@Component({
  selector: 'app-membres-tags',
  standalone: true,
  imports: [TagComponent],
  templateUrl: './membres-tags.component.html',
})
export class MembresTagsComponent {
  readonly membres = input<Pick<MembreDto, 'id' | 'nom' | 'couleur'>[]>([]);
}
