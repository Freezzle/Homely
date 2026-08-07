import { Component, Input, forwardRef } from '@angular/core';
import { ControlValueAccessor, FormsModule, NG_VALUE_ACCESSOR } from '@angular/forms';
import { SelectButtonModule } from 'primeng/selectbutton';
import { TooltipModule } from 'primeng/tooltip';

/**
 * Groupe de boutons de sélection réutilisable (design system) — remplace
 * `<p-selectbutton>` dupliqués dans les templates.
 * Volontairement **sans label** : chaque option doit porter un texte explicite
 * qui reflète son intention par lui-même (pas de question/label externe requis
 * pour comprendre le choix). Compatible `formControlName` et `[(ngModel)]`.
 */
@Component({
  selector: 'app-select-button',
  standalone: true,
  imports: [FormsModule, SelectButtonModule, TooltipModule],
  template: `
    <p-selectbutton
      [options]="options"
      [optionLabel]="optionLabel"
      [optionValue]="optionValue"
      [allowEmpty]="allowEmpty"
      [disabled]="disabled"
      [ngModel]="value"
      (ngModelChange)="handleChange($event)"
      [styleClass]="styleClass"
      [pTooltip]="tooltip || undefined"
      class="w-full"
    />
    @if (hint) {
      <div class="text-xs text-surface-500 mt-1">{{ hint }}</div>
    }
  `,
  styles: [':host { display: block; margin-bottom: 0.75rem; }'],
  providers: [
    {
      provide: NG_VALUE_ACCESSOR,
      useExisting: forwardRef(() => SelectButtonComponent),
      multi: true,
    },
  ],
})
export class SelectButtonComponent implements ControlValueAccessor {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  @Input() options: any[] | undefined = undefined;
  @Input() optionLabel: string | undefined = undefined;
  @Input() optionValue: string | undefined = undefined;
  @Input() allowEmpty: boolean | undefined = undefined;
  @Input() styleClass: string | undefined = undefined;
  @Input() hint = '';
  @Input() tooltip = '';

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  protected value: any = null;
  protected disabled = false;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private onChange: (value: any) => void = () => {};
  protected onTouched: () => void = () => {};

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  writeValue(value: any): void {
    this.value = value;
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  registerOnChange(fn: (value: any) => void): void {
    this.onChange = fn;
  }

  registerOnTouched(fn: () => void): void {
    this.onTouched = fn;
  }

  setDisabledState(isDisabled: boolean): void {
    this.disabled = isDisabled;
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  protected handleChange(value: any): void {
    this.value = value;
    this.onChange(value);
    this.onTouched();
  }
}
