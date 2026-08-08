import { Component, Input, forwardRef, signal } from '@angular/core';
import { ControlValueAccessor, FormsModule, NG_VALUE_ACCESSOR } from '@angular/forms';
import { FieldWrapperComponent } from '../field-wrapper/field-wrapper.component';

/**
 * Sélecteur de couleur réutilisable (design system) — remplace
 * `<input type="color">` natif. Compatible `formControlName` et `[(ngModel)]`.
 */
@Component({
  selector: 'app-color-input',
  standalone: true,
  imports: [FormsModule, FieldWrapperComponent],
  template: `
    <app-field-wrapper [label]="label" [required]="required" [hint]="hint" [tooltip]="tooltip">
      <input
        type="color"
        [attr.aria-label]="ariaLabel"
        [disabled]="disabled()"
        [ngModel]="value()"
        (ngModelChange)="handleChange($event)"
        (blur)="onTouched()"
        class="h-9 w-11 border border-surface-300 rounded cursor-pointer"
      />
    </app-field-wrapper>
  `,
  styles: [':host { display: block; }'],
  providers: [
    {
      provide: NG_VALUE_ACCESSOR,
      useExisting: forwardRef(() => ColorInputComponent),
      multi: true,
    },
  ],
})
export class ColorInputComponent implements ControlValueAccessor {
  @Input() label = '';
  @Input() ariaLabel = '';
  @Input() required = false;
  @Input() hint = '';
  @Input() tooltip = '';

  protected readonly value = signal('#000000');
  protected readonly disabled = signal(false);

  private onChange: (value: string) => void = () => {};
  protected onTouched: () => void = () => {};

  writeValue(value: string): void {
    this.value.set(value ?? '#000000');
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

  protected handleChange(value: string): void {
    this.value.set(value);
    this.onChange(value);
  }
}
