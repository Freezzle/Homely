import { Component, Input, forwardRef, signal } from '@angular/core';
import { ControlValueAccessor, FormsModule, NG_VALUE_ACCESSOR } from '@angular/forms';
import { RadioButtonModule } from 'primeng/radiobutton';
import { TooltipModule } from 'primeng/tooltip';

/**
 * Bouton radio réutilisable (design system) — remplace `<p-radiobutton>` posé
 * directement. Layout inline (bouton + label optionnel à droite), même gabarit que
 * `<app-checkbox>` pour afficher une liste verticale d'options à sélection unique
 * (ex. critère de tri, regroupement — voir docs/features/feature_3.md §5).
 *
 * Toutes les instances d'un même groupe se lient au même modèle (`[ngModel]`/`(ngModelChange)`
 * ou `formControlName`) ; chaque instance porte sa propre valeur via `[optionValue]`.
 */
@Component({
  selector: 'app-radio-button',
  standalone: true,
  imports: [FormsModule, RadioButtonModule, TooltipModule],
  template: `
    <div class="flex items-center gap-2">
      <p-radiobutton
        [inputId]="inputId"
        [value]="optionValue"
        [disabled]="disabled()"
        [ngModel]="value()"
        (onClick)="handleChange()"
      />
      @if (label) {
        <label [for]="inputId" class="text-sm cursor-pointer" [pTooltip]="tooltip || undefined">{{ label }}</label>
      }
    </div>
  `,
  styles: [':host { display: block; margin-bottom: 0.75rem; }'],
  providers: [
    {
      provide: NG_VALUE_ACCESSOR,
      useExisting: forwardRef(() => RadioButtonComponent),
      multi: true,
    },
  ],
})
export class RadioButtonComponent implements ControlValueAccessor {
  @Input() label = '';
  @Input() inputId = '';
  @Input() tooltip = '';
  /** Valeur propre à cette option (comparée au modèle du groupe pour déterminer l'état coché). */
  @Input() optionValue: string = '';

  protected readonly value = signal<string | null>(null);
  protected readonly disabled = signal(false);

  /** Permet de désactiver l'option directement via un binding `[disabled]`, en plus du
   *  mécanisme standard `ControlValueAccessor.setDisabledState` (reactive/template forms). */
  @Input('disabled')
  set disabledInput(value: boolean) {
    this.disabled.set(!!value);
  }

  private onChange: (value: string) => void = () => {};
  protected onTouched: () => void = () => {};

  writeValue(value: string): void {
    this.value.set(value);
  }

  registerOnChange(fn: (value: string) => void): void {
    this.onChange = fn;
  }

  registerOnTouched(fn: () => void): void {
    this.onTouched = fn;
  }

  setDisabledState(isDisabled: boolean): void {
    this.disabled.set(isDisabled);
  }

  protected handleChange(): void {
    this.value.set(this.optionValue);
    this.onChange(this.optionValue);
    this.onTouched();
  }
}
