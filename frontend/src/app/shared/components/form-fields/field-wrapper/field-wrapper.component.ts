import { Component, Input } from '@angular/core';
import { TooltipModule } from 'primeng/tooltip';
import { FloatLabelModule } from 'primeng/floatlabel';

/**
 * Bloc label flottant (`p-floatlabel` variant `on`) + contrôle, commun à tous
 * les champs de formulaire (design system). Usage interne aux composants
 * `app-*` de `form-fields` — pas destiné à être utilisé directement dans les
 * templates de fonctionnalité.
 *
 * Le nom du champ sert uniquement de label flottant : aucun `placeholder`
 * n'est utilisé sur les contrôles.
 */
@Component({
  selector: 'app-field-wrapper',
  standalone: true,
  imports: [TooltipModule, FloatLabelModule],
  template: `
    <p-floatlabel variant="on" class="w-full">
      <ng-content></ng-content>
      @if (label) {
        <label [for]="labelFor" [pTooltip]="tooltip || undefined">
          {{ label }}
          @if (required) {
            <span class="text-red-500">*</span>
          }
        </label>
      }
    </p-floatlabel>
    @if (hint) {
      <div class="text-xs text-surface-500 mt-1">{{ hint }}</div>
    }
  `,
  styles: [':host { display: block; margin-bottom: 0.75rem; }'],
})
export class FieldWrapperComponent {
  @Input() label = '';
  @Input() required = false;
  @Input() hint = '';
  @Input() tooltip = '';
  /** id du contrôle interne, pour lier le `<label for>` via `p-floatlabel`. */
  @Input() labelFor = '';
}
