import { Component, EventEmitter, Input, Output, forwardRef } from '@angular/core';
import { ControlValueAccessor, FormsModule, NG_VALUE_ACCESSOR } from '@angular/forms';
import { InputNumberModule } from 'primeng/inputnumber';
import { FieldWrapperComponent } from '../field-wrapper/field-wrapper.component';
import { generateFieldId } from '../generate-field-id.util';

/**
 * Champ numérique réutilisable (design system) — remplace `<p-inputnumber>` +
 * `<label>` dupliqués dans les templates. Le nom du champ s'affiche en label
 * flottant (`p-floatlabel` variant `on`) : pas de `placeholder`. Compatible
 * `formControlName` et `[(ngModel)]`.
 */
@Component({
  selector: 'app-input-number',
  standalone: true,
  imports: [FormsModule, InputNumberModule, FieldWrapperComponent],
  template: `
    <app-field-wrapper [label]="label" [required]="required" [hint]="hint" [tooltip]="tooltip" [labelFor]="fieldId">
      <p-inputnumber
        [inputId]="fieldId"
        [mode]="mode"
        [allowEmpty]="true"
        [min]="min"
        [max]="max"
        [minFractionDigits]="minFractionDigits"
        [maxFractionDigits]="maxFractionDigits"
        [useGrouping]="useGrouping"
        [suffix]="suffix"
        [prefix]="prefix"
        [inputStyleClass]="inputStyleClass"
        [disabled]="disabled"
        [ngModel]="value"
        (ngModelChange)="handleChange($event)"
        (onInput)="emitInput($event.value)"
        (onBlur)="onTouched()"
        class="w-full"
      />
    </app-field-wrapper>
  `,
  styles: [':host { display: block; }'],
  providers: [
    {
      provide: NG_VALUE_ACCESSOR,
      useExisting: forwardRef(() => InputNumberComponent),
      multi: true,
    },
  ],
})
export class InputNumberComponent implements ControlValueAccessor {
  @Input() label = '';
  @Input() mode: 'decimal' | 'currency' = 'decimal';
  @Input() min: number | null = null;
  @Input() max: number | null = null;
  @Input() minFractionDigits: number | null = null;
  @Input() maxFractionDigits: number | null = null;
  @Input() useGrouping = true;
  @Input() suffix: string | undefined = undefined;
  @Input() prefix: string | undefined = undefined;
  @Input() inputStyleClass: string | undefined = undefined;
  @Input() required = false;
  @Input() hint = '';
  @Input() tooltip = '';
  @Output() readonly onInput = new EventEmitter<number | null>();

  protected readonly fieldId = generateFieldId('input-number');

  protected value: number | null = null;
  protected disabled = false;

  private onChange: (value: number | null) => void = () => {};
  protected onTouched: () => void = () => {};

  writeValue(value: number | null): void {
    this.value = value;
  }

  registerOnChange(fn: (value: number | null) => void): void {
    this.onChange = fn;
  }

  registerOnTouched(fn: () => void): void {
    this.onTouched = fn;
  }

  setDisabledState(isDisabled: boolean): void {
    this.disabled = isDisabled;
  }

  protected handleChange(value: number | null): void {
    this.value = value;
    this.onChange(value);
  }

  protected emitInput(value: number | null): void {
    this.onInput.emit(value);
  }
}
