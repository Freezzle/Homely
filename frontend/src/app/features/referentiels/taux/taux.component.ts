import { Component, inject, computed, Signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, Validators, ReactiveFormsModule } from '@angular/forms';
import { TableModule } from 'primeng/table';
import { DialogModule } from 'primeng/dialog';
import { ConfirmDialogModule } from 'primeng/confirmdialog';
import { MessageService, ConfirmationService } from 'primeng/api';
import { ContexteService } from '../../../core/services/contexte.service';
import { TauxChangeService } from '../../../core/services/referentiel.service';
import { TauxChangeDto } from '../../../core/models/api.models';
import { I18nService } from '../../../core/i18n/i18n.service';
import { creerChargementReactif } from '../../../core/utils/reference-data.util';
import { notifierSucces, notifierErreur } from '../../../core/utils/toast.util';
import { ButtonComponent } from '../../../shared/components/button/button.component';
import { InputNumberComponent, InputTextComponent } from '../../../shared/components/form-fields';
import { TagComponent } from '../../../shared/components/tag/tag.component';

/** T10.2 — Taux de change (CRUD upsert) */
@Component({
  selector: 'app-taux',
  standalone: true,
  providers: [ConfirmationService],
  imports: [
    CommonModule, ReactiveFormsModule,
    TableModule, ButtonComponent, DialogModule, TagComponent,
    InputTextComponent, InputNumberComponent,
    ConfirmDialogModule,
  ],
  templateUrl: './taux.component.html',
})
export class TauxComponent {
  private readonly i18n = inject(I18nService);
  readonly t = this.i18n.translations();
  contexte = inject(ContexteService);
  private tauxSvc = inject(TauxChangeService);
  private toast = inject(MessageService);
  private confirm = inject(ConfirmationService);
  private fb = inject(FormBuilder);

  dialogVisible = false;
  tauxEnEdition: TauxChangeDto | null = null;

  form = this.fb.group({
    devise: ['', [Validators.required, Validators.pattern(/^[A-Za-z]{3}$/)]],
    tauxVersBase: [1, [Validators.required, Validators.min(0.000001)]],
  });

  /** Taux de change du foyer courant — chargement réactif annulant toute requête obsolète (voir `creerChargementReactif`). */
  private readonly _refData = creerChargementReactif(this.contexte.foyerId, foyerId => this.tauxSvc.lister(foyerId));

  taux: Signal<TauxChangeDto[]> = computed(() => this._refData.donnees() ?? []);
  chargement: Signal<boolean> = this._refData.chargement;

  /**
   * Le taux de la devise de base du foyer vers elle-même vaut toujours 1 par
   * définition — il ne doit pas pouvoir être modifié (docs/01 §7).
   * On verrouille le champ dès que la devise saisie correspond à `deviseBase`.
   */
  private readonly _verrouillerTauxBaseSub = this.form.get('devise')!.valueChanges.subscribe(devise => {
    this.appliquerVerrouTauxBase(devise);
  });

  private appliquerVerrouTauxBase(devise: string | null | undefined): void {
    const tauxCtrl = this.form.get('tauxVersBase')!;
    if ((devise ?? '').trim().toUpperCase() === this.contexte.deviseBase()) {
      tauxCtrl.setValue(1, { emitEvent: false });
      tauxCtrl.disable({ emitEvent: false });
    } else if (tauxCtrl.disabled) {
      tauxCtrl.enable({ emitEvent: false });
    }
  }

  egaliteTauxVersBase(): string {
    return this.i18n.instant('referentiels.taux.egaliteTauxVersBase', {
      devise: (this.form.value.devise || '?').toUpperCase(),
      deviseBase: this.contexte.deviseBase(),
    });
  }

  charger(): void {
    this._refData.recharger();
  }

  ouvrirCreation(): void {
    this.tauxEnEdition = null;
    this.form.reset({ devise: '', tauxVersBase: 1 });
    this.form.get('devise')?.enable();
    this.appliquerVerrouTauxBase('');
    this.dialogVisible = true;
  }

  ouvrirEdition(tx: TauxChangeDto): void {
    this.tauxEnEdition = tx;
    this.form.patchValue({ devise: tx.devise, tauxVersBase: tx.tauxVersBase });
    this.appliquerVerrouTauxBase(tx.devise);
    this.dialogVisible = true;
  }

  enregistrer(): void {
    const foyerId = this.contexte.foyerId()!;
    const v = this.form.getRawValue();
    const devise = v.devise!.toUpperCase();
    // Garde-fou : le taux de la devise de base vers elle-même est toujours 1,
    // même si le contrôle a été réactivé par erreur (ex. patch programmatique).
    const tauxVersBase = devise === this.contexte.deviseBase() ? 1 : v.tauxVersBase!;
    const req = { devise, tauxVersBase };
    this.tauxSvc.creerOuModifier(foyerId, req).subscribe({
      next: () => { notifierSucces(this.toast, this.t.commun.succes); this.dialogVisible = false; this.charger(); },
      error: (e) => notifierErreur(this.toast, this.t.commun.erreur, e),
    });
  }

  supprimer(tx: TauxChangeDto): void {
    this.confirm.confirm({
      message: this.t.commun.confirmerSuppression,
      accept: () => this.tauxSvc.supprimer(this.contexte.foyerId()!, tx.id).subscribe({
        next: () => { notifierSucces(this.toast, this.t.commun.succes); this.charger(); },
        error: (err) => notifierErreur(this.toast, this.t.commun.erreur, err),
      }),
    });
  }
}

