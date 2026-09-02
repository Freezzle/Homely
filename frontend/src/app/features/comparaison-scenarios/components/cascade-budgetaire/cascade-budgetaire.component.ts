import { CommonModule } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, inject, input } from '@angular/core';
import { CascadeEtape } from '../../data/comparaison-scenarios.models';
import { I18nService } from '../../../../core/i18n/i18n.service';
import { formatMontant, formatMontantSigne, signeEcart, TIRET_NUL } from '../../data/format-montant.util';

/**
 * Cascade budgétaire (docs/features/feature_5_bis §7) — **table transposée** :
 *
 * - Une **colonne par étape** (Revenus → Charges → Réserves → Reste à vivre →
 *   Argent de poche → Solde disponible), avec opérateur visuel (`−` / `=`) et
 *   séparateur en tirets pour les colonnes « résultat » (RàV, Solde).
 * - Une **ligne par scénario** (A puis B empilées) : mêmes colonnes, alignées,
 *   pour comparer les longueurs de barres d'un coup d'œil.
 * - Une ligne « Écart » finale, signe favorable coloré par colonne.
 *
 * **Formule d'échelle par colonne** (point le plus important de la section) :
 *   `maxColonne = max(1, |A|, |B|)` sur cette colonne seule.
 *   `largeur% = min(100, |v| / maxColonne * 100)`.
 * Sinon l'argent de poche (petit face aux revenus) deviendrait illisible sur
 * une échelle globale. Une valeur négative se traduit uniquement par la couleur
 * rouge de la barre — jamais un clampage à 0 (RàV/Solde peuvent être négatifs,
 * doc 01 §1).
 */
@Component({
  selector: 'app-cascade-budgetaire',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './cascade-budgetaire.component.html',
  styleUrl: './cascade-budgetaire.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CascadeBudgetaireComponent {
  private readonly i18n = inject(I18nService);

  readonly etapes = input.required<CascadeEtape[]>();
  readonly labelA = input.required<string>();
  readonly labelB = input.required<string>();
  readonly labelEcart = input.required<string>();
  readonly enTetePeriode = input.required<string>();

  protected readonly TIRET_NUL = TIRET_NUL;

  protected ecart(etape: CascadeEtape): number {
    return etape.valeurB - etape.valeurA;
  }

  /** Amplitude max pour cette étape précise (colonne), pas un maximum global. */
  private maxColonne(etape: CascadeEtape): number {
    return Math.max(1, Math.abs(etape.valeurA), Math.abs(etape.valeurB));
  }

  protected largeur(etape: CascadeEtape, valeur: number): number {
    return Math.min(100, (Math.abs(valeur) / this.maxColonne(etape)) * 100);
  }

  /** Couleur de la barre pour une valeur donnée : rouge si négative, sinon
   *  la couleur de la colonne (feature_5_bis §7). */
  protected couleurBarre(etape: CascadeEtape, valeur: number): string {
    if (valeur < 0) return 'var(--app-negatif)';
    return etape.couleurBarre;
  }

  protected montant(valeur: number): string {
    if (valeur < 0) {
      return `\u2212${formatMontant(Math.abs(valeur), this.i18n.currentLang())}`;
    }
    return formatMontant(valeur, this.i18n.currentLang());
  }

  /** Écart signé (feature_5_bis §11), avec `—` si `|v| < 0.01`. */
  protected ecartFormate(etape: CascadeEtape): string {
    return formatMontantSigne(this.ecart(etape), this.i18n.currentLang());
  }

  /** Couleur de l'écart selon le sens favorable de la colonne. */
  protected couleurEcart(etape: CascadeEtape): string {
    const e = this.ecart(etape);
    const signe = signeEcart(e);
    if (signe === 'nul') return 'var(--app-ink-muted)';
    const favorable = e * etape.sensFavorable > 0;
    return favorable ? 'var(--app-positif)' : 'var(--app-negatif)';
  }
}

