import { CommonModule } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, inject, input } from '@angular/core';
import { TooltipModule } from 'primeng/tooltip';
import { HeatmapLigne } from '../../data/comparaison-scenarios.models';
import { I18nService } from '../../../../core/i18n/i18n.service';
import { formatMontantSigne } from '../../data/format-montant.util';

/** Seuil de significativité **par cellule** (docs/features/feature_5_bis §8). */
const SEUIL_CELLULE = 0.5;

/**
 * Carte de chaleur mois × catégorie (docs/features/feature_5_bis §8).
 *
 * Grille CSS avec libellé de ligne sticky à gauche, cellules colorées par
 * `color-mix` sur `--p-primary-500` (vert = B fait mieux) et `--p-red-500`
 * (rouge = B coûte plus). Échelle **commune à toute la grille** (contrairement
 * à la cascade budgétaire qui est mise à l'échelle par colonne).
 *
 * Cellules sous `SEUIL_CELLULE` (0.5) affichées vides avec un fond neutre.
 * Catégories dont `somme(|v|) < 1` sur les 12 mois sont déjà exclues en amont
 * (voir `construireHeatmap`).
 */
@Component({
  selector: 'app-heatmap-ecart',
  standalone: true,
  imports: [CommonModule, TooltipModule],
  templateUrl: './heatmap-ecart.component.html',
  styleUrl: './heatmap-ecart.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class HeatmapEcartComponent {
  private readonly i18n = inject(I18nService);

  readonly lignes = input.required<HeatmapLigne[]>();
  readonly labelsMois = input.required<string[]>();
  readonly devise = input<string>('CHF');
  /** Template de tooltip avec {categorie}, {mois}, {montant}, {devise}. */
  readonly tooltipTemplate = input<string>('{categorie} · {mois} : {montant} {devise}');

  protected readonly maxAbs = computed(() =>
    Math.max(1, ...this.lignes().flatMap(l => l.valeursParMois.map(v => Math.abs(v)))));

  protected estSignificatif(valeur: number): boolean {
    return Math.abs(valeur) >= SEUIL_CELLULE;
  }

  /** Style d'une cellule : neutre si sous seuil, sinon `color-mix` à opacité
   *  `0.12 + min(1, |v|/max) * 0.68` (feature_5_bis §8). */
  protected style(valeur: number): Record<string, string> {
    if (!this.estSignificatif(valeur)) return { background: 'var(--p-surface-100)' };
    const intensite = Math.min(1, Math.abs(valeur) / this.maxAbs());
    const opacite = 0.12 + intensite * 0.68;
    const pct = Math.round(opacite * 100);
    const token = valeur > 0 ? 'var(--p-primary-500)' : 'var(--p-red-500)';
    return { background: `color-mix(in srgb, ${token} ${pct}%, transparent)` };
  }

  protected texte(valeur: number): string {
    if (!this.estSignificatif(valeur)) return '';
    return formatMontantSigne(valeur, this.i18n.currentLang());
  }

  protected tooltip(ligne: HeatmapLigne, valeur: number, moisIndex: number): string {
    return this.tooltipTemplate()
      .replace('{categorie}', ligne.libelle)
      .replace('{mois}', this.labelsMois()[moisIndex] ?? '')
      .replace('{montant}', formatMontantSigne(valeur, this.i18n.currentLang()))
      .replace('{devise}', this.devise());
  }
}

