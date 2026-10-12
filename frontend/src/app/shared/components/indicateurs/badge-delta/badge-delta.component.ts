import { ChangeDetectionStrategy, Component, computed, inject, input } from '@angular/core';
import { I18nService } from '../../../../core/i18n/i18n.service';
import { localeDeLangue } from '../../../../core/i18n/locale.util';
import { couleurDouce, couleurTexte } from '../tons';

/**
 * Badge de variation (▲/▼ + pourcentage) partagé par les indicateurs de tendance.
 * Composant d'affichage pur : la variation est fournie par l'appelant.
 */
@Component({
  selector: 'app-badge-delta',
  standalone: true,
  templateUrl: './badge-delta.component.html',
  styleUrl: './badge-delta.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class BadgeDeltaComponent {
  private readonly i18n = inject(I18nService);

  /** Variation en pourcentage exprimée en ratio (0.063 → +6,3 %). Positif = hausse. */
  readonly delta = input.required<number>();
  /** `true` quand une baisse est favorable (ex. charges, délais). */
  readonly inverserDelta = input<boolean>(false);
  /** Formatage personnalisé du texte ; le symbole reste ajouté par le composant. */
  readonly formateur = input<((delta: number) => string) | null>(null);
  /** `true` quand le sens de la variation n'est ni bon ni mauvais (ton neutre forcé). */
  readonly neutre = input<boolean>(false);

  /** Ton du badge : neutre à variation nulle, sinon succès/danger selon la favorabilité. */
  protected readonly ton = computed<'neutre' | 'succes' | 'danger'>(() => {
    if (this.neutre() || this.delta() === 0) return 'neutre';
    const favorable = this.inverserDelta() ? this.delta() < 0 : this.delta() > 0;
    return favorable ? 'succes' : 'danger';
  });

  // Texte posé sur le fond doux du même ton : `couleurTexte` (assombrie) et non
  // `couleurPleine`, qui n'aurait pas un contraste suffisant.
  protected readonly couleur = computed(() => couleurTexte(this.ton()));
  protected readonly fond = computed(() => couleurDouce(this.ton()));
  /** Vide à variation nulle : une flèche suggérerait à tort un sens d'évolution. */
  protected readonly symbole = computed(() => (this.delta() === 0 ? '' : this.delta() > 0 ? '▲' : '▼'));

  protected readonly texte = computed(() => {
    const formateur = this.formateur();
    return formateur ? formateur(this.delta()) : this.formatPct(this.delta());
  });

  private formatPct(valeur: number): string {
    return new Intl.NumberFormat(localeDeLangue(this.i18n.currentLang()), {
      style: 'percent',
      maximumFractionDigits: 1,
      signDisplay: 'exceptZero',
    }).format(valeur);
  }
}
