import { Component, inject, input, output, computed, effect } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { startWith } from 'rxjs';
import { CommonModule } from '@angular/common';
import { FormBuilder, Validators, ReactiveFormsModule } from '@angular/forms';
import { DialogModule } from 'primeng/dialog';
import { ButtonModule } from 'primeng/button';
import { InputNumberModule } from 'primeng/inputnumber';
import { DatePickerModule } from 'primeng/datepicker';
import { MessageService } from 'primeng/api';
import { MontantPipe } from '../../../core/pipes/format.pipes';
import { I18nService } from '../../../core/i18n/i18n.service';
import { ContexteService } from '../../../core/services/contexte.service';
import { PosteService } from '../../../core/services/scenario-poste.service';
import { PosteDto } from '../../../core/models/api.models';
import { toIsoDateLocal, parseIsoDateLocal } from '../../../core/utils/date.util';
import { formatPeriodeMois, formaterMontantSimple, localeCouranteDeLangue } from '../../../core/utils/format-affichage.util';

/**
 * Dialog autonome de révision de montant planifiée d'un poste. Extrait de
 * `postes-liste.component.ts` : possède son propre formulaire, ses propres calculs de
 * résumé/validation, et effectue lui-même l'appel HTTP (`PosteService.reviser`). Le
 * parent se contente d'ouvrir le dialog (en passant le poste concerné) et de rafraîchir
 * sa liste via l'output `enregistre`.
 */
@Component({
  selector: 'app-poste-revision-dialog',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, DialogModule, ButtonModule, InputNumberModule, DatePickerModule, MontantPipe],
  templateUrl: './poste-revision-dialog.component.html',
})
export class PosteRevisionDialogComponent {
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
    nouveauMontant: [0, [Validators.required, Validators.min(0.01)]],
    dateEffet: [null as Date | null, Validators.required],
  });

  private readonly _montantValue = toSignal(
    this.form.get('nouveauMontant')!.valueChanges.pipe(startWith(this.form.get('nouveauMontant')!.value)),
    { initialValue: 0 }
  );
  private readonly _dateValue = toSignal(
    this.form.get('dateEffet')!.valueChanges.pipe(startWith(this.form.get('dateEffet')!.value)),
    { initialValue: null as Date | null }
  );

  /** Réinitialise le formulaire à chaque ouverture, sur le poste courant. */
  private readonly _resetSurOuverture = effect(() => {
    const p = this.poste();
    if (this.visible() && p) {
      const debut = p.debut ? parseIsoDateLocal(p.debut) : new Date();
      this.form.reset({
        nouveauMontant: null,
        dateEffet: new Date(debut.getFullYear(), debut.getMonth() + 1, 1),
      });
    }
  });

  private localeCourante(): string {
    return localeCouranteDeLangue(this.i18n.currentLang() ?? 'fr');
  }

  /** Borne basse exclusive du datepicker : 1er jour du mois qui suit le début du poste. */
  dateMin(): Date | null {
    const p = this.poste();
    if (!p?.debut) return null;
    const [year, month] = p.debut.split('-').map(Number);
    return new Date(year, month, 1); // month (0-based) = mois suivant le début
  }

  /** Borne haute inclusive du datepicker : dernier jour du mois de fin du poste, s'il y en a une. */
  dateMax(): Date | null {
    const p = this.poste();
    if (!p?.fin) return null;
    return parseIsoDateLocal(p.fin);
  }

  /** Résumé live « 1'800 → 1'950 CHF (+8.3 %), dès janvier 2027 ». */
  resume = computed(() => {
    const p = this.poste();
    if (!p) return '';
    const avant = p.montant;
    const apres = this._montantValue() ?? 0;
    const date = this._dateValue();
    const pct = avant > 0 ? ((apres - avant) / avant) * 100 : 0;
    const signe = pct >= 0 ? '+' : '';
    return this.i18n.instant('poste.revisionResume', {
      avant: formaterMontantSimple(avant, this.localeCourante(), p.devise),
      apres: formaterMontantSimple(apres, this.localeCourante(), p.devise),
      signe,
      pct: pct.toFixed(1),
      date: date ? formatPeriodeMois(toIsoDateLocal(date), this.localeCourante()) : '–',
    });
  });

  /** Vrai si le nouveau montant saisi est strictement identique au montant actuel du poste. */
  montantIdentique = computed(() => {
    const p = this.poste();
    const montant = this._montantValue();
    if (!p || montant == null) return false;
    return montant === p.montant;
  });

  /** Bouton de validation activé seulement si montant > 0, différent du montant actuel, et date d'effet cohérente. */
  valide = computed(() => {
    const p = this.poste();
    const montant = this._montantValue();
    const date = this._dateValue();
    if (!p || !date || !(montant! > 0)) return false;
    if (montant === p.montant) return false;
    const iso = toIsoDateLocal(date);
    if (p.debut && iso <= p.debut) return false;
    if (p.fin && iso > p.fin) return false;
    return true;
  });

  fermer(): void {
    this.visibleChange.emit(false);
  }

  enregistrer(): void {
    const p = this.poste();
    if (!p || !this.valide()) return;

    const foyerId = this.contexte.foyerId()!;
    const scenarioId = this.contexte.scenarioId()!;
    const v = this.form.value;
    const req = {
      nouveauMontant: v.nouveauMontant!,
      dateEffet: toIsoDateLocal(v.dateEffet!),
    };

    this.enregistrementEnCours = true;
    this.posteSvc.reviser(foyerId, scenarioId, p.id, req).subscribe({
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
