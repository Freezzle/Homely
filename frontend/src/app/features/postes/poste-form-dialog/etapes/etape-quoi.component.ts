import { ChangeDetectionStrategy, Component, inject, input, viewChild } from '@angular/core';
import { FormGroup, ReactiveFormsModule } from '@angular/forms';
import { MessageModule } from 'primeng/message';
import { CategorieDto } from '../../../../core/models/api.models';
import { I18nService } from '../../../../core/i18n/i18n.service';
import { InputTextComponent } from '../../../../shared/components/form-fields';
import { ChoixPucesComponent } from '../../../../shared/components/choix-puces/choix-puces.component';
import { OptionChoix } from '../../../../shared/components/choix-cartes/option-choix.model';

/**
 * Étape « C'est pour quoi ? » : nom du poste et catégorie.
 * Aucune pré-sélection ni suggestion de catégorie — l'ordre du référentiel est
 * respecté tel quel.
 */
@Component({
  selector: 'app-etape-quoi',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ReactiveFormsModule, InputTextComponent, ChoixPucesComponent, MessageModule],
  template: `
    <div class="flex flex-col gap-5" [formGroup]="form()">
      <div>
        <app-input-text
          #champNom
          [label]="t.poste.form.nomPoste"
          [required]="true"
          formControlName="description"
        />
        @if (form().get('description')!.invalid && form().get('description')!.touched) {
          <p-message severity="error">{{ t.commun.champObligatoire }}</p-message>
        }
      </div>

      <div>
        <app-choix-puces
          [label]="t.poste.form.categorie"
          [options]="options()"
          [value]="categorieId()"
          (valueChange)="choisirCategorie($event)"
        />
        @if (form().get('categorieId')!.invalid && form().get('categorieId')!.touched) {
          <p-message severity="error">{{ t.commun.champObligatoire }}</p-message>
        }
      </div>
    </div>
  `,
})
export class EtapeQuoiComponent {
  private readonly i18n = inject(I18nService);
  protected readonly t = this.i18n.translations();

  readonly form = input.required<FormGroup>();
  readonly categories = input.required<readonly CategorieDto[]>();
  /** Catégorie courante (passée par le conteneur : l'étape est en OnPush). */
  readonly categorieId = input<string | null>(null);

  private readonly champNom = viewChild<InputTextComponent>('champNom');

  protected options(): OptionChoix<string>[] {
    return this.categories().map(c => ({ value: c.id, titre: c.libelle }));
  }

  protected choisirCategorie(id: string | null): void {
    this.form().get('categorieId')!.setValue(id);
    this.form().get('categorieId')!.markAsDirty();
  }

  /** Appelé par le conteneur à l'ouverture du dialog (création uniquement). */
  focus(): void {
    this.champNom()?.focus();
  }
}
