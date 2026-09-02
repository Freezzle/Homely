import { Component, inject, input, output, computed, effect } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { startWith } from 'rxjs';
import { switchMap } from 'rxjs/operators';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormArray, Validators, ReactiveFormsModule } from '@angular/forms';
import { DialogModule } from 'primeng/dialog';
import { MessageModule } from 'primeng/message';
import { MessageService } from 'primeng/api';
import { I18nService } from '../../../../core/i18n/i18n.service';
import { ContexteService } from '../../../../core/services/contexte.service';
import { RepartitionPeriodeService } from '../../../../core/services/scenario-poste.service';
import { RepartitionPeriodeDto, MembreDto } from '../../../../core/models/api.models';
import { toIsoDateLocal, parseIsoDateLocal } from '../../../../core/utils/date.util';
import { formatPeriodeMois, localeCouranteDeLangue } from '../../../../core/utils/format-affichage.util';
import { notifierSucces, notifierErreur } from '../../../../core/utils/toast.util';
import { ButtonComponent } from '../../../../shared/components/button/button.component';
import { DatePickerComponent, InputNumberComponent } from '../../../../shared/components/form-fields';

/**
 * Dialog autonome de révision des taux de répartition (prorata) d'une période, sur le
 * modèle de {@code PosteRevisionDialogComponent}. `RepartitionPeriode` n'a pas de
 * notion de chaîne explicite (pas de `posteOrigineId`/`posteSuivantId`) : la révision
 * ferme simplement la période courante à la veille de la date d'effet et en crée une
 * nouvelle avec les nouveaux taux, via les 2 appels CRUD déjà existants (aucun endpoint
 * dédié nécessaire).
 */
@Component({
  selector: 'app-periode-revision-dialog',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, DialogModule, MessageModule, ButtonComponent, InputNumberComponent, DatePickerComponent],
  templateUrl: './periode-revision-dialog.component.html',
})
export class PeriodeRevisionDialogComponent {
  readonly i18n = inject(I18nService);
  readonly t = this.i18n.translations();
  private readonly contexte = inject(ContexteService);
  private readonly periodeSvc = inject(RepartitionPeriodeService);
  private readonly toast = inject(MessageService);
  private readonly fb = inject(FormBuilder);

  readonly periode = input<RepartitionPeriodeDto | null>(null);
  readonly membres = input<MembreDto[]>([]);
  readonly visible = input<boolean>(false);

  readonly visibleChange = output<boolean>();
  readonly enregistre = output<void>();

  enregistrementEnCours = false;
  sommeParts = 0;

  form = this.fb.group({
    dateEffet: [null as Date | null, Validators.required],
    parts: this.fb.array([] as any[]),
  });

  get partsArray() { return this.form.get('parts') as FormArray; }

  private readonly _dateValue = toSignal(
    this.form.get('dateEffet')!.valueChanges.pipe(startWith(this.form.get('dateEffet')!.value)),
    { initialValue: null as Date | null }
  );

  constructor() {
    this.partsArray.valueChanges.subscribe(() => this.calculerSomme());
  }

  /** Réinitialise le formulaire à chaque ouverture, sur la période courante. */
  private readonly _resetSurOuverture = effect(() => {
    const p = this.periode();
    if (this.visible() && p) {
      const debut = p.debut ? parseIsoDateLocal(p.debut) : new Date();
      this.form.reset({ dateEffet: new Date(debut.getFullYear(), debut.getMonth() + 1, 1) });
      this.initialiserParts();
    }
  });

  private initialiserParts(): void {
    const membres = this.membres();
    const p = this.periode();
    while (this.partsArray.length > membres.length) this.partsArray.removeAt(this.partsArray.length - 1);
    membres.forEach((m, i) => {
      const existante = p?.parts.find(pp => pp.membreId === m.id);
      const quotePart = existante ? Math.round(existante.quotePart * 10000) / 100 : 0;
      if (i < this.partsArray.length) {
        this.partsArray.at(i).patchValue({ membreId: m.id, quotePart });
      } else {
        this.partsArray.push(this.fb.group({ membreId: [m.id], quotePart: [quotePart] }));
      }
    });
    this.calculerSomme();
  }

  calculerSomme(): void {
    const total = this.partsArray.controls.reduce((s, c) => s + (c.get('quotePart')?.value ?? 0), 0);
    this.sommeParts = Math.round(total * 100) / 100;
  }

  /** Tolérance flottante : une somme visuellement à 100% ne doit jamais être refusée à tort. */
  get sommePartsValide(): boolean {
    return Math.abs(this.sommeParts - 100) < 0.01;
  }

  private localeCourante(): string {
    return localeCouranteDeLangue(this.i18n.currentLang() ?? 'fr');
  }

  /** Borne basse inclusive : 1er jour du mois qui suit le début de la période. */
  dateMin(): Date | null {
    const p = this.periode();
    if (!p?.debut) return null;
    const [year, month] = p.debut.split('-').map(Number);
    return new Date(year, month, 1);
  }

  /** Borne haute inclusive : 1er jour du mois de fin de la période, si elle en a une. */
  dateMax(): Date | null {
    const p = this.periode();
    if (!p?.fin) return null;
    const [year, month] = p.fin.split('-').map(Number);
    return new Date(year, month - 1, 1);
  }

  /** Résumé live « Jean · 50%, Marie · 50% → Jean · 60%, Marie · 40%, dès janvier 2027 ». */
  resume = computed(() => {
    const p = this.periode();
    const date = this._dateValue();
    if (!p) return '';
    const avant = p.parts.map(pp => `${pp.nomMembre} · ${Math.round(pp.quotePart * 10000) / 100}%`).join(', ');
    const apres = this.partsArray.controls
      .map(c => `${this.membres().find(m => m.id === c.get('membreId')!.value)?.nom ?? ''} · ${c.get('quotePart')!.value ?? 0}%`)
      .join(', ');
    return this.i18n.instant('prorata.revisionResume', {
      avant, apres,
      date: date ? formatPeriodeMois(toIsoDateLocal(date), this.localeCourante()) : '–',
    });
  });

  /** Bouton de validation activé seulement si somme = 100% et date d'effet cohérente. */
  valide = computed(() => {
    const p = this.periode();
    const date = this._dateValue();
    if (!p || !date || !this.sommePartsValide) return false;
    const iso = toIsoDateLocal(date);
    if (p.debut && iso <= p.debut) return false;
    if (p.fin && iso > p.fin) return false;
    return true;
  });

  fermer(): void {
    this.visibleChange.emit(false);
  }

  enregistrer(): void {
    const p = this.periode();
    if (!p || !this.valide()) return;

    const foyerId = this.contexte.foyerId()!;
    const scenarioId = this.contexte.scenarioId()!;
    const dateEffet = this.form.value.dateEffet!;
    const veille = new Date(dateEffet.getFullYear(), dateEffet.getMonth(), dateEffet.getDate() - 1);

    const fermetureReq = {
      debut: p.debut,
      fin: toIsoDateLocal(veille),
      parts: p.parts.map(pp => ({ membreId: pp.membreId, quotePart: pp.quotePart })),
    };
    const nouvelleReq = {
      debut: toIsoDateLocal(dateEffet),
      fin: p.fin,
      parts: this.partsArray.controls.map(c => ({
        membreId: c.get('membreId')!.value,
        quotePart: Math.round((c.get('quotePart')!.value ?? 0) * 100) / 10000,
      })),
    };

    this.enregistrementEnCours = true;
    this.periodeSvc.modifier(foyerId, scenarioId, p.id, fermetureReq).pipe(
      switchMap(() => this.periodeSvc.creer(foyerId, scenarioId, nouvelleReq)),
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
