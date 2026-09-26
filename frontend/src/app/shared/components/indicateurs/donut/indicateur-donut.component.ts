import { ChangeDetectionStrategy, Component, computed, inject, input, output } from '@angular/core';
import { TooltipModule } from 'primeng/tooltip';
import { I18nService } from '../../../../core/i18n/i18n.service';
import { localeDeLangue } from '../../../../core/i18n/locale.util';
import { PctPipe } from '../../../../core/pipes/format.pipes';
import { TonIndicateur, couleurPleine, tonCategorie } from '../tons';

export interface SegmentDonut {
  libelle: string;
  /** Pourcentage (l'ensemble des segments totalise ~100). */
  valeur: number;
  /** Ton propre ; à défaut, ton suivant de `palette` (ou palette catégorielle). */
  ton?: TonIndicateur;
  /** Texte d'infobulle ; à défaut « libellé · valeur % ». */
  infobulle?: string;
}

interface ArcDonut {
  index: number;
  libelle: string;
  valeur: number;
  couleur: string;
  dasharray: string;
  dashoffset: number;
  infobulle: string;
}

/**
 * Donut SVG (anneau `pathLength=100`) + légende. Composant d'affichage pur — les
 * pourcentages sont fournis par l'appelant (calculés par le backend).
 */
@Component({
  selector: 'app-indicateur-donut',
  standalone: true,
  imports: [TooltipModule, PctPipe],
  templateUrl: './indicateur-donut.component.html',
  styleUrl: './indicateur-donut.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class IndicateurDonutComponent {
  private readonly i18n = inject(I18nService);

  readonly segments = input.required<SegmentDonut[]>();
  /** Tons appliqués dans l'ordre aux segments sans `ton`. Défaut : palette catégorielle. */
  readonly palette = input<TonIndicateur[] | null>(null);
  readonly valeurCentrale = input.required<string>();
  readonly libelleCentral = input<string>('');
  readonly taille = input<string>('clamp(88px, 48cqi, 120px)');
  /** Rend les segments et entrées de légende focusables/cliquables et active `segmentClick`. */
  readonly interactif = input<boolean>(false);

  readonly segmentClick = output<number>();

  protected readonly arcs = computed<ArcDonut[]>(() => {
    const segments = this.segments().filter((s) => s.valeur > 0);
    const palette = this.palette();
    const avecEspace = segments.length > 1;
    let cumul = 0;
    let rangPalette = 0;

    return segments.map((segment, index) => {
      const ton = segment.ton
        ?? (palette?.length ? palette[rangPalette++ % palette.length] : tonCategorie(rangPalette++));
      const longueur = avecEspace ? Math.max(segment.valeur - 1, 0.5) : segment.valeur;
      const arc: ArcDonut = {
        index,
        libelle: segment.libelle,
        valeur: segment.valeur,
        couleur: couleurPleine(ton),
        dasharray: `${longueur} ${100 - longueur}`,
        dashoffset: -cumul,
        infobulle: segment.infobulle ?? `${segment.libelle} · ${this.formatPct(segment.valeur)}`,
      };
      cumul += segment.valeur;
      return arc;
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
