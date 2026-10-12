import { ChangeDetectionStrategy, Component, computed, inject, input } from '@angular/core';
import { FormGroup, FormsModule, ReactiveFormsModule } from '@angular/forms';
import { MessageModule } from 'primeng/message';
import { I18nService } from '../../../../core/i18n/i18n.service';
import { MontantPipe } from '../../../../core/pipes/format.pipes';
import {
  CheckboxComponent,
  InputNumberComponent,
  SelectComponent,
} from '../../../../shared/components/form-fields';
import { ChoixPucesComponent } from '../../../../shared/components/choix-puces/choix-puces.component';
import { OptionChoix } from '../../../../shared/components/choix-cartes/option-choix.model';
import { PosteFormValeurs } from '../poste-form-etapes';

/** Périodicités proposées en accès direct ; les autres passent par « Autre… ». */
const PERIODICITES_COURANTES = [0, 1, 3, 6, 12] as const;
const AUTRE = 'autre';

type ChoixFrequence = number | typeof AUTRE;

/**
 * Étape « Combien, et à quel rythme ? » : montant, devise, périodicité et
 * caractère approximatif du montant.
 */
@Component({
  selector: 'app-etape-combien',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    ReactiveFormsModule, FormsModule, MessageModule, InputNumberComponent, SelectComponent,
      CheckboxComponent, ChoixPucesComponent,  ],
  template: `
    <div class="flex flex-col gap-5" [formGroup]="form()">
      <div class="grid grid-cols-[2fr_1fr] gap-3 items-start">
        <div>
          <app-input-number
            [label]="t.poste.montant"
            [required]="true"
            [min]="0"
            [minFractionDigits]="2"
            [maxFractionDigits]="2"
            formControlName="montant"
          />
          @if (form().get('montant')!.invalid && form().get('montant')!.touched) {
            <p-message severity="error">{{ t.commun.champObligatoire }}</p-message>
          }
        </div>
        <app-select
          [label]="t.poste.devise"
          formControlName="devise"
          [options]="devises()"
        />
      </div>

      <div>
        <app-choix-puces
          [label]="t.poste.form.frequence"
          [options]="frequences()"
          [value]="frequenceActive()"
          (valueChange)="choisirFrequence($event)"
        />
        @if (frequenceActive() === 'autre') {
          <app-select
            class="mt-3 block"
            [label]="t.poste.form.autrePeriodicite"
            formControlName="periodiciteMois"
            [options]="periodicitesAutres()"
            optionLabel="label"
            optionValue="value"
          />
        }
      </div>

      @if (conversion(); as conv) {
        <p class="conversion">{{ conv }}</p>
      }

      <div>
        <app-checkbox
          inputId="poste-approximatif"
          [label]="t.poste.form.approximatif"
          [tooltip]="t.poste.natureTooltip"
          [ngModel]="estEstimation()"
          [ngModelOptions]="{ standalone: true }"
          (ngModelChange)="basculerEstimation($event)"
        />
        @if (estEstimation()) {
          <div class="marge">
            <span>{{ t.poste.form.marge }}</span>
            <app-input-number
              [min]="0"
              [max]="100"
              [maxFractionDigits]="1"
              suffix=" %"
              formControlName="estimPourcentage"
            />
          </div>
        }
      </div>
    </div>
  `,
  styles: [`
    :host { display: block; }

    .conversion { font-size: var(--app-text-sm); color: var(--app-ink-muted); }

    .marge {
      display: flex;
      align-items: center;
      gap: var(--app-space-2);
      font-size: var(--app-text-sm);
      color: var(--app-ink-muted);
    }
  `],
})
export class EtapeCombienComponent {
  private readonly i18n = inject(I18nService);
  private readonly montantPipe = inject(MontantPipe);
  protected readonly t = this.i18n.translations();

  readonly form = input.required<FormGroup>();
  readonly valeurs = input.required<PosteFormValeurs>();
  readonly devises = input.required<string[]>();
  /** Périodicités hors raccourcis, pour le select « Autre… ». */
  readonly periodicitesAutres = input.required<{ label: string; value: number }[]>();

  protected readonly frequences = computed<OptionChoix<ChoixFrequence>[]>(() => {
    const f = this.t.poste.form.frequences;
    return [
      { value: 0, titre: f[0] },
      { value: 1, titre: f[1] },
      { value: 3, titre: f[3] },
      { value: 6, titre: f[6] },
      { value: 12, titre: f[12] },
      { value: AUTRE, titre: f.autre },
    ];
  });

  /** Une périodicité hors raccourcis bascule la puce « Autre… » (cas de l'édition). */
  protected readonly frequenceActive = computed<ChoixFrequence>(() => {
    const p = this.valeurs().periodiciteMois ?? 0;
    return (PERIODICITES_COURANTES as readonly number[]).includes(p) ? p : AUTRE;
  });

  protected readonly estEstimation = computed(() => this.valeurs().nature === 'ESTIMATION');

  /** Conversion en direct du montant saisi vers l'unité de lecture naturelle. */
  protected readonly conversion = computed<string | null>(() => {
    const v = this.valeurs();
    const montant = v.montant ?? 0;
    if (!montant) return null;
    const devise = v.devise ?? undefined;
    const p = v.periodiciteMois ?? 0;
    const f = this.t.poste.form;
    if (p === 0) return f.convPonctuel.replace('{{montant}}', this.montantPipe.transform(montant, devise));
    if (p === 1) return f.convMensuel.replace('{{montant}}', this.montantPipe.transform(montant * 12, devise));
    return f.convPeriodique.replace('{{montant}}', this.montantPipe.transform(montant / p, devise));
  });

  protected choisirFrequence(choix: ChoixFrequence | null): void {
    if (choix === null) return;
    const ctrl = this.form().get('periodiciteMois')!;
    if (choix === AUTRE) {
      // Garde la valeur courante si elle est déjà « hors raccourcis », sinon propose 2 mois.
      const actuel = (this.valeurs().periodiciteMois ?? 0) as number;
      if ((PERIODICITES_COURANTES as readonly number[]).includes(actuel)) ctrl.setValue(2);
      return;
    }
    ctrl.setValue(choix);
    ctrl.markAsDirty();
  }

  protected basculerEstimation(coche: boolean): void {
    this.form().get('nature')!.setValue(coche ? 'ESTIMATION' : 'EFFECTIF');
    this.form().get('nature')!.markAsDirty();
  }
}
