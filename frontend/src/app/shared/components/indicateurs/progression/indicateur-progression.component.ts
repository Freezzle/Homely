import { ChangeDetectionStrategy, Component, computed, inject, input } from '@angular/core';
import { I18nService } from '../../../../core/i18n/i18n.service';
import { TonIndicateur, couleurDouce, couleurPleine } from '../tons';

/**
 * Barre de progression `actuel / cible`. Le ton bascule automatiquement en attention au
 * delà du seuil, puis en succès une fois la cible atteinte.
 */
@Component({
  selector: 'app-indicateur-progression',
  standalone: true,
  templateUrl: './indicateur-progression.component.html',
  styleUrl: './indicateur-progression.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class IndicateurProgressionComponent {
  private readonly i18n = inject(I18nService);

  readonly actuel = input.required<number>();
  readonly cible = input.required<number>();
  /** Unité affichée dans les libellés (ex. « CHF », « postes »). */
  readonly unite = input<string>('');
  /** Ton de la barre tant qu'aucun seuil n'est franchi. */
  readonly ton = input<TonIndicateur>('info');
  /**
   * Ton appliqué une fois la cible atteinte. Défaut `succes` (sémantique « objectif
   * atteint ») ; à passer en ton négatif (ex. `charge`) quand dépasser la cible est
   * au contraire une mauvaise nouvelle, comme pour un taux d'effort.
   */
  readonly tonAtteint = input<TonIndicateur>('succes');
  /** Ton (variante douce) de la piste, c.-à-d. la part restante. */
  readonly tonPiste = input<TonIndicateur>('neutre');
  /** Pourcentage (0-100) au-delà duquel la barre passe en ton « attention ». */
  readonly seuilAttention = input<number | null>(null);
  readonly afficherReste = input<boolean>(true);
  /** Texte affiché à droite une fois la cible atteinte. Défaut : clé i18n. */
  readonly libelleAtteint = input<string>('');
  /** Valeurs déjà formatées par l'appelant ; à défaut, les nombres bruts sont affichés. */
  readonly actuelAffiche = input<string>('');
  readonly cibleAffichee = input<string>('');
  readonly resteAffiche = input<string>('');

  protected readonly pourcentage = computed(() => {
    const cible = this.cible();
    if (!Number.isFinite(cible) || cible <= 0) return 0;
    return Math.max(0, (this.actuel() / cible) * 100);
  });

  protected readonly largeur = computed(() => `${Math.min(100, this.pourcentage())}%`);

  protected readonly pourcentageArrondi = computed(() => Math.round(Math.min(100, this.pourcentage())));

  protected readonly atteint = computed(() => this.pourcentage() >= 100);

  protected readonly couleur = computed(() => {
    if (this.atteint()) return couleurPleine(this.tonAtteint());
    const seuil = this.seuilAttention();
    if (seuil !== null && this.pourcentage() >= seuil) return couleurPleine('attention');
    return couleurPleine(this.ton());
  });

  protected readonly couleurPiste = computed(() => couleurDouce(this.tonPiste()));

  protected readonly texteActuel = computed(() => this.actuelAffiche() || `${this.actuel()}`);
  protected readonly texteCible = computed(() => this.cibleAffichee() || `${this.cible()}`);

  protected readonly texteDroite = computed(() => {
    if (this.atteint()) return this.libelleAtteint() || this.i18n.translations().indicateurs.atteint;
    const reste = this.resteAffiche() || `${Math.max(0, this.cible() - this.actuel())}`;
    return this.i18n.instant('indicateurs.reste', { valeur: `${reste}${this.unite() ? ' ' + this.unite() : ''}` });
  });

  protected readonly libelleAccessible = computed(
    () => `${this.texteActuel()} / ${this.texteCible()}${this.unite() ? ' ' + this.unite() : ''}`,
  );
}
