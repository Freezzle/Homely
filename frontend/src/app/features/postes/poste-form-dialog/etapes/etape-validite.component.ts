import { ChangeDetectionStrategy, Component, computed, inject, input } from '@angular/core';
import { FormGroup, ReactiveFormsModule } from '@angular/forms';
import { MessageModule } from 'primeng/message';
import { I18nService } from '../../../../core/i18n/i18n.service';
import { DatePickerComponent } from '../../../../shared/components/form-fields';
import { ChoixPucesComponent } from '../../../../shared/components/choix-puces/choix-puces.component';
import { OptionChoix } from '../../../../shared/components/choix-cartes/option-choix.model';
import { PosteApercuPeriodiciteComponent } from '../../../../shared/components/echeancier-annuel/poste-apercu-periodicite/poste-apercu-periodicite.component';
import { PosteEcheancier } from '../../../../shared/components/echeancier-annuel/echeancier.model';
import {
  PosteFormValeurs,
  dateLisible,
  debutDAnnee,
  finApresUnAn,
  finDeLAnnee,
  finDuCycleEnCours,
  finDuMois,
  memeJour,
  premierDuMois,
} from '../poste-form-etapes';

type RaccourciDebut = 'CE_MOIS' | 'PROCHAIN_MOIS' | 'DEBUT_ANNEE' | 'DEBUT_ANNEE_PROCHAINE';
type RaccourciFin = 'SANS_FIN' | 'UN_AN' | 'FIN_MOIS' | 'FIN_ANNEE' | 'FIN_PERIODE';

/**
 * Étape « Période de validité » : dates du contrat ou de l'accord — et non les
 * dates de paiement, qui relèvent de l'étape « Paiement ».
 *
 * Les champs date sont la saisie de référence ; les puces ne sont que des
 * raccourcis, et celle qui s'allume se déduit de la valeur du champ (une date
 * saisie à la main n'en allume donc aucune).
 */
@Component({
  selector: 'app-etape-validite',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ReactiveFormsModule, MessageModule, DatePickerComponent, ChoixPucesComponent, PosteApercuPeriodiciteComponent],
  template: `
    <div class="flex flex-col gap-5" [formGroup]="form()">
      @if (!ponctuel()) {
        <p class="aide">{{ t.poste.form.validiteAide }}</p>
      }

      <div class="flex flex-col gap-2">
        <app-date-picker
          [label]="ponctuel() ? t.poste.form.date : t.poste.form.debutPoste"
          [required]="true"
          formControlName="debut"
          dateFormat="dd/mm/yy"
        />
        <app-choix-puces
          [options]="raccourcisDebut()"
          [value]="raccourciDebutActif()"
          (valueChange)="appliquerDebut($event)"
        />
        @if (form().get('debut')!.invalid && form().get('debut')!.touched) {
          <p-message severity="error">{{ t.commun.champObligatoire }}</p-message>
        }
      </div>

      @if (!ponctuel()) {
        <div class="flex flex-col gap-2">
          <app-date-picker
            [label]="t.poste.form.finPoste"
            formControlName="fin"
            dateFormat="dd/mm/yy"
            [showClear]="true"
          />
          <app-choix-puces
            [options]="raccourcisFin()"
            [value]="raccourciFinActif()"
            (valueChange)="appliquerFin($event)"
          />
          @if (form().hasError('finAvantDebut')) {
            <p-message severity="error">{{ t.poste.finAvantDebut }}</p-message>
          }
        </div>
      }

      @if (apercuVisible() && apercu()) {
        <app-poste-apercu-periodicite
          [poste]="apercu()"
          [locale]="locale()"
          [entete]="entete()"
          [legende]="legende()"
        />
      }
    </div>
  `,
  styles: [`
    :host { display: block; }
    .aide { font-size: var(--app-text-sm); color: var(--app-ink-muted); }
  `],
})
export class EtapeValiditeComponent {
  private readonly i18n = inject(I18nService);
  protected readonly t = this.i18n.translations();

  readonly form = input.required<FormGroup>();
  readonly valeurs = input.required<PosteFormValeurs>();
  readonly locale = input.required<string>();
  /** Échéancier dérivé du formulaire, calculé par le conteneur. */
  readonly apercu = input<PosteEcheancier | null>(null);
  readonly entete = input<string>('');
  readonly legende = input<string>('');
  /** `aujourdHui` est injecté : le composant ne lit jamais l'horloge lui-même. */
  readonly aujourdHui = input.required<Date>();

  protected readonly ponctuel = computed(() => (this.valeurs().periodiciteMois ?? 0) === 0);

  /** L'aperçu n'est montré ici que s'il n'y a pas d'étape « Paiement » pour l'accueillir. */
  protected readonly apercuVisible = computed(() => (this.valeurs().periodiciteMois ?? 0) <= 1);

  // ── Raccourcis de début ───────────────────────────────────────────────

  private readonly datesDebut = computed<Record<RaccourciDebut, Date>>(() => {
    const today = this.aujourdHui();
    return {
      CE_MOIS: premierDuMois(today),
      PROCHAIN_MOIS: premierDuMois(today, 1),
      DEBUT_ANNEE: debutDAnnee(today),
      DEBUT_ANNEE_PROCHAINE: debutDAnnee(today, 1),
    };
  });

  protected readonly raccourcisDebut = computed<OptionChoix<RaccourciDebut>[]>(() => {
    const f = this.t.poste.form;
    const dates = this.datesDebut();
    const libelles: Record<RaccourciDebut, string> = {
      CE_MOIS: f.ceMois,
      PROCHAIN_MOIS: f.prochainMois,
      DEBUT_ANNEE: f.debutAnnee,
      DEBUT_ANNEE_PROCHAINE: f.debutAnneeProchaine,
    };
    return (Object.keys(libelles) as RaccourciDebut[]).map(cle => ({
      value: cle,
      titre: libelles[cle],
      sousTitre: dateLisible(dates[cle], this.locale()),
    }));
  });

  protected readonly raccourciDebutActif = computed<RaccourciDebut | null>(() => {
    const debut = this.valeurs().debut ?? null;
    if (!debut) return null;
    const dates = this.datesDebut();
    return (Object.keys(dates) as RaccourciDebut[]).find(cle => memeJour(debut, dates[cle])) ?? null;
  });

  protected appliquerDebut(cle: RaccourciDebut | null): void {
    if (!cle) return;
    const ctrl = this.form().get('debut')!;
    ctrl.setValue(this.datesDebut()[cle]);
    ctrl.markAsDirty();
  }

  // ── Raccourcis de fin ─────────────────────────────────────────────────

  /**
   * « Pendant 1 an » court depuis le début du poste ; les autres raccourcis se
   * calent sur aujourd'hui, sauf « Fin de la période » qui ferme le cycle de
   * périodicité en cours (cycles ancrés sur la date de début).
   */
  private readonly datesFin = computed<Record<RaccourciFin, Date | null>>(() => {
    const today = this.aujourdHui();
    const debut = this.valeurs().debut ?? null;
    const periodicite = this.valeurs().periodiciteMois ?? 0;
    return {
      SANS_FIN: null,
      UN_AN: debut ? finApresUnAn(debut) : null,
      FIN_MOIS: finDuMois(today),
      FIN_ANNEE: finDeLAnnee(today),
      FIN_PERIODE: debut && periodicite > 1 ? finDuCycleEnCours(debut, periodicite, today) : null,
    };
  });

  protected readonly raccourcisFin = computed<OptionChoix<RaccourciFin>[]>(() => {
    const f = this.t.poste.form;
    const dates = this.datesFin();
    const options: OptionChoix<RaccourciFin>[] = [
      { value: 'SANS_FIN', titre: f.sansFin, sousTitre: f.sansFinAide },
      { value: 'UN_AN', titre: f.unAn, sousTitre: this.sousTitreFin('UN_AN'), desactive: !dates.UN_AN },
      { value: 'FIN_MOIS', titre: f.finMois, sousTitre: this.sousTitreFin('FIN_MOIS') },
      { value: 'FIN_ANNEE', titre: f.finAnnee, sousTitre: this.sousTitreFin('FIN_ANNEE') },
    ];
    // Le cycle n'a de sens qu'au-delà du mensuel : sinon il se confond avec « Fin du mois ».
    if ((this.valeurs().periodiciteMois ?? 0) > 1) {
      options.push({
        value: 'FIN_PERIODE',
        titre: f.finPeriode,
        sousTitre: this.sousTitreFin('FIN_PERIODE'),
        desactive: !dates.FIN_PERIODE,
      });
    }
    return options;
  });

  protected readonly raccourciFinActif = computed<RaccourciFin | null>(() => {
    const fin = this.valeurs().fin ?? null;
    if (!fin) return 'SANS_FIN';
    const dates = this.datesFin();
    return (Object.keys(dates) as RaccourciFin[])
      .find(cle => cle !== 'SANS_FIN' && memeJour(fin, dates[cle])) ?? null;
  });

  protected appliquerFin(cle: RaccourciFin | null): void {
    if (!cle) return;
    const date = this.datesFin()[cle];
    if (cle !== 'SANS_FIN' && !date) return;
    const ctrl = this.form().get('fin')!;
    ctrl.setValue(cle === 'SANS_FIN' ? null : date);
    ctrl.markAsDirty();
  }

  private sousTitreFin(cle: RaccourciFin): string | undefined {
    const date = this.datesFin()[cle];
    return date ? this.t.poste.form.jusquAu.replace('{{date}}', dateLisible(date, this.locale())) : undefined;
  }
}
