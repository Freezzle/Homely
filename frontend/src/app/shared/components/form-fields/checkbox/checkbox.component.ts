import { Component, Input, forwardRef } from '@angular/core';
import { ControlValueAccessor, FormsModule, NG_VALUE_ACCESSOR } from '@angular/forms';
import { CheckboxModule } from 'primeng/checkbox';

/**
 * Case à cocher réutilisable (design system) — remplace `<p-checkbox [binary]="true">`.
 * Layout inline (case + label optionnel à droite), compatible `formControlName`
 * et `[(ngModel)]`.
 */
@Component({
  selector: 'app-checkbox',
  standalone: true,
  imports: [FormsModule, CheckboxModule],
  template: `
    <div class="flex items-center gap-2">
      <p-checkbox
        [binary]="true"
        [inputId]="inputId"
        [disabled]="disabled"
        [ngModel]="value"
        (onChange)="handleChange($event.checked)"
      />
      @if (label) {
        <label [for]="inputId" class="text-sm">{{ label }}</label>
      }
    </div>
  `,
  styles: [':host { display: block; margin-bottom: 0.75rem; }'],
  providers: [
    {
      provide: NG_VALUE_ACCESSOR,
      useExisting: forwardRef(() => CheckboxComponent),
      multi: true,
    },
  ],
})
export class CheckboxComponent implements ControlValueAccessor {
  @Input() label = '';
  @Input() inputId = '';

  protected value = false;
  protected disabled = false;

  private onChange: (value: boolean) => void = () => {};
  protected onTouched: () => void = () => {};

  writeValue(value: boolean): void {
    this.value = !!value;
  }

  registerOnChange(fn: (value: boolean) => void): void {
    this.onChange = fn;
  }

  registerOnTouched(fn: () => void): void {
    this.onTouched = fn;
  }

  setDisabledState(isDisabled: boolean): void {
    this.disabled = isDisabled;
  }

  protected handleChange(value: boolean): void {
    this.value = value;
    this.onChange(value);
    this.onTouched();
  }
}
