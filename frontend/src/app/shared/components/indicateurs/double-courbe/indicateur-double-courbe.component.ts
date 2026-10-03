import { ChangeDetectionStrategy, Component, computed, inject, input } from '@angular/core';
import { I18nService } from '../../../../core/i18n/i18n.service';
import { BadgeDeltaComponent } from '../badge-delta/badge-delta.component';
import { cheminSerie, echelleCommune } from '../courbes.util';
import { TonIndicateur, couleurPleine } from '../tons';

/**
 * Deux courbes superposées (période actuelle en trait plein, précédente en pointillés)
 * tracées sur une échelle commune, avec valeur, badge de variation et mini-légende.
 */
@Component({
  selector: 'app-indicateur-double-courbe',
  standalone: true,
  imports: [BadgeDeltaComponent],
  templateUrl: './indicateur-double-courbe.component.html',
  styleUrl: './indicateur-double-courbe.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class IndicateurDoubleCourbeComponent {
  private readonly i18n = inject(I18nService);

  readonly serieActuelle = input.required<number[]>();
  readonly seriePrecedente = input.required<number[]>();
  /** Valeur principale, déjà formatée. */
  readonly valeur = input.required<string>();
  readonly unite = input<string>('');
  /** Variation en ratio (0.082 → +8,2 %). */
  readonly delta = input.required<number>();
  readonly inverserDelta = input<boolean>(false);
  readonly libelleActuel = input.required<string>();
  readonly libellePrecedent = input.required<string>();
  readonly tonActuel = input<TonIndicateur>('info');
  readonly tonPrecedent = input<TonIndicateur>('neutre');
  readonly hauteur = input<string>('60px');
  readonly formateurDelta = input<((delta: number) => string) | null>(null);

  protected readonly couleurActuelle = computed(() => couleurPleine(this.tonActuel()));
  protected readonly couleurPrecedente = computed(() => couleurPleine(this.tonPrecedent()));

  private readonly echelle = computed(() => echelleCommune(this.serieActuelle(), this.seriePrecedente()));

  protected readonly cheminActuel = computed(() => cheminSerie(this.serieActuelle(), this.echelle(), 38, 34));
  protected readonly cheminPrecedent = computed(() => cheminSerie(this.seriePrecedente(), this.echelle(), 38, 34));

  protected readonly descriptionTendance = computed(() => {
    const t = this.i18n.translations().indicateurs;
    const tendance = this.delta() > 0 ? t.tendanceHausse : this.delta() < 0 ? t.tendanceBaisse : t.tendanceStable;
    return `${tendance} — ${this.libelleActuel()} / ${this.libellePrecedent()}`;
  });
}
