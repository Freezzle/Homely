import { CommonModule } from '@angular/common';
import { ChangeDetectionStrategy, Component, ElementRef, afterRenderEffect, computed, inject, input } from '@angular/core';
import { contrasteTexteDepuisRgb } from './contraste-texte.util';
import {
  IndicatorMarker,
  IndicatorSegment,
  IndicatorTick,
  IndicatorVariant,
  MarkerKind,
} from './indicator-bar.model';

/** Position calculée d'une bulle, avec sa « voie » verticale pour l'anti-chevauchement. */
interface MarkerLayout extends IndicatorMarker {
  /** Position bornée à [0, 100]. */
  clampedPosition: number;
  /** Classe d'alignement selon les bords (§4.2 du feature.md). */
  edgeClass: 'is-start' | 'is-end' | 'is-center';
  /** Voie verticale (0 = collée à la barre, 1 = remontée d'un cran). */
  lane: 0 | 1;
  /** Variante résolue (défaut : `'neutral'`). */
  resolvedVariant: IndicatorVariant;
  /** Kind résolu (défaut : `'primary'`). */
  resolvedKind: MarkerKind;
}

interface TickLayout extends IndicatorTick {
  clampedPosition: number;
  edgeClass: 'is-start' | 'is-end' | 'is-center';
}

interface SegmentLayout {
  widthPercent: number;
  color?: string;
  variant: IndicatorVariant;
  a11yLabel?: string;
}

/** Écart en points de % en dessous duquel deux bulles sont considérées superposées (§4.3). */
const MARKER_OVERLAP_THRESHOLD = 22;

/**
 * Primitive graphique : barre horizontale à segments, jalons et bulles.
 *
 * Volontairement générique — pas de titre, pas de carte, pas de logique métier :
 * l'appelant fournit des pourcentages déjà calculés (voir `toPercent()` dans
 * `to-percent.util.ts`). Utiliser `IndicatorCardComponent` pour l'enveloppe
 * (titre, sous-titre, formule, aide).
 *
 * Spécification complète : `docs/features/feature.md`.
 */
@Component({
  selector: 'app-indicator-bar',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './indicator-bar.component.html',
  styleUrl: './indicator-bar.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    role: 'img',
    '[attr.aria-label]': 'ariaLabel() || null',
  },
})
export class IndicatorBarComponent {
  private readonly host: ElementRef<HTMLElement> = inject(ElementRef);

  readonly segments = input<IndicatorSegment[]>([]);
  readonly ticks = input<IndicatorTick[]>([]);
  readonly markers = input<IndicatorMarker[]>([]);
  readonly showTicks = input<boolean>(true);
  readonly showTickLabels = input<boolean>(true);
  readonly showMarkers = input<boolean>(true);
  /** Hauteur de barre (nombre = px, string = valeur CSS libre). */
  readonly barHeight = input<number | string | undefined>(undefined);
  readonly ariaLabel = input<string | undefined>(undefined);

  constructor() {
    // Contraste automatique du texte de bulle : après chaque render (et à chaque
    // changement de markers/segments), on lit la couleur de fond effectivement
    // appliquée à chaque `.indicator-bar__marker-bubble` (via getComputedStyle,
    // qui résout tokens `var(--...)`, thème sombre, `color-mix`, etc.) et on
    // applique la couleur de texte contrastée. Fallback silencieux si parsing
    // impossible : la couleur CSS d'origine reste en vigueur.
    afterRenderEffect(() => {
      // Dépendance signal pour re-jouer sur changement des markers.
      void this.markersLayout();
      const bubbles = this.host.nativeElement.querySelectorAll<HTMLElement>('.indicator-bar__marker-bubble');
      bubbles.forEach((el) => {
        const bg = getComputedStyle(el).backgroundColor;
        const contrast = contrasteTexteDepuisRgb(bg);
        if (contrast) el.style.color = contrast;
      });
    });
  }

  protected readonly segmentsLayout = computed<SegmentLayout[]>(() =>
    this.segments().map((s) => ({
      widthPercent: Math.max(0, s.widthPercent),
      color: s.color,
      variant: s.variant ?? 'neutral',
      a11yLabel: s.a11yLabel,
    })),
  );

  protected readonly ticksLayout = computed<TickLayout[]>(() =>
    this.showTicks()
      ? this.ticks().map((t) => {
          const clamped = clamp(t.positionPercent);
          return {
            ...t,
            clampedPosition: clamped,
            edgeClass: edgeClassFor(clamped),
          };
        })
      : [],
  );

  protected readonly markersLayout = computed<MarkerLayout[]>(() => {
    if (!this.showMarkers()) return [];
    const placed: MarkerLayout[] = [];
    for (const m of this.markers()) {
      const clamped = clamp(m.positionPercent);
      // Anti-chevauchement (§4.3) : si une bulle déjà placée est à moins de
      // MARKER_OVERLAP_THRESHOLD, remonter d'un cran (lane 1). On se limite
      // à 2 voies — au-delà, c'est un problème de conception de l'appelant.
      const lane: 0 | 1 = placed.some(
        (p) => p.lane === 0 && Math.abs(p.clampedPosition - clamped) < MARKER_OVERLAP_THRESHOLD,
      )
        ? 1
        : 0;
      placed.push({
        ...m,
        clampedPosition: clamped,
        edgeClass: edgeClassFor(clamped),
        lane,
        resolvedVariant: m.variant ?? 'neutral',
        resolvedKind: m.kind ?? 'primary',
      });
    }
    return placed;
  });

  /** Vrai si au moins une bulle est en voie 1 → la barre réserve une hauteur de bulle en plus. */
  protected readonly hasStackedMarkers = computed(() =>
    this.markersLayout().some((m) => m.lane === 1),
  );

  /** Vrai si au moins un jalon a un libellé et que les étiquettes sont affichées. */
  protected readonly hasTickLabels = computed(() =>
    this.showTickLabels() && this.ticksLayout().some((t) => t.label != null),
  );

  /** Vrai s'il y a au moins une bulle rendue → réserve d'espace au-dessus de la barre. */
  protected readonly hasAnyMarker = computed(() => this.markersLayout().length > 0);

  /** Style CSS `--ind-bar-height` calculé à partir de l'entrée `barHeight`. */
  protected readonly barHeightVar = computed<string | null>(() => {
    const h = this.barHeight();
    if (h == null) return null;
    return typeof h === 'number' ? `${h}px` : h;
  });
}

function clamp(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.min(100, Math.max(0, value));
}

function edgeClassFor(position: number): 'is-start' | 'is-end' | 'is-center' {
  if (position < 7) return 'is-start';
  if (position > 93) return 'is-end';
  return 'is-center';
}
