import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, Validators, ReactiveFormsModule } from '@angular/forms';
import { TableModule } from 'primeng/table';
import { ButtonModule } from 'primeng/button';
import { DialogModule } from 'primeng/dialog';
import { InputTextModule } from 'primeng/inputtext';
import { InputNumberModule } from 'primeng/inputnumber';
import { ColorPickerModule } from 'primeng/colorpicker';
import { ConfirmDialogModule } from 'primeng/confirmdialog';
import { MessageService, ConfirmationService } from 'primeng/api';
import { ContexteService } from '../../../core/services/contexte.service';
import { MembreService } from '../../../core/services/referentiel.service';
import { MembreDto } from '../../../core/models/api.models';
import { I18nService } from '../../../core/i18n/i18n.service';
import { creerCrudReferentiel } from '../../../core/utils/crud-referentiel.util';

/** T10.2 — CRUD Membres */
@Component({
  selector: 'app-membres',
  standalone: true,
  providers: [ConfirmationService],
  imports: [
    CommonModule, ReactiveFormsModule,
    TableModule, ButtonModule, DialogModule,
    InputTextModule, InputNumberModule, ColorPickerModule,
    ConfirmDialogModule,
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
  private fb = inject(FormBuilder);

  private readonly _crud = creerCrudReferentiel(this.contexte, this.membreSvc, this.toast, {
    succes: this.t.commun.succes,
    erreur: this.t.commun.erreur,
    suppressionImpossible: this.t.commun.suppressionImpossible,
  });

  membres = this._crud.items;
  chargement = this._crud.chargement;
  dialogVisible = false;
  membreEnEdition: MembreDto | null = null;

  form = this.fb.group({
    nom: ['', Validators.required],
    couleur: ['#6366f1'],
  });

  ouvrirCreation(): void {
    this.membreEnEdition = null;
    this.form.reset({ nom: '', couleur: '#6366f1' });
    this.dialogVisible = true;
  }

  ouvrirEdition(m: MembreDto): void {
    this.membreEnEdition = m;
    this.form.patchValue({ nom: m.nom, couleur: m.couleur });
    this.dialogVisible = true;
  }

  enregistrer(): void {
    const v = this.form.value;
    // p-colorpicker format hex retourne parfois sans '#' → normalisation défensive
    const raw = v.couleur ?? '6366f1';
    const couleur = raw.startsWith('#') ? raw : '#' + raw;
    const req = { nom: v.nom!, couleur };
    this._crud.enregistrer(this.membreEnEdition?.id ?? null, req, () => { this.dialogVisible = false; });
  }

  supprimer(m: MembreDto): void {
    this.confirm.confirm({
      message: this.t.commun.confirmerSuppression,
      accept: () => this._crud.supprimer(m.id),
    });
  }
}
