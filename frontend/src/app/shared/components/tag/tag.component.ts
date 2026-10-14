import { Component, computed, input } from '@angular/core';
import { normaliserCouleur, couleurTexteContraste } from '../../utils/couleur.util';
import { TonCarte, couleurDouce, couleurTexte } from '../indicateurs/tons';

/** Même union que `KpiChipSeverity`/`ObjectiveProgressSeverity`/`StatGridSeverity`. */
export type TagSeverity = 'success' | 'info' | 'warn' | 'danger' | 'secondary';

/** Couleur/texte associés à chaque sévérité, alignés sur les tokens de thème PrimeNG
 *  (`--p-tag-{severity}-background`/`color`) pour un rendu identique à `p-tag`,
 *  cohérent clair/sombre, sans dupliquer de palette.
 *  NB : ces variables sont chargées paresseusement par PrimeNG — c'est précisément le
 *  rôle du `<p-tag class="hidden">` monté dans `app.component.html`. */
const COULEURS_SEVERITE: Record<TagSeverity, { fond: string; texte: string }> = {
  success: { fond: 'var(--p-tag-success-background)', texte: 'var(--p-tag-success-color)' },
  info: { fond: 'var(--p-tag-info-background)', texte: 'var(--p-tag-info-color)' },
  warn: { fond: 'var(--p-tag-warn-background)', texte: 'var(--p-tag-warn-color)' },
  danger: { fond: 'var(--p-tag-danger-background)', texte: 'var(--p-tag-danger-color)' },
  secondary: { fond: 'var(--p-tag-secondary-background)', texte: 'var(--p-tag-secondary-color)' },
};

/**
 * Tag réutilisable, trois modes :
 * - couleur libre (`couleur` + `texte`) : fond coloré, texte contrasté automatiquement
 *   (ex. tags membre dans `postes-liste`, `comptes`, `repartition-periodes`) ;
 * - sévérité (`severity` + `texte`) : reprend les tokens de thème PrimeNG `p-tag`
 *   (ex. statuts `success`/`danger`/`info`/`warn`/`secondary`), remplace `<p-tag
 *   [value] [severity]>`.
 * - **ton de la charte** (`ton` + `texte`) : fond doux + texte plein du ton `--app-*`,
 *   rendu identique au badge de `app-carte-info`. À préférer à `severity` dès qu'un ton
 *   métier ou une échelle de la charte est en jeu — notamment `alerte` (orange), que les
 *   sévérités PrimeNG ne savent pas rendre.
 *
 * Priorité si plusieurs sont fournis : `severity` > `ton` > `couleur`. Le style est posé
 * sur le `:host` (plutôt qu'un `<span>` interne) pour que les classes additionnelles
 * passées par les consommateurs (`class="shrink-0"`, etc.) se combinent avec les classes
 * de base sans wrapper supplémentaire.
 */
@Component({
  selector: 'app-tag',
  standalone: true,
  // `ng-content` permet de préfixer le texte d'une icône (ex. flèche de dérive dans le
  // pied des cartes de poste) sans wrapper supplémentaire.
  template: '<ng-content/>{{ texte() }}',
  host: {
    class: 'app-tag',
    '[style.background-color]': 'couleurFond()',
    '[style.color]': 'couleurTexte()',
  },
  styles: [`
    :host {
      display: inline-flex;
      align-items: center;
      gap: var(--app-space-1);
      padding: var(--app-space-0-5) var(--app-space-1-5);
      border-radius: var(--app-radius-sm);
      font-size: var(--app-text-2xs);
      font-weight: var(--app-weight-medium);
      line-height: var(--app-leading-none);
    }
  `],
})
export class TagComponent {
  readonly couleur = input<string | null | undefined>();
  readonly severity = input<TagSeverity | null | undefined>();
  /** Ton de la charte (`--app-*`) : fond doux, texte plein. Voir `tons.ts`. */
  readonly ton = input<TonCarte | null | undefined>();
  readonly texte = input<string>('');

  readonly couleurFond = computed(() => {
    const severity = this.severity();
    if (severity) return COULEURS_SEVERITE[severity].fond;
    const ton = this.ton();
    if (ton) return couleurDouce(ton);
    return normaliserCouleur(this.couleur());
  });

  readonly couleurTexte = computed(() => {
    const severity = this.severity();
    if (severity) return COULEURS_SEVERITE[severity].texte;
    const ton = this.ton();
    if (ton) return couleurTexte(ton);
    return couleurTexteContraste(normaliserCouleur(this.couleur()));
  });
}
