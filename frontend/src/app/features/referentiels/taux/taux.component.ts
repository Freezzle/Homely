import { Component, inject, computed, Signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { TableModule } from 'primeng/table';
import { ConfirmDialogModule } from 'primeng/confirmdialog';
import { MessageService, ConfirmationService } from 'primeng/api';
import { ContexteService } from '../../../core/services/contexte.service';
import { TauxChangeService } from '../../../core/services/referentiel.service';
import { TauxChangeDto } from '../../../core/models/api.models';
import { I18nService } from '../../../core/i18n/i18n.service';
import { creerChargementReactif } from '../../../core/utils/reference-data.util';
import { notifierSucces, notifierErreur } from '../../../core/utils/toast.util';
import { ButtonComponent } from '../../../shared/components/button/button.component';
import { TagComponent } from '../../../shared/components/tag/tag.component';
import { TauxFormDialogComponent, TauxChangeFormRequest } from './taux-form-dialog/taux-form-dialog.component';

/** T10.2 — Taux de change (CRUD upsert) */
@Component({
  selector: 'app-taux',
  standalone: true,
  providers: [ConfirmationService],
  imports: [
    CommonModule, TableModule, ButtonComponent, TagComponent,
    ConfirmDialogModule, TauxFormDialogComponent,
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

  dialogVisible = false;
  tauxEnEdition: TauxChangeDto | null = null;

  /** Taux de change du foyer courant — chargement réactif annulant toute requête obsolète (voir `creerChargementReactif`). */
  private readonly _refData = creerChargementReactif(this.contexte.foyerId, foyerId => this.tauxSvc.lister(foyerId));

  taux: Signal<TauxChangeDto[]> = computed(() => this._refData.donnees() ?? []);
  chargement: Signal<boolean> = this._refData.chargement;

  charger(): void {
    this._refData.recharger();
  }

  ouvrirCreation(): void {
    this.tauxEnEdition = null;
    this.dialogVisible = true;
  }

  ouvrirEdition(tx: TauxChangeDto): void {
    this.tauxEnEdition = tx;
    this.dialogVisible = true;
  }

  /** La popin a validé sa saisie : il ne reste qu'à persister et refermer. */
  enregistrer(req: TauxChangeFormRequest): void {
    const foyerId = this.contexte.foyerId()!;
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

