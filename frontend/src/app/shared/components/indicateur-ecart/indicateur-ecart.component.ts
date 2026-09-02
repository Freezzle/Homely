import { CommonModule } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, inject, input } from '@angular/core';
import { CardModule } from 'primeng/card';
import { I18nService } from '../../../core/i18n/i18n.service';
import {
  MOINS_TYPO, TIRET_NUL, estNul, formatMontant, formatMontantSigne, formatPourcentageSigne, signeEcart,
} from '../../../features/comparaison-scenarios/data/format-montant.util';

/** `1` = « plus haut est mieux », `-1` = l'inverse (doc feature_5_bis §4). */
export type IndicateurSens = 1 | -1;

/**
 * Composant générique réutilisable affichant l'écart entre deux valeurs
 * (scénario A vs B, période N vs N-1, etc.) suivant strictement le contrat
 * défini par `docs/features/feature_5_bis.md §4` :
 *   1. `label` en petit texte atténué.
 *   2. Valeur d'écart en gros, signée (`+` / `−` U+2212), précédée d'une icône
 *      de tendance et suivie du pourcentage d'évolution (une décimale, signée).
 *      Couleur du bloc entier = `--app-positif` si favorable, `--app-negatif` sinon,
 *      atténué si nul.
 *   3. Séparateur horizontal fin.
 *   4. Deux lignes A/B avec point coloré (`--app-success` / `--app-info`) + nom du
 *      scénario + valeur brute (non signée).
 *   5. Éventuelle note atténuée en pied de carte.
 *
 * N'est **pas** instancié sur l'écran de comparaison (bandeau retiré pour
 * désencombrer) mais son contrat doit exister pour un futur réemploi
 * (tableau de bord, bandeau de synthèse, etc.).
 */
@Component({
  selector: 'app-indicateur-ecart',
  standalone: true,
  imports: [CommonModule, CardModule],
  templateUrl: './indicateur-ecart.component.html',
  styleUrl: './indicateur-ecart.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class IndicateurEcartComponent {
  private readonly i18n = inject(I18nService);

  readonly label = input.required<string>();
  readonly valeurA = input.required<number>();
  readonly valeurB = input.required<number>();
  readonly sens = input<IndicateurSens>(1);
  readonly note = input<string | undefined>(undefined);
  /** Libellés des scénarios (par défaut « A » / « B ») pour les lignes 4. */
  readonly nomA = input<string>('A');
  readonly nomB = input<string>('B');

  protected readonly ecart = computed(() => this.valeurB() - this.valeurA());

  /** `positif` = favorable (écart × sens > 0), `negatif` = défavorable, `nul` sinon. */
  protected readonly favorable = computed<'positif' | 'negatif' | 'nul'>(() => {
    const e = this.ecart();
    if (estNul(e)) return 'nul';
    return e * this.sens() > 0 ? 'positif' : 'negatif';
  });

  /** Icône de tendance pilotée uniquement par le signe brut de l'écart
   *  (feature_5_bis §4 : « ↑ si écart positif, ↓ si négatif, — si nul »). */
  protected readonly icone = computed<'pi-arrow-up' | 'pi-arrow-down' | 'pi-minus'>(() => {
    const s = signeEcart(this.ecart());
    if (s === 'positif') return 'pi-arrow-up';
    if (s === 'negatif') return 'pi-arrow-down';
    return 'pi-minus';
  });

  protected ecartFormate(): string {
    return formatMontantSigne(this.ecart(), this.i18n.currentLang());
  }

  protected valeurFormatee(v: number): string {
    return formatMontant(v, this.i18n.currentLang());
  }

  /** Pourcentage d'évolution signé, affiché seulement si `valeurA !== 0`
   *  (feature_5_bis §4). Retourne `''` sinon. */
  protected pourcentageFormate(): string {
    const a = this.valeurA();
    if (estNul(a)) return '';
    const pct = (this.ecart() / Math.abs(a)) * 100;
    return formatPourcentageSigne(pct, this.i18n.currentLang());
  }

  /** Exposé pour les tests unitaires. */
  readonly _test = {
    ecart: () => this.ecart(),
    favorable: () => this.favorable(),
    icone: () => this.icone(),
    ecartFormate: () => this.ecartFormate(),
    pourcentageFormate: () => this.pourcentageFormate(),
    MOINS_TYPO,
    TIRET_NUL,
  };
}

