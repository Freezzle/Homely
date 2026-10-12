import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { TableModule } from 'primeng/table';
import { ConfirmDialogModule } from 'primeng/confirmdialog';
import { MessageService, ConfirmationService } from 'primeng/api';
import { ContexteService } from '../../../core/services/contexte.service';
import { MembreService } from '../../../core/services/referentiel.service';
import { MembreDto } from '../../../core/models/api.models';
import { I18nService } from '../../../core/i18n/i18n.service';
import { creerCrudReferentiel } from '../../../core/utils/crud-referentiel.util';
import { ButtonComponent } from '../../../shared/components/button/button.component';
import { MembreFormDialogComponent, MembreFormRequest } from './membre-form-dialog/membre-form-dialog.component';

/** T10.2 — CRUD Membres */
@Component({
  selector: 'app-membres',
  standalone: true,
  providers: [ConfirmationService],
  imports: [
    CommonModule, TableModule, ButtonComponent, ConfirmDialogModule,
    MembreFormDialogComponent,
  ],
  templateUrl: './membres.component.html',
})
export class MembresComponent {
  private readonly i18n = inject(I18nService);
  readonly t = this.i18n.translations();
  contexte = inject(ContexteService);
  private membreSvc = inject(MembreService);
  private toast = inject(MessageService);
  private confirm = inject(ConfirmationService);

  private readonly _crud = creerCrudReferentiel(this.contexte, this.membreSvc, this.toast, {
    succes: this.t.commun.succes,
    erreur: this.t.commun.erreur,
    suppressionImpossible: this.t.commun.suppressionImpossible,
  });

  membres = this._crud.items;
  chargement = this._crud.chargement;
  dialogVisible = false;
  membreEnEdition: MembreDto | null = null;

  ouvrirCreation(): void {
    this.membreEnEdition = null;
    this.dialogVisible = true;
  }

  ouvrirEdition(m: MembreDto): void {
    this.membreEnEdition = m;
    this.dialogVisible = true;
  }

  /** La popin a validé sa saisie : il ne reste qu'à persister et refermer. */
  enregistrer(req: MembreFormRequest): void {
    this._crud.enregistrer(this.membreEnEdition?.id ?? null, req, () => { this.dialogVisible = false; });
  }

  supprimer(m: MembreDto): void {
    this.confirm.confirm({
      message: this.t.commun.confirmerSuppression,
      accept: () => this._crud.supprimer(m.id),
    });
  }
}
