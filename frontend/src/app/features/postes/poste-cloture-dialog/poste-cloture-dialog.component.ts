import { Component, inject, input, output, computed, effect } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { startWith } from 'rxjs';
import { CommonModule } from '@angular/common';
import { FormBuilder, ReactiveFormsModule } from '@angular/forms';
import { DialogModule } from 'primeng/dialog';
import { ButtonModule } from 'primeng/button';
import { DatePickerModule } from 'primeng/datepicker';
import { SelectButtonModule } from 'primeng/selectbutton';
import { MessageService } from 'primeng/api';
import { I18nService } from '../../../core/i18n/i18n.service';
import { ContexteService } from '../../../core/services/contexte.service';
import { PosteService } from '../../../core/services/scenario-poste.service';
import { PosteDto } from '../../../core/models/api.models';
import { toIsoDateLocal } from '../../../core/utils/date.util';
import { formatPeriodeMois, localeCouranteDeLangue } from '../../../core/utils/format-affichage.util';
import { finDeMois, moisEffectifCloture, prochainMoisPeriodique, posteDebuteApresMoisCourant } from '../../../core/utils/poste-periodicite.util';

/** Options de l'action rapide « Terminer » (clôture d'un poste). */
type OptionCloture = 'MOIS_COURANT' | 'PROCHAIN_PERIODIQUE' | 'PERSONNALISEE';

/**
 * Dialog autonome de clôture rapide (« Terminer ») d'un poste. Extrait de
 * `postes-liste.component.ts` : possède son propre formulaire, ses propres calculs
 * d'options/résumé/validation, et effectue lui-même l'appel HTTP (`PosteService.cloturer`).
 */
@Component({
  selector: 'app-poste-cloture-dialog',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, DialogModule, ButtonModule, DatePickerModule, SelectButtonModule],
  templateUrl: './poste-cloture-dialog.component.html',
})
export class PosteClotureDialogComponent {
  readonly i18n = inject(I18nService);
  readonly t = this.i18n.translations();
  private readonly contexte = inject(ContexteService);
  private readonly posteSvc = inject(PosteService);
  private readonly toast = inject(MessageService);
  private readonly fb = inject(FormBuilder);

  readonly poste = input<PosteDto | null>(null);
  readonly visible = input<boolean>(false);

  readonly visibleChange = output<boolean>();
  readonly enregistre = output<void>();

  enregistrementEnCours = false;

  form = this.fb.group({
    option: ['MOIS_COURANT' as OptionCloture],
    datePersonnalisee: [null as Date | null],
  });

  private readonly _optionValue = toSignal(
    this.form.get('option')!.valueChanges.pipe(startWith(this.form.get('option')!.value as OptionCloture)),
    { initialValue: 'MOIS_COURANT' as OptionCloture }
  );
  private readonly _datePersonnaliseeValue = toSignal(
    this.form.get('datePersonnalisee')!.valueChanges.pipe(startWith(this.form.get('datePersonnalisee')!.value)),
    { initialValue: null as Date | null }
  );

  /** Réinitialise le formulaire à chaque ouverture, sur le poste courant. */
  private readonly _resetSurOuverture = effect(() => {
    const p = this.poste();
    if (this.visible() && p) {
      this.form.reset({ option: 'MOIS_COURANT', datePersonnalisee: moisEffectifCloture(p) });
    }
  });

  private localeCourante(): string {
    return localeCouranteDeLangue(this.i18n.currentLang() ?? 'fr');
  }

  /** Options proposées : « prochain mois périodique » uniquement si cycle > 2 mois. */
  options = computed(() => {
    const p = this.poste();
    const labelMoisCourant = p && posteDebuteApresMoisCourant(p)
      ? this.i18n.instant('poste.clotureOptionMoisDebut', { periode: formatPeriodeMois(toIsoDateLocal(moisEffectifCloture(p)), this.localeCourante()) })
      : this.t.poste.clotureOptionMoisCourant;
    const optionsListe: { label: string; value: OptionCloture }[] = [
      { label: labelMoisCourant, value: 'MOIS_COURANT' },
    ];
    if (p && p.periodiciteMois > 2) {
      optionsListe.push({ label: this.t.poste.clotureOptionProchainPeriodique, value: 'PROCHAIN_PERIODIQUE' });
    }
    optionsListe.push({ label: this.t.poste.clotureOptionPersonnalisee, value: 'PERSONNALISEE' });
    return optionsListe;
  });

  /** Date de fin calculée selon l'option choisie (toujours le dernier jour du mois retenu). */
  fin = computed<Date | null>(() => {
    const p = this.poste();
    if (!p) return null;
    const option = this._optionValue();
    if (option === 'MOIS_COURANT') return finDeMois(moisEffectifCloture(p));
    if (option === 'PROCHAIN_PERIODIQUE') return finDeMois(prochainMoisPeriodique(p));
    const date = this._datePersonnaliseeValue();
    return date ? finDeMois(date) : null;
  });

  /** Résumé live « Le poste sera actif jusqu'en septembre 2026 ». */
  resume = computed(() => {
    const fin = this.fin();
    if (!fin) return '';
    return this.i18n.instant('poste.clotureResume', { periode: formatPeriodeMois(toIsoDateLocal(fin), this.localeCourante()) });
  });

  /** Bouton de validation activé seulement si une date de fin cohérente est déterminée. */
  valide = computed(() => {
    const p = this.poste();
    const fin = this.fin();
    if (!p || !fin) return false;
    const iso = toIsoDateLocal(fin);
    if (p.debut && iso < p.debut) return false;
    return true;
  });

  fermer(): void {
    this.visibleChange.emit(false);
  }

  enregistrer(): void {
    const p = this.poste();
    const fin = this.fin();
    if (!p || !fin || !this.valide()) return;

    const foyerId = this.contexte.foyerId()!;
    const scenarioId = this.contexte.scenarioId()!;

    this.enregistrementEnCours = true;
    this.posteSvc.cloturer(foyerId, scenarioId, p.id, { fin: toIsoDateLocal(fin) }).subscribe({
      next: () => {
        this.enregistrementEnCours = false;
        this.toast.add({ severity: 'success', summary: this.t.commun.succes });
        this.visibleChange.emit(false);
        this.enregistre.emit();
      },
      error: (err) => {
        this.enregistrementEnCours = false;
        this.toast.add({ severity: 'error', summary: this.t.commun.erreur, detail: err?.error?.message });
      },
    });
  }
}
