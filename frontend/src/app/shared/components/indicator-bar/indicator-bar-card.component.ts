import { CommonModule } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  TemplateRef,
  computed,
  input,
} from '@angular/core';
import { Popover, PopoverModule } from 'primeng/popover';
import { IndicatorBarComponent } from './indicator-bar.component';
import {
  IndicatorMarker,
  IndicatorSegment,
  IndicatorTick,
} from './indicator-bar.model';

/**
 * Enveloppe de présentation autour d'`IndicatorBarComponent` : titre, sous-titre,
 * barre, pied (formule + aide via `p-popover`). Pas de logique métier — les
 * bulles / segments / jalons viennent déjà calculés par l'appelant.
 *
 * Spécification : `docs/features/feature.md`.
 */
@Component({
  selector: 'app-indicator-card',
  standalone: true,
  imports: [CommonModule, PopoverModule, IndicatorBarComponent],
  templateUrl: './indicator-bar-card.component.html',
  styleUrl: './indicator-bar-card.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class IndicatorCardComponent {
  /** Titre de la carte (obligatoire). */
  readonly title = input.required<string>();
  readonly subtitle = input<string | undefined>(undefined);

  readonly segments = input<IndicatorSegment[]>([]);
  readonly ticks = input<IndicatorTick[]>([]);
  readonly markers = input<IndicatorMarker[]>([]);
  readonly showTicks = input<boolean>(true);
  readonly showTickLabels = input<boolean>(true);
  readonly showMarkers = input<boolean>(true);
  readonly barHeight = input<number | string | undefined>(undefined);

  /** Texte court du calcul. Non rendu si absent. */
  readonly formula = input<string | undefined>(undefined);
  /** Contenu de la bulle d'aide (string ou TemplateRef). Si absent, aucune icône n'est rendue. */
  readonly help = input<string | TemplateRef<unknown> | undefined>(undefined);

  /** Niveau de titre HTML (défaut `3` → `<h3>`). */
  readonly headingLevel = input<2 | 3 | 4 | 5 | 6>(3);

  /** Description globale de la barre (défaut : titre + libellés des bulles). */
  readonly ariaLabel = input<string | undefined>(undefined);

  protected readonly resolvedAriaLabel = computed(() => {
    const explicit = this.ariaLabel();
    if (explicit) return explicit;
    const bubbles = this.markers()
      .map((m) => m.label)
      .filter((l): l is string => !!l)
      .join(', ');
    return bubbles ? `${this.title()} — ${bubbles}` : this.title();
  });

  protected readonly hasHelp = computed(() => this.help() !== undefined);
  protected readonly hasFooter = computed(() => !!this.formula() || this.hasHelp());

  protected readonly helpIsTemplate = computed(
    () => this.help() instanceof TemplateRef,
  );

  protected readonly helpString = computed(() => {
    const h = this.help();
    return typeof h === 'string' ? h : '';
  });

  protected readonly helpTemplate = computed(() => {
    const h = this.help();
    return h instanceof TemplateRef ? (h as TemplateRef<unknown>) : null;
  });

  protected readonly helpAriaLabel = computed(() =>
    // TODO i18n : keys `shared.indicatorBar.aide/aideAriaLabel` non déclarées dans
    // `AppTranslations` — fallback littéral pour éviter d'exposer l'utilisateur à
    // un accès type-safe non valide. Ces libellés ne s'affichent que lorsque
    // `help` est fourni (jamais dans le drawer taux d'effort).
    `Aide : ${this.title()}`,
  );

  protected togglePopover(popover: Popover, event: Event): void {
    popover.toggle(event);
  }
}
