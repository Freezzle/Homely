import { ChangeDetectionStrategy, Component, inject, input } from '@angular/core';
import { FormGroup, ReactiveFormsModule } from '@angular/forms';
import { I18nService } from '../../../../core/i18n/i18n.service';
import { EchelleNotationComponent } from '../../../../shared/components/echelle-notation/echelle-notation.component';
import { PosteFormValeurs } from '../poste-form-etapes';

/**
 * Étape « Analyse » (facultative) : les trois notes de 1 à 5 qui alimentent les
 * tableaux de bord. Toujours valide, valeurs par défaut à 3.
 */
@Component({
  selector: 'app-etape-analyse',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ReactiveFormsModule, EchelleNotationComponent],
  template: `
    <div class="flex flex-col gap-5" [formGroup]="form()">
      <p class="aide">{{ t.poste.form.analyseAide }}</p>

      <app-echelle-notation
        [label]="t.poste.importance"
        [question]="t.poste.form.questionImportance"
        [libelleMin]="t.poste.importanceMin"
        [libelleMax]="t.poste.importanceMax"
        [gabaritAria]="t.poste.form.noteSur5"
        [value]="valeurs().importance ?? 3"
        (valueChange)="majNote('importance', $event)"
      />

      <app-echelle-notation
        [label]="t.poste.potentielOptimisation"
        [question]="t.poste.form.questionOptimisation"
        [libelleMin]="t.poste.potentielOptimisationMin"
        [libelleMax]="t.poste.potentielOptimisationMax"
        [gabaritAria]="t.poste.form.noteSur5"
        [value]="valeurs().potentielOptimisation ?? 3"
        (valueChange)="majNote('potentielOptimisation', $event)"
      />

      <app-echelle-notation
        [label]="t.poste.deriveExterne"
        [question]="t.poste.form.questionDerive"
        [libelleMin]="t.poste.deriveExterneMin"
        [libelleMax]="t.poste.deriveExterneMax"
        [gabaritAria]="t.poste.form.noteSur5"
        [value]="valeurs().deriveExterne ?? 3"
        (valueChange)="majNote('deriveExterne', $event)"
      />
    </div>
  `,
  styles: [`
    :host { display: block; }
    .aide { font-size: var(--app-text-sm); color: var(--app-ink-muted); }
  `],
})
export class EtapeAnalyseComponent {
  private readonly i18n = inject(I18nService);
  protected readonly t = this.i18n.translations();

  readonly form = input.required<FormGroup>();
  readonly valeurs = input.required<PosteFormValeurs>();

  protected majNote(controle: 'importance' | 'potentielOptimisation' | 'deriveExterne', note: number): void {
    const ctrl = this.form().get(controle)!;
    ctrl.setValue(note);
    ctrl.markAsDirty();
  }
}
