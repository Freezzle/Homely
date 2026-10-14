import { ChangeDetectionStrategy, Component, computed, inject, input } from '@angular/core';
import { FormGroup, ReactiveFormsModule } from '@angular/forms';
import { MomentPeriode, TypePoste } from '../../../../core/models/api.models';
import { I18nService } from '../../../../core/i18n/i18n.service';
import { MontantPipe } from '../../../../core/pipes/format.pipes';
import { ChoixCartesComponent } from '../../../../shared/components/choix-cartes/choix-cartes.component';
import { OptionChoix } from '../../../../shared/components/choix-cartes/option-choix.model';
import { PosteApercuPeriodiciteComponent } from '../../../../shared/components/echeancier-annuel/poste-apercu-periodicite/poste-apercu-periodicite.component';
import { PosteEcheancier } from '../../../../shared/components/echeancier-annuel/echeancier.model';
import { PosteFormValeurs, moisCourt, moisEcheance } from '../poste-form-etapes';

/**
 * Étape « Comment est-il payé ? » — n'existe que pour une périodicité au-delà du
 * mensuel. Choisit le moment de l'échéance dans le cycle, puis la façon dont le
 * budget l'impute (lissé ou en une fois).
 */
@Component({
  selector: 'app-etape-paiement',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ReactiveFormsModule, ChoixCartesComponent, PosteApercuPeriodiciteComponent],
  template: `
    <div class="flex flex-col gap-5" [formGroup]="form()">
      <app-choix-cartes
        [label]="t.poste.form.verbeQuestion[type()]"
        [options]="optionsMoment()"
        [value]="valeurs().moment ?? 'DEBUT_PERIODE'"
        (valueChange)="choisirMoment($event)"
      />

      <app-choix-cartes
        [label]="t.poste.form.dansBudget"
        [options]="optionsMode()"
        [value]="modeCourant()"
        (valueChange)="choisirMode($event)"
      />

      @if (apercu()) {
        <app-poste-apercu-periodicite
          [poste]="apercu()"
          [locale]="locale()"
          [entete]="entete()"
          [legende]="legende()"
        />
      }
    </div>
  `,
  styles: [':host { display: block; }'],
})
export class EtapePaiementComponent {
  private readonly i18n = inject(I18nService);
  private readonly montantPipe = inject(MontantPipe);
  protected readonly t = this.i18n.translations();

  readonly form = input.required<FormGroup>();
  readonly valeurs = input.required<PosteFormValeurs>();
  readonly type = input.required<TypePoste>();
  readonly locale = input.required<string>();
  readonly apercu = input<PosteEcheancier | null>(null);
  readonly entete = input<string>('');
  readonly legende = input<string>('');

  /** Le contrôle `mode` est désactivé (donc absent de `value`) quand le moment est inconnu. */
  protected readonly modeCourant = computed(() => this.valeurs().mode ?? 'MENSUALISE');

  protected readonly optionsMoment = computed<OptionChoix<MomentPeriode>[]>(() => {
    const f = this.t.poste.form;
    const debut = this.valeurs().debut ?? null;
    const p = this.valeurs().periodiciteMois ?? 0;
    const mois = (moment: MomentPeriode) =>
      debut ? f.enMois.replace('{{mois}}', moisCourt(moisEcheance(debut, p, moment), this.locale())) : undefined;
    return [
      { value: 'DEBUT_PERIODE', titre: f.momentDebut, sousTitre: mois('DEBUT_PERIODE') },
      { value: 'FIN_PERIODE', titre: f.momentFin, sousTitre: mois('FIN_PERIODE') },
      { value: 'INCONNU', titre: f.momentInconnu, sousTitre: f.dateInconnue },
    ];
  });

  protected readonly optionsMode = computed<OptionChoix<string>[]>(() => {
    const f = this.t.poste.form;
    const v = this.valeurs();
    const p = v.periodiciteMois ?? 1;
    const montant = v.montant ?? 0;
    const devise = v.devise ?? undefined;
    const debut = v.debut ?? null;
    const moment = v.moment ?? 'DEBUT_PERIODE';
    const inconnu = moment === 'INCONNU';
    return [
      {
        value: 'MENSUALISE',
        titre: f.lisse,
        sousTitre: f.lisseAide.replace('{{montant}}', this.montantPipe.transform(montant / Math.max(p, 1), devise)),
      },
      {
        value: 'PERIODIQUE',
        titre: f.moisPaiement,
        sousTitre: debut
          ? f.moisPaiementAide
              .replace('{{montant}}', this.montantPipe.transform(montant, devise))
              .replace('{{mois}}', moisCourt(moisEcheance(debut, p, moment), this.locale()))
          : undefined,
        // Une date de paiement inconnue ne laisse pas d'autre choix que le lissage.
        desactive: inconnu,
      },
    ];
  });

  protected choisirMoment(moment: MomentPeriode | null): void {
    if (!moment) return;
    this.form().get('moment')!.setValue(moment);
    this.form().get('moment')!.markAsDirty();
  }

  protected choisirMode(mode: string | null): void {
    if (!mode) return;
    const ctrl = this.form().get('mode')!;
    if (ctrl.disabled) return;
    ctrl.setValue(mode);
    ctrl.markAsDirty();
  }
}
