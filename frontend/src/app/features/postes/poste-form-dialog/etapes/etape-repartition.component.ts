import { ChangeDetectionStrategy, Component, computed, inject, input, model } from '@angular/core';
import { FormGroup, ReactiveFormsModule } from '@angular/forms';
import { MessageModule } from 'primeng/message';
import { CompteDto, MembreDto, TypePoste } from '../../../../core/models/api.models';
import { I18nService } from '../../../../core/i18n/i18n.service';
import { CheckboxComponent } from '../../../../shared/components/form-fields';
import { PosteRepartitionComponent } from '../components/poste-repartition/poste-repartition.component';
import { RepartitionSaisie } from '../components/poste-repartition/repartition-saisie.model';
import { PosteFormValeurs } from '../poste-form-etapes';

/**
 * Étape « Qui paie ? » : répartition entre les membres, comptes de ventilation,
 * et (pour un revenu de foyer à plusieurs membres) prise en compte dans le
 * prorata théorique.
 */
@Component({
  selector: 'app-etape-repartition',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ReactiveFormsModule, MessageModule, CheckboxComponent, PosteRepartitionComponent],
  template: `
    <div class="flex flex-col gap-5" [formGroup]="form()">
      <app-poste-repartition
        [membres]="membres()"
        [comptes]="comptes()"
        [partsAuto]="partsAuto()"
        [montant]="valeurs().montant ?? 0"
        [devise]="valeurs().devise ?? ''"
        [type]="type()"
        [(valeur)]="repartition"
      />

      @if (afficherProrata()) {
        <app-checkbox
          inputId="poste-prorata-theorique"
          [label]="t.poste.inclureProrataTheorique"
          [tooltip]="t.poste.inclureProrataTheoriqueTooltip"
          formControlName="inclureProrataTheorique"
        />
      }

      @if (erreur()) {
        <p-message severity="error">{{ erreur()! }}</p-message>
      }
    </div>
  `,
  styles: [':host { display: block; }'],
})
export class EtapeRepartitionComponent {
  private readonly i18n = inject(I18nService);
  protected readonly t = this.i18n.translations();

  readonly form = input.required<FormGroup>();
  readonly valeurs = input.required<PosteFormValeurs>();
  readonly membres = input.required<readonly MembreDto[]>();
  readonly comptes = input.required<readonly CompteDto[]>();
  readonly partsAuto = input.required<Readonly<Record<string, number>>>();
  readonly type = input.required<TypePoste>();
  /** Message d'erreur déjà traduit (somme ≠ 100 %, compte manquant…). */
  readonly erreur = input<string | null>(null);

  readonly repartition = model.required<RepartitionSaisie>();

  protected readonly afficherProrata = computed(() => this.type() === 'REVENU' && this.membres().length > 1);
}
