import { Component, input, output } from '@angular/core';
import { ButtonModule } from 'primeng/button';
import { TooltipModule } from 'primeng/tooltip';

/** Même union que les autres composants du design system (`TagSeverity`, etc.),
 *  limitée aux valeurs réellement utilisées dans l'app. */
export type ButtonSeverity = 'primary' | 'secondary' | 'success' | 'info' | 'warn' | 'danger' | 'contrast';

/**
 * Bouton réutilisable (design system) — wrap `<p-button>` avec le sous-ensemble
 * d'attributs réellement utilisé dans l'app, pour centraliser un futur besoin
 * d'évolution du style/comportement des boutons sans repasser sur chaque écran.
 * Le `:host` est `display: contents` : aucun wrapper de layout n'est ajouté, le
 * `<p-button>` rendu se comporte comme s'il était directement à la place d'`<app-button>`
 * (flex/grid gap, etc. inchangés).
 *
 * IMPORTANT — ne PAS poser `(click)` ni `pTooltip` directement sur `<app-button>` :
 * le host est `display: contents` (rect 0×0), donc tout listener/directive qui lit
 * `currentTarget`/`getBoundingClientRect()` sur cet élément (positionnement de
 * `p-menu`/`p-popover` via `event.currentTarget`, ou la directive `Tooltip`) placera
 * l'overlay tout en haut à gauche de l'écran au lieu de l'endroit du bouton.
 * - Pour le clic : utiliser `(click)` normalement sur `<app-button>` — il est
 *   explicitement réémis (voir {@link click}) à partir de l'output `onClick` de
 *   `p-button` (qui porte l'évènement natif du vrai `<button>` interne, avec un
 *   `currentTarget` correctement dimensionné). Ne PAS binder nativement `(click)`
 *   directement sur `<p-button>` : ce composant n'expose que l'output `onClick`
 *   (cf. sa doc : "Using a regular <button> element, use (click)").
 * - Pour le tooltip : utiliser l'input {@link tooltip} plutôt que `pTooltip`. En
 *   interne il est posé sur `<p-button>` : la directive `Tooltip` de PrimeNG résout
 *   spécialement son élément cible quand l'hôte est un composant PrimeNG (nodeName
 *   commençant par `P-` → recherche un descendant `.p-component`), ce qui n'est pas
 *   le cas pour un composant custom comme `<app-button>`.
 */
@Component({
  selector: 'app-button',
  standalone: true,
  imports: [ButtonModule, TooltipModule],
  template: `
    <p-button
        [label]="label()"
        [icon]="icon()"
        [iconPos]="iconPos()"
        [severity]="severity()"
        [text]="text()"
        [outlined]="outlined()"
        [rounded]="rounded()"
        [size]="size()"
        [disabled]="disabled()"
        [loading]="loading()"
        [type]="type()"
        [ariaLabel]="ariaLabel()"
        [styleClass]="styleClass()"
        [pTooltip]="tooltip()"
        [tooltipPosition]="tooltipPosition()"
        (onClick)="clickEvent.emit($event)"
    >
      <ng-content/>
    </p-button>
  `,
  styles: [':host { display: contents; }'],
})
export class ButtonComponent {
  readonly label = input<string | undefined>(undefined);
  readonly icon = input<string | undefined>(undefined);
  readonly iconPos = input<'left' | 'right'>('left');
  readonly severity = input<ButtonSeverity | undefined>(undefined);
  readonly text = input(false);
  readonly outlined = input(false);
  readonly rounded = input(false);
  readonly size = input<'small' | 'large' | undefined>(undefined);
  readonly disabled = input(false);
  readonly loading = input(false);
  readonly type = input<'button' | 'submit' | 'reset'>('button');
  readonly ariaLabel = input<string | undefined>(undefined);
  readonly styleClass = input<string | undefined>(undefined);
  /** Tooltip à afficher — à utiliser à la place de `pTooltip` posé directement sur `<app-button>` (voir note ci-dessus). */
  readonly tooltip = input<string | undefined>(undefined);
  /** Position du tooltip (défaut PrimeNG : 'right'). */
  readonly tooltipPosition = input<'top' | 'bottom' | 'left' | 'right' | undefined>(undefined);

  /** Réémet le clic (`onClick`) de `p-button` — voir la note ci-dessus sur `currentTarget`. */
  readonly clickEvent = output<MouseEvent>();
}
