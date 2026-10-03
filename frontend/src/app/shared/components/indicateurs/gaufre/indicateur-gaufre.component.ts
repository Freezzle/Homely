import { ChangeDetectionStrategy, Component, computed, inject, input, output } from '@angular/core';
import { TooltipModule } from 'primeng/tooltip';
import { I18nService } from '../../../../core/i18n/i18n.service';
import { localeDeLangue } from '../../../../core/i18n/locale.util';
import { TonIndicateur, couleurPleine, tonCategorie } from '../tons';

export interface SegmentGaufre {
  libelle: string;
  /** Nombre de points occupés (la somme des `compte` doit rester ≤ `total`). */
  compte: number;
  ton?: TonIndicateur;
  infobulle?: string;
}

/**
 * Grille de points représentant une proportion sur un total (100 par défaut).
 * Les points sont remplis de gauche à droite, de haut en bas, dans l'ordre des segments.
 */
@Component({
  selector: 'app-indicateur-gaufre',
  standalone: true,
  imports: [TooltipModule],
  templateUrl: './indicateur-gaufre.component.html',
  styleUrl: './indicateur-gaufre.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class IndicateurGaufreComponent {
  private readonly i18n = inject(I18nService);

  readonly segments = input.required<SegmentGaufre[]>();
  /** Tons appliqués dans l'ordre aux segments sans `ton`. Défaut : palette catégorielle. */
  readonly palette = input<TonIndicateur[] | null>(null);
  readonly colonnes = input<number>(10);
  readonly total = input<number>(100);
  readonly afficherLegende = input<boolean>(true);
  /** Rend les entrées de légende focusables/cliquables et active `segmentClick`. */
  readonly interactif = input<boolean>(false);

  readonly segmentClick = output<number>();

  protected readonly grille = computed(() => `repeat(${Math.max(1, Math.trunc(this.colonnes()))}, minmax(0, 1fr))`);

  /** Description de la grille pour les lecteurs d'écran (les points sont décoratifs). */
  protected readonly ariaGrille = computed(() =>
    this.entrees().map((e) => `${e.libelle} ${e.pourcentage}`).join(', '),
  );

  protected readonly entrees = computed(() => {
    const palette = this.palette();
    const total = Math.max(1, Math.trunc(this.total()));
    let rangPalette = 0;
    return this.segments().map((segment, index) => {
      const ton = segment.ton
        ?? (palette?.length ? palette[rangPalette++ % palette.length] : tonCategorie(rangPalette++));
      const compte = Math.max(0, Math.round(segment.compte));
      const part = compte / total;
      return {
        index,
        libelle: segment.libelle,
        compte,
        couleur: couleurPleine(ton),
        pourcentage: this.formatPct(part),
        infobulle: segment.infobulle ?? `${segment.libelle} · ${this.formatPct(part)}`,
      };
    });
  });

  protected readonly points = computed(() => {
    const total = Math.max(1, Math.trunc(this.total()));
    const points: { index: number; couleur: string | null; infobulle: string | undefined }[] = [];
    for (const entree of this.entrees()) {
      for (let i = 0; i < entree.compte && points.length < total; i++) {
        points.push({ index: points.length, couleur: entree.couleur, infobulle: entree.infobulle });
      }
    }
    while (points.length < total) {
      points.push({ index: points.length, couleur: null, infobulle: undefined });
    }
    return points;
  });

  protected cliquer(index: number): void {
    if (this.interactif()) this.segmentClick.emit(index);
  }

  private formatPct(part: number): string {
    return new Intl.NumberFormat(localeDeLangue(this.i18n.currentLang()), {
      style: 'percent',
      maximumFractionDigits: 0,
    }).format(part);
  }
}
