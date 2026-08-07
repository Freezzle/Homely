import { Component, ElementRef, Input, ViewChild, forwardRef } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ControlValueAccessor, NG_VALUE_ACCESSOR } from '@angular/forms';
import { InputTextModule } from 'primeng/inputtext';
import { FieldWrapperComponent } from '../field-wrapper/field-wrapper.component';
import { generateFieldId } from '../generate-field-id.util';

/**
 * Champ texte réutilisable (design system) — remplace `<input pInputText>` +
 * `<label>` dupliqués dans les templates. Le nom du champ s'affiche en label
 * flottant (`p-floatlabel` variant `on`) : pas de `placeholder`. Compatible
 * `formControlName` et `[(ngModel)]`.
 */
@Component({
  selector: 'app-input-text',
  standalone: true,
  imports: [FormsModule, InputTextModule, FieldWrapperComponent],
  template: `
    <app-field-wrapper [label]="label" [required]="required" [hint]="hint" [tooltip]="tooltip" [labelFor]="fieldId">
      <input
        #inputElement
        pInputText
        [id]="fieldId"
        [type]="type"
        [attr.maxlength]="maxlength"
        [readonly]="readonly"
        [disabled]="disabled"
        [ngModel]="value"
        (ngModelChange)="handleChange($event)"
        (blur)="onTouched()"
        class="w-full"
      />
    </app-field-wrapper>
  `,
  styles: [':host { display: block; }'],
  providers: [
    {
      provide: NG_VALUE_ACCESSOR,
      useExisting: forwardRef(() => InputTextComponent),
      multi: true,
    },
  ],
})
export class InputTextComponent implements ControlValueAccessor {
  @Input() label = '';
  @Input() type: 'text' | 'email' | 'password' = 'text';
  @Input() maxlength: number | null = null;
  @Input() readonly = false;
  @Input() required = false;
  @Input() hint = '';
  @Input() tooltip = '';

  protected readonly fieldId = generateFieldId('input-text');

  @ViewChild('inputElement') private inputElement?: ElementRef<HTMLInputElement>;

  protected value: string | null = null;
  protected disabled = false;

  private onChange: (value: string | null) => void = () => {};
  protected onTouched: () => void = () => {};

  writeValue(value: string | null): void {
    this.value = value;
  }

  registerOnChange(fn: (value: string | null) => void): void {
    this.onChange = fn;
  }

  registerOnTouched(fn: () => void): void {
    this.onTouched = fn;
  }

  setDisabledState(isDisabled: boolean): void {
    this.disabled = isDisabled;
  }

  protected handleChange(value: string | null): void {
    this.value = value;
    this.onChange(value);
  }

  focus(): void {
    this.inputElement?.nativeElement.focus();
  }
}
