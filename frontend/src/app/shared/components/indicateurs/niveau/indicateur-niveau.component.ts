import { ChangeDetectionStrategy, Component, computed, inject, input } from '@angular/core';
import { I18nService } from '../../../../core/i18n/i18n.service';
import { TonIndicateur, couleurForte, couleurPleine } from '../tons';

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
  readonly libelleDebut = input.required<string>();
  readonly libelleFin = input.required<string>();

  protected readonly segments = computed(() => {
    const actif = Math.min(NB_SEGMENTS, Math.max(0, Math.trunc(this.niveau())));
    const couleur = couleurPleine(this.ton());
    return Array.from({ length: NB_SEGMENTS }, (_, index) => ({
      index,
      actif: index < actif,
      couleur,
    }));
  });

  /** Variante foncée : le libellé est du texte, il doit rester lisible sur fond clair. */
  protected readonly couleur = computed(() => couleurForte(this.ton()));

  protected readonly ratio = computed(() =>
    this.i18n.instant('indicateurs.ratioNiveau', {
      niveau: Math.min(NB_SEGMENTS, Math.max(0, Math.trunc(this.niveau()))),
      total: NB_SEGMENTS,
    }),
  );
}
