import { ChangeDetectionStrategy, Component, computed, inject, input } from '@angular/core';
import { I18nService } from '../../../../core/i18n/i18n.service';
import { BadgeDeltaComponent } from '../badge-delta/badge-delta.component';
import { cheminRempli, cheminSerie, echelleCommune } from '../courbes.util';
import { TonIndicateur, couleurPleine } from '../tons';

let compteurGradient = 0;

/**
 * Courbe de tendance miniature (SVG + dégradé) avec valeur et badge de variation.
 * Le ton suit la favorabilité de la variation, sauf si `ton` est fourni.
 */
@Component({
  selector: 'app-indicateur-sparkline',
  standalone: true,
  imports: [BadgeDeltaComponent],
  templateUrl: './indicateur-sparkline.component.html',
  styleUrl: './indicateur-sparkline.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class IndicateurSparklineComponent {
  private readonly i18n = inject(I18nService);

  readonly serie = input.required<number[]>();
  /** Valeur principale, déjà formatée. */
  readonly valeur = input.required<string>();
  readonly unite = input<string>('');
  /** Variation en ratio (0.061 → +6,1 %). */
  readonly delta = input.required<number>();
  readonly inverserDelta = input<boolean>(false);
  /** Ton de la courbe ; à défaut, succès si la variation est favorable, danger sinon. */
  readonly ton = input<TonIndicateur | null>(null);
  readonly hauteur = input<string>('52px');
  readonly formateurDelta = input<((delta: number) => string) | null>(null);

  /** Identifiant unique du dégradé (évite les collisions entre SVG de la page). */
  protected readonly gradientId = `sparkline-gradient-${++compteurGradient}`;

  protected readonly couleur = computed(() => {
    const ton = this.ton();
    if (ton) return couleurPleine(ton);
    const favorable = this.inverserDelta() ? this.delta() <= 0 : this.delta() >= 0;
    return couleurPleine(favorable ? 'succes' : 'danger');
  });

  protected readonly chemin = computed(() =>
    cheminSerie(this.serie(), echelleCommune(this.serie()), 36, 32),
  );

  protected readonly cheminFond = computed(() => cheminRempli(this.chemin(), 40));

  protected readonly descriptionTendance = computed(() => {
    const t = this.i18n.translations().indicateurs;
    if (this.delta() > 0) return t.tendanceHausse;
    if (this.delta() < 0) return t.tendanceBaisse;
    return t.tendanceStable;
  });
}
