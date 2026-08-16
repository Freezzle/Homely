import { Component, inject, input, output, computed, effect } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { startWith } from 'rxjs';
import { CommonModule } from '@angular/common';
import { FormBuilder, Validators, ReactiveFormsModule } from '@angular/forms';
import { DialogModule } from 'primeng/dialog';
import { MessageService } from 'primeng/api';
import { I18nService } from '../../../core/i18n/i18n.service';
import { ContexteService } from '../../../core/services/contexte.service';
import { PosteService } from '../../../core/services/scenario-poste.service';
import { PosteDto } from '../../../core/models/api.models';
import { toIsoDateLocal, parseIsoDateLocal } from '../../../core/utils/date.util';
import { formatPeriodeMois, formaterMontantSimple, localeCouranteDeLangue } from '../../../core/utils/format-affichage.util';
import { notifierSucces, notifierErreur } from '../../../core/utils/toast.util';
import { ButtonComponent } from '../../../shared/components/button/button.component';
import { DatePickerComponent } from '../../../shared/components/form-fields';

/**
 * Dialog autonome de décalage de la date d'effet entre un maillon (poste) et son
 * prédécesseur, dans la chaîne de révisions. Extrait de `postes-liste.component.ts` :
 * possède son propre formulaire et effectue lui-même l'appel HTTP
 * (`PosteService.decalerDateEffet`). Le prédécesseur/successeur restent résolus par le
 * parent (dépendent de `postes()`, source de vérité unique de la liste).
 */
@Component({
  selector: 'app-poste-decalage-dialog',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, DialogModule, ButtonComponent, DatePickerComponent],
  templateUrl: './poste-decalage-dialog.component.html',
})
export class PosteDecalageDialogComponent {
  readonly i18n = inject(I18nService);
  readonly t = this.i18n.translations();
  private readonly contexte = inject(ContexteService);
  private readonly posteSvc = inject(PosteService);
  private readonly toast = inject(MessageService);
  private readonly fb = inject(FormBuilder);

  readonly poste = input<PosteDto | null>(null);
  readonly precedent = input<PosteDto | null>(null);
  readonly successeur = input<PosteDto | null>(null);
  readonly visible = input<boolean>(false);

  readonly visibleChange = output<boolean>();
  readonly enregistre = output<void>();

  enregistrementEnCours = false;

  form = this.fb.group({
    nouvelleDateEffet: [null as Date | null, Validators.required],
  });

  private readonly _dateValue = toSignal(
    this.form.get('nouvelleDateEffet')!.valueChanges.pipe(startWith(this.form.get('nouvelleDateEffet')!.value)),
    { initialValue: null as Date | null }
  );

  /** Réinitialise le formulaire à chaque ouverture, sur le poste courant. */
  private readonly _resetSurOuverture = effect(() => {
    const p = this.poste();
    if (this.visible() && p) {
      this.form.reset({ nouvelleDateEffet: p.debut ? parseIsoDateLocal(p.debut) : null });
    }
  });

  private localeCourante(): string {
    return localeCouranteDeLangue(this.i18n.currentLang() ?? 'fr');
  }

  /** Borne basse exclusive : 1er jour du mois qui suit le début du prédécesseur. */
  borneMin = computed<Date | null>(() => {
    const precedent = this.precedent();
    if (!precedent?.debut) return null;
    const [year, month] = precedent.debut.split('-').map(Number);
    return new Date(year, month, 1); // month (0-based index de month) = mois suivant
  });

  /** Borne haute exclusive : 1er jour du mois de fin déjà figé par un successeur, s'il y en a un. */
  borneMax = computed<Date | null>(() => {
    const p = this.poste();
    const successeur = this.successeur();
    if (!p || !successeur || !p.fin) return null;
    const [year, month] = p.fin.split('-').map(Number);
    return new Date(year, month - 1, 1);
  });

  /** Vrai si l'intervalle de mois valides est vide (deux maillons collés sur un seul mois d'écart). */
  intervalleVide = computed(() => {
    const min = this.borneMin();
    const max = this.borneMax();
    if (!min || !max) return false;
    return min.getTime() > max.getTime();
  });

  /** Résumé live du nouveau découpage résultant. */
  resume = computed(() => {
    const p = this.poste();
    const precedent = this.precedent();
    const date = this._dateValue();
    if (!p || !precedent || !date) return '';
    const locale = this.localeCourante();
    const iso = toIsoDateLocal(date);
    const finPrecedente = new Date(date.getFullYear(), date.getMonth(), 0);
    return this.i18n.instant('poste.decalerDateEffetResume', {
      descriptionPrecedente: precedent.description,
      montantPrecedent: formaterMontantSimple(precedent.montant, locale, precedent.devise),
      finPrecedente: formatPeriodeMois(toIsoDateLocal(finPrecedente), locale),
      montantActuel: formaterMontantSimple(p.montant, locale, p.devise),
      debutActuel: formatPeriodeMois(iso, locale),
    });
  });

  /** Bouton de validation activé seulement si une date est choisie et respecte l'intervalle autorisé. */
  valide = computed(() => {
    if (this.intervalleVide()) return false;
    const date = this._dateValue();
    if (!date) return false;
    const min = this.borneMin();
    const max = this.borneMax();
    if (min && date.getTime() < min.getTime()) return false;
    if (max && date.getTime() > max.getTime()) return false;
    return true;
  });

  fermer(): void {
    this.visibleChange.emit(false);
  }

  /**
   * Enregistre le décalage de la date d'effet. En cas d'échec côté serveur (situation de
   * concurrence non anticipée côté front), le dialog reste ouvert avec un message d'erreur.
   */
  enregistrer(): void {
    const p = this.poste();
    if (!p || !this.valide()) return;

    const foyerId = this.contexte.foyerId()!;
    const scenarioId = this.contexte.scenarioId()!;
    const v = this.form.value;
    const req = { nouvelleDateEffet: toIsoDateLocal(v.nouvelleDateEffet!) };

    this.enregistrementEnCours = true;
    this.posteSvc.decalerDateEffet(foyerId, scenarioId, p.id, req).subscribe({
      next: () => {
        this.enregistrementEnCours = false;
        notifierSucces(this.toast, this.t.commun.succes);
        this.visibleChange.emit(false);
        this.enregistre.emit();
      },
      error: (err) => {
        this.enregistrementEnCours = false;
        notifierErreur(this.toast, this.t.commun.erreur, err);
      },
    });
  }
}
