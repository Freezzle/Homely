import { Component, computed, input } from '@angular/core';
import { normaliserCouleur, couleurTexteContraste } from '../../utils/couleur.util';

/** Même union que `KpiChipSeverity`/`ObjectiveProgressSeverity`/`StatGridSeverity`. */
export type TagSeverity = 'success' | 'info' | 'warn' | 'danger' | 'secondary';

/** Couleur/texte associés à chaque sévérité, alignés sur les tokens de thème PrimeNG
 *  (`--p-tag-{severity}-background`/`color`) pour un rendu identique à `p-tag`,
 *  cohérent clair/sombre, sans dupliquer de palette. */
const COULEURS_SEVERITE: Record<TagSeverity, { fond: string; texte: string }> = {
  success: { fond: 'var(--p-tag-success-background)', texte: 'var(--p-tag-success-color)' },
  info: { fond: 'var(--p-tag-info-background)', texte: 'var(--p-tag-info-color)' },
  warn: { fond: 'var(--p-tag-warn-background)', texte: 'var(--p-tag-warn-color)' },
  danger: { fond: 'var(--p-tag-danger-background)', texte: 'var(--p-tag-danger-color)' },
  secondary: { fond: 'var(--p-tag-secondary-background)', texte: 'var(--p-tag-secondary-color)' },
};

/**
 * Tag réutilisable, deux modes :
 * - couleur libre (`couleur` + `texte`) : fond coloré, texte contrasté automatiquement
 *   (ex. tags membre dans `postes-liste`, `comptes`, `repartition-periodes`) ;
 * - sévérité (`severity` + `texte`) : reprend les tokens de thème PrimeNG `p-tag`
 *   (ex. statuts `success`/`danger`/`info`/`warn`/`secondary`), remplace `<p-tag
 *   [value] [severity]>`.
 * `severity` prime sur `couleur` si les deux sont fournis. Le style est posé sur le
 * `:host` (plutôt qu'un `<span>` interne) pour que les classes additionnelles passées
 * par les consommateurs (`class="text-[10px] py-0.5 shrink-0"`, etc.) se combinent avec
 * les classes de base sans wrapper supplémentaire.
 */
@Component({
  selector: 'app-tag',
  standalone: true,
  template: '{{ texte() }}',
  host: {
    class: 'inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium leading-none',
    '[style.background-color]': 'couleurFond()',
    '[style.color]': 'couleurTexte()',
  },
})
export class TagComponent {
  readonly couleur = input<string | null | undefined>();
  readonly severity = input<TagSeverity | null | undefined>();
  readonly texte = input<string>('');

  readonly couleurFond = computed(() => {
    const severity = this.severity();
    if (severity) return COULEURS_SEVERITE[severity].fond;
    return normaliserCouleur(this.couleur());
  });

  readonly couleurTexte = computed(() => {
    const severity = this.severity();
    if (severity) return COULEURS_SEVERITE[severity].texte;
    return couleurTexteContraste(normaliserCouleur(this.couleur()));
  });
}
