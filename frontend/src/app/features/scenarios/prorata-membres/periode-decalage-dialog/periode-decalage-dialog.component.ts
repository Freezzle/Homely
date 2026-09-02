import { Component, inject, input, output, computed, effect } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { startWith } from 'rxjs';
import { switchMap } from 'rxjs/operators';
import { CommonModule } from '@angular/common';
import { FormBuilder, Validators, ReactiveFormsModule } from '@angular/forms';
import { DialogModule } from 'primeng/dialog';
import { MessageService } from 'primeng/api';
import { I18nService } from '../../../../core/i18n/i18n.service';
import { ContexteService } from '../../../../core/services/contexte.service';
import { RepartitionPeriodeService } from '../../../../core/services/scenario-poste.service';
import { RepartitionPeriodeDto } from '../../../../core/models/api.models';
import { toIsoDateLocal, parseIsoDateLocal } from '../../../../core/utils/date.util';
import { formatPeriodeMois, localeCouranteDeLangue } from '../../../../core/utils/format-affichage.util';
import { notifierSucces, notifierErreur } from '../../../../core/utils/toast.util';
import { ButtonComponent } from '../../../../shared/components/button/button.component';
import { DatePickerComponent, InputTextComponent } from '../../../../shared/components/form-fields';

/**
 * Dialog autonome de décalage de la date d'effet entre une période et son prédécesseur
 * contigu, sur le modèle de {@code PosteDecalageDialogComponent}. Le prédécesseur est
 * résolu par le parent (`ProrataMembresComponent.predecesseurDe`, dépendant de la liste
 * des périodes déjà chargée) : ce dialog se contente de déplacer la frontière entre les
 * deux, via 2 appels `modifier` (aucun endpoint dédié nécessaire).
 */
@Component({
  selector: 'app-periode-decalage-dialog',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, DialogModule, ButtonComponent, DatePickerComponent, InputTextComponent],
  templateUrl: './periode-decalage-dialog.component.html',
})
export class PeriodeDecalageDialogComponent {
  readonly i18n = inject(I18nService);
  readonly t = this.i18n.translations();
  private readonly contexte = inject(ContexteService);
  private readonly periodeSvc = inject(RepartitionPeriodeService);
  private readonly toast = inject(MessageService);
  private readonly fb = inject(FormBuilder);

  readonly periode = input<RepartitionPeriodeDto | null>(null);
  readonly predecesseur = input<RepartitionPeriodeDto | null>(null);
  readonly visible = input<boolean>(false);

  readonly visibleChange = output<boolean>();
  readonly enregistre = output<void>();

  enregistrementEnCours = false;

  form = this.fb.group({
    dateDebutActuelle: [{ value: '', disabled: true }],
    nouvelleDateEffet: [null as Date | null, Validators.required],
  });

  private readonly _dateValue = toSignal(
    this.form.get('nouvelleDateEffet')!.valueChanges.pipe(startWith(this.form.get('nouvelleDateEffet')!.value)),
    { initialValue: null as Date | null }
  );

  /** Réinitialise le formulaire à chaque ouverture, sur la période courante. */
  private readonly _resetSurOuverture = effect(() => {
    const p = this.periode();
    if (this.visible() && p) {
      this.form.reset({
        dateDebutActuelle: p.debut ? formatPeriodeMois(p.debut, this.localeCourante()) : '',
        nouvelleDateEffet: p.debut ? parseIsoDateLocal(p.debut) : null,
      });
    }
  });

  private localeCourante(): string {
    return localeCouranteDeLangue(this.i18n.currentLang() ?? 'fr');
  }

  /** Borne basse inclusive : 1er jour du mois qui suit le début du prédécesseur. */
  borneMin = computed<Date | null>(() => {
    const precedent = this.predecesseur();
    if (!precedent?.debut) return null;
    const [year, month] = precedent.debut.split('-').map(Number);
    return new Date(year, month, 1);
  });

  /** Borne haute inclusive : 1er jour du mois de fin de la période courante, si elle en a une. */
  borneMax = computed<Date | null>(() => {
    const p = this.periode();
    if (!p?.fin) return null;
    const [year, month] = p.fin.split('-').map(Number);
    return new Date(year, month - 1, 1);
  });

  /** Vrai si l'intervalle de mois valides est vide (deux périodes collées sur un seul mois d'écart). */
  intervalleVide = computed(() => {
    const min = this.borneMin();
    const max = this.borneMax();
    if (!min || !max) return false;
    return min.getTime() > max.getTime();
  });

  /** Résumé live de la nouvelle frontière. */
  resume = computed(() => {
    const p = this.periode();
    const date = this._dateValue();
    if (!p || !date) return '';
    const locale = this.localeCourante();
    return this.i18n.instant('prorata.decalerDateEffetResume', {
      debutActuel: p.debut ? formatPeriodeMois(p.debut, locale) : '–',
      nouvelleDate: formatPeriodeMois(toIsoDateLocal(date), locale),
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

  enregistrer(): void {
    const p = this.periode();
    const precedent = this.predecesseur();
    if (!p || !precedent || !this.valide()) return;

    const foyerId = this.contexte.foyerId()!;
    const scenarioId = this.contexte.scenarioId()!;
    const nouvelleDate = this.form.value.nouvelleDateEffet!;
    const veille = new Date(nouvelleDate.getFullYear(), nouvelleDate.getMonth(), nouvelleDate.getDate() - 1);

    const precedentReq = {
      debut: precedent.debut,
      fin: toIsoDateLocal(veille),
      parts: precedent.parts.map(pp => ({ membreId: pp.membreId, quotePart: pp.quotePart })),
    };
    const actuelReq = {
      debut: toIsoDateLocal(nouvelleDate),
      fin: p.fin,
      parts: p.parts.map(pp => ({ membreId: pp.membreId, quotePart: pp.quotePart })),
    };

    this.enregistrementEnCours = true;
    this.periodeSvc.modifier(foyerId, scenarioId, precedent.id, precedentReq).pipe(
      switchMap(() => this.periodeSvc.modifier(foyerId, scenarioId, p.id, actuelReq)),
    ).subscribe({
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
