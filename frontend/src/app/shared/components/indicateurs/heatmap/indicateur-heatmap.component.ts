import { ChangeDetectionStrategy, Component, computed, input, output } from '@angular/core';
import { TooltipModule } from 'primeng/tooltip';
import { TonIndicateur, couleurForte } from '../tons';

export interface CelluleHeatmap {
  /** Texte court affiché dans la cellule (ex. « J »). */
  libelle: string;
  ton: TonIndicateur;
  infobulle: string;
}

export interface EntreeLegendeHeatmap {
  libelle: string;
  ton: TonIndicateur;
}

/**
 * Grille de cellules colorées (une par période) + légende optionnelle. Les fonds utilisent
 * la variante foncée du ton pour garantir le contraste du texte blanc.
 */
@Component({
  selector: 'app-indicateur-heatmap',
  standalone: true,
  imports: [TooltipModule],
  templateUrl: './indicateur-heatmap.component.html',
  styleUrl: './indicateur-heatmap.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class IndicateurHeatmapComponent {
  readonly cellules = input.required<CelluleHeatmap[]>();
  readonly legende = input<EntreeLegendeHeatmap[]>([]);
  readonly colonnes = input<number>(12);
  /** Rend les cellules focusables/cliquables et active `celluleClick`. */
  readonly interactif = input<boolean>(false);

  readonly celluleClick = output<number>();

  protected readonly grille = computed(() => `repeat(${Math.max(1, Math.trunc(this.colonnes()))}, minmax(0, 1fr))`);

  protected readonly cellulesAffichees = computed(() =>
    this.cellules().map((cellule, index) => ({ ...cellule, index, fond: couleurForte(cellule.ton) })),
  );

  protected readonly legendeAffichee = computed(() =>
    this.legende().map((entree) => ({ ...entree, couleur: couleurForte(entree.ton) })),
  );

  protected cliquer(index: number): void {
    if (this.interactif()) this.celluleClick.emit(index);
  }
}
