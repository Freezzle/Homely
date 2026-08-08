import { Component, forwardRef, Input, signal } from '@angular/core';
import { ControlValueAccessor, FormsModule, NG_VALUE_ACCESSOR } from '@angular/forms';
import { DatePickerModule } from 'primeng/datepicker';
import { FieldWrapperComponent } from '../field-wrapper/field-wrapper.component';
import { generateFieldId } from '../generate-field-id.util';

/**
 * Sélecteur de date réutilisable (design system) — remplace `<p-datepicker>` +
 * `<label>` dupliqués dans les templates. Le nom du champ s'affiche en label
 * flottant (`p-floatlabel` variant `on`) : pas de `placeholder`. Compatible
 * `formControlName` et `[(ngModel)]`.
 */
@Component({
  selector: 'app-date-picker',
  standalone: true,
  imports: [FormsModule, DatePickerModule, FieldWrapperComponent],
  template: `
    <app-field-wrapper [label]="label" [required]="required" [hint]="hint" [tooltip]="tooltip" [labelFor]="fieldId">
      <p-datepicker
        [inputId]="fieldId"
        appendTo="body"
        [dateFormat]="dateFormat"
        [view]="view"
        [minDate]="minDate"
        [maxDate]="maxDate"
        [showButtonBar]="showButtonBar"
        [showClear]="showClear"
        [disabled]="disabled()"
        [ngModel]="value()"
        (ngModelChange)="handleChange($event)"
        (onBlur)="onTouched()"
        class="w-full"
      />
    </app-field-wrapper>
  `,
  styles: [':host { display: block; }'],
  providers: [
    {
      provide: NG_VALUE_ACCESSOR,
      useExisting: forwardRef(() => DatePickerComponent),
      multi: true,
    },
  ],
})
export class DatePickerComponent implements ControlValueAccessor {
  @Input() label = '';
  @Input() dateFormat = 'dd/mm/yy';
  @Input() view: 'date' | 'month' | 'year' = 'date';
  @Input() minDate: Date | null = null;
  @Input() maxDate: Date | null = null;
  @Input() showButtonBar = true;
  @Input() showClear = false;
  @Input() required = false;
  @Input() hint = '';
  @Input() tooltip = '';

  protected readonly fieldId = generateFieldId('date-picker');

  protected readonly value = signal<Date | null>(null);
  protected readonly disabled = signal(false);

  private onChange: (value: Date | null) => void = () => {};
  protected onTouched: () => void = () => {};

  writeValue(value: Date | null): void {
    this.value.set(value);
  }

  registerOnChange(fn: (value: Date | null) => void): void {
    this.onChange = fn;
  }

  registerOnTouched(fn: () => void): void {
    this.onTouched = fn;
  }

  setDisabledState(isDisabled: boolean): void {
    this.disabled.set(isDisabled);
  }

  protected handleChange(value: Date | null): void {
    this.value.set(value);
    this.onChange(value);
  }
}
