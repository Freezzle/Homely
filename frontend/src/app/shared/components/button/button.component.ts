import { Component, input, output } from '@angular/core';
import { ButtonModule } from 'primeng/button';

/** Même union que les autres composants du design system (`TagSeverity`, etc.),
 *  limitée aux valeurs réellement utilisées dans l'app. */
export type ButtonSeverity = 'primary' | 'secondary' | 'success' | 'info' | 'warn' | 'danger' | 'contrast';

/**
 * Bouton réutilisable (design system) — wrap `<p-button>` avec le sous-ensemble
 * d'attributs réellement utilisé dans l'app, pour centraliser un futur besoin
 * d'évolution du style/comportement des boutons sans repasser sur chaque écran.
 * Le `:host` est `display: contents` : aucun wrapper de layout n'est ajouté, le
 * `<p-button>` rendu se comporte comme s'il était directement à la place d'`<app-button>`
 * (flex/grid gap, etc. inchangés). `pTooltip`, `[attr.aria-label]` additionnel, etc.
 * peuvent être posés directement sur `<app-button>` par l'appelant (ils s'attachent
 * au host quel que soit le composant).
 *
 * `(click)` est explicitement réémis (voir {@link click}) plutôt que laissé bulle
 * nativement jusqu'au host : un listener natif posé sur `<app-button>` recevrait un
 * évènement dont `currentTarget` est le host `display: contents` (rect 0×0), ce qui
 * fait par ex. s'ouvrir un `p-menu`/`p-popover` positionné dessus (via
 * `event.currentTarget`) tout en haut à gauche de l'écran au lieu de l'endroit du
 * bouton. En réémettant l'évènement natif du vrai `<button>` interne via un
 * `output()`, `currentTarget` référence le bouton effectivement cliqué.
 */
@Component({
  selector: 'app-button',
  standalone: true,
  imports: [ButtonModule],
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
      (click)="click.emit($event)"
    >
      <ng-content />
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

  /** Réémet le clic natif du bouton interne — voir la note ci-dessus sur `currentTarget`. */
  readonly click = output<MouseEvent>();
}
