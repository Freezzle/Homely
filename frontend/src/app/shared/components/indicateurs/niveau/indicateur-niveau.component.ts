import { ChangeDetectionStrategy, Component, computed, inject, input } from '@angular/core';
import { I18nService } from '../../../../core/i18n/i18n.service';
import { TonIndicateur, couleurPleine, couleurTexte } from '../tons';

/** Nombre de segments de l'échelle. */
const NB_SEGMENTS = 5;

/**
 * Indicateur qualitatif positionné sur une échelle à 5 segments (1 à 5).
 */
@Component({
  selector: 'app-indicateur-niveau',
  standalone: true,
  templateUrl: './indicateur-niveau.component.html',
  styleUrl: './indicateur-niveau.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class IndicateurNiveauComponent {
  private readonly i18n = inject(I18nService);

  /** Niveau courant, de 1 à 5. */
  readonly niveau = input.required<number>();
  /** Texte qualitatif (ex. « Modéré »). */
  readonly libelle = input.required<string>();
  /** Ton sémantique du niveau (succes / attention / danger / info…). */
  readonly ton = input<TonIndicateur>('info');
  readonly libelleDebut = input('');
  readonly libelleFin = input('');
  /**
   * Variante dense : libellé de chrome (pas de chiffre héros) et échelle sur la même
   * ligne, bornes masquées. Pour empiler plusieurs notes dans un panneau de détail
   * sans enfreindre l'invariant « un seul `--app-donnee-xl` par carte ».
   */
  readonly compact = input(false);

  protected readonly segments = computed(() => {
    const actif = Math.min(NB_SEGMENTS, Math.max(0, Math.trunc(this.niveau())));
    const couleur = couleurPleine(this.ton());
    return Array.from({ length: NB_SEGMENTS }, (_, index) => ({
      index,
      actif: index < actif,
      couleur,
    }));
  });

  /** Le libellé est du **texte** sur le fond de la carte : `couleurTexte` (contraste AA),
   *  et non `couleurForte`, qui est calibrée pour un fond portant du texte blanc. */
  protected readonly couleur = computed(() => couleurTexte(this.ton()));

  protected readonly ratio = computed(() =>
    this.i18n.instant('indicateurs.ratioNiveau', {
      niveau: Math.min(NB_SEGMENTS, Math.max(0, Math.trunc(this.niveau()))),
      total: NB_SEGMENTS,
    }),
  );
}
