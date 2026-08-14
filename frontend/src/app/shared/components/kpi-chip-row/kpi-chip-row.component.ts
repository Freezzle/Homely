import { CommonModule } from '@angular/common';
import { Component, input } from '@angular/core';
import { KpiChip, KpiChipComponent } from '../kpi-chip/kpi-chip.component';

@Component({
  selector: 'app-kpi-chip-row',
  standalone: true,
  imports: [CommonModule, KpiChipComponent],
  template: `
    @if (items()) {
      <div class="kpi-row">
        @for (item of items()!; track item.label) {
          <app-kpi-chip [chip]="item" />
        }
      </div>
    } @else {
      <div class="kpi-row"><ng-content /></div>
    }
  `,
  styles: [`
    /* Le hôte devient le conteneur de référence pour la @container query ci-dessous :
     * on ne se base pas sur la largeur du viewport, mais sur l'espace réellement
     * disponible pour la ligne de chips (qui dépend de la mise en page/carte parente). */
    :host {
      display: block;
      container-type: inline-size;
    }

    .kpi-row {
      display: grid;
      grid-template-columns: repeat(2, minmax(0, 1fr));
      gap: 10px;
    }

    /* Uniquement 2 ou 4 colonnes : jamais de valeur intermédiaire (3) qui isolerait
     * un chip seul sur sa ligne. En dessous du seuil : 2 par ligne ; au-dessus : 4. */
    @container (min-width: 640px) {
      .kpi-row {
        grid-template-columns: repeat(4, minmax(0, 1fr));
      }
    }
  `],
})
export class KpiChipRowComponent {
  readonly items = input<KpiChip[] | undefined>(undefined);
}
