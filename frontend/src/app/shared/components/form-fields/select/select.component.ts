import { Component, Input, forwardRef, signal } from '@angular/core';
import { ControlValueAccessor, FormsModule, NG_VALUE_ACCESSOR } from '@angular/forms';
import { SelectModule } from 'primeng/select';
import { FieldWrapperComponent } from '../field-wrapper/field-wrapper.component';
import { generateFieldId } from '../generate-field-id.util';

/**
 * Champ de sélection réutilisable (design system) — remplace `<p-select>` +
 * `<label>` dupliqués dans les templates. Le nom du champ s'affiche en label
 * flottant (`p-floatlabel` variant `on`) : pas de `placeholder`. Compatible
 * `formControlName` et `[(ngModel)]`.
 */
@Component({
  selector: 'app-select',
  standalone: true,
  imports: [FormsModule, SelectModule, FieldWrapperComponent],
  template: `
    <app-field-wrapper [label]="label" [required]="required" [hint]="hint" [tooltip]="tooltip" [labelFor]="fieldId">
      <p-select
        [inputId]="fieldId"
        [appendTo]="appendTo"
        [options]="options"
        [optionLabel]="optionLabel"
        [optionValue]="optionValue"
        [dataKey]="dataKey"
        [filter]="filter"
        [showClear]="showClear"
        [disabled]="disabled()"
        [ngModel]="value()"
        (ngModelChange)="handleChange($event)"
        (onBlur)="onTouched()"
        class="w-full"
      >
        <ng-content />
      </p-select>
    </app-field-wrapper>
  `,
  styles: [':host { display: block; }'],
  providers: [
    {
      provide: NG_VALUE_ACCESSOR,
      useExisting: forwardRef(() => SelectComponent),
      multi: true,
    },
  ],
})
export class SelectComponent implements ControlValueAccessor {
  @Input() label = '';
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  @Input() options: any[] | null = null;
  @Input() optionLabel: string | undefined = undefined;
  @Input() optionValue: string | undefined = undefined;
  @Input() dataKey: string | undefined = undefined;
  @Input() filter = false;
  @Input() showClear = false;
  @Input() appendTo: 'self' | 'body' = 'body';
  @Input() required = false;
  @Input() hint = '';
  @Input() tooltip = '';

  protected readonly fieldId = generateFieldId('select');

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  protected readonly value = signal<any>(null);
  protected readonly disabled = signal(false);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private onChange: (value: any) => void = () => {};
  protected onTouched: () => void = () => {};

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  writeValue(value: any): void {
    this.value.set(value);
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  registerOnChange(fn: (value: any) => void): void {
    this.onChange = fn;
  }

  registerOnTouched(fn: () => void): void {
    this.onTouched = fn;
  }

  setDisabledState(isDisabled: boolean): void {
    this.disabled.set(isDisabled);
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  protected handleChange(value: any): void {
    this.value.set(value);
    this.onChange(value);
  }
}
