import { ChangeDetectionStrategy, Component, computed, inject, input, output } from '@angular/core';
import { TooltipModule } from 'primeng/tooltip';
import { I18nService } from '../../../../core/i18n/i18n.service';
import { localeDeLangue } from '../../../../core/i18n/locale.util';
import { PctPipe } from '../../../../core/pipes/format.pipes';
import { TonIndicateur, couleurPleine, tonCategorie } from '../tons';

export interface SegmentBarreEmpilee {
  libelle: string;
  /** Pourcentage (l'ensemble des segments totalise ~100). */
  valeur: number;
  /** Ton propre ; à défaut, ton suivant de `palette` (ou palette catégorielle). */
  ton?: TonIndicateur;
  /** Texte d'infobulle ; à défaut « libellé · valeur % ». */
  infobulle?: string;
}

/**
 * Barre horizontale unique décomposée en segments proportionnels, avec légende.
 * Composant d'affichage pur : les pourcentages sont fournis par l'appelant.
 */
@Component({
  selector: 'app-indicateur-barre-empilee',
  standalone: true,
  imports: [TooltipModule, PctPipe],
  templateUrl: './indicateur-barre-empilee.component.html',
  styleUrl: './indicateur-barre-empilee.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class IndicateurBarreEmpileeComponent {
  private readonly i18n = inject(I18nService);

  readonly segments = input.required<SegmentBarreEmpilee[]>();
  /** Tons appliqués dans l'ordre aux segments sans `ton`. Défaut : palette catégorielle. */
  readonly palette = input<TonIndicateur[] | null>(null);
  readonly hauteurBarre = input<string>('12px');
  readonly afficherLegende = input<boolean>(true);
  /** Rend les segments et entrées de légende focusables/cliquables et active `segmentClick`. */
  readonly interactif = input<boolean>(false);

  readonly segmentClick = output<number>();

  protected readonly parts = computed(() => {
    const palette = this.palette();
    let rangPalette = 0;
    return this.segments()
      .filter((s) => s.valeur > 0)
      .map((segment, index) => {
        const ton = segment.ton
          ?? (palette?.length ? palette[rangPalette++ % palette.length] : tonCategorie(rangPalette++));
        return {
          index,
          libelle: segment.libelle,
          valeur: segment.valeur,
          couleur: couleurPleine(ton),
          largeur: `${segment.valeur}%`,
          infobulle: segment.infobulle ?? `${segment.libelle} · ${this.formatPct(segment.valeur)}`,
        };
      });
  });

  protected cliquer(index: number): void {
    if (this.interactif()) this.segmentClick.emit(index);
  }

  private formatPct(valeur: number): string {
    return new Intl.NumberFormat(localeDeLangue(this.i18n.currentLang()), {
      style: 'percent',
      maximumFractionDigits: 0,
    }).format(valeur / 100);
  }
}
