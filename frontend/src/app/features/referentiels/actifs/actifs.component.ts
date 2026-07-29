import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, Validators, ReactiveFormsModule } from '@angular/forms';
import { TableModule } from 'primeng/table';
import { ButtonModule } from 'primeng/button';
import { DialogModule } from 'primeng/dialog';
import { InputTextModule } from 'primeng/inputtext';
import { InputNumberModule } from 'primeng/inputnumber';
import { SelectModule } from 'primeng/select';
import { TagModule } from 'primeng/tag';
import { ConfirmDialogModule } from 'primeng/confirmdialog';
import { MessageService, ConfirmationService } from 'primeng/api';
import { ContexteService } from '../../../core/services/contexte.service';
import { ActifService, TauxChangeService } from '../../../core/services/referentiel.service';
import { ActifDto, TypeActif } from '../../../core/models/api.models';
import { MontantPipe, PctPipe } from '../../../core/pipes/format.pipes';
import { I18nService } from '../../../core/i18n/i18n.service';
import { creerDevisesDisponibles } from '../../../core/utils/devise-options.util';
import { creerCrudReferentiel } from '../../../core/utils/crud-referentiel.util';

/** T10.2 — CRUD Actifs patrimoniaux */
@Component({
  selector: 'app-actifs',
  standalone: true,
  providers: [ConfirmationService],
  imports: [
    CommonModule, ReactiveFormsModule,
    TableModule, ButtonModule, DialogModule, TagModule,
    InputTextModule, InputNumberModule, SelectModule,
    ConfirmDialogModule, MontantPipe, PctPipe,
  ],
  templateUrl: './actifs.component.html',
})
export class ActifsComponent {
  private readonly i18n = inject(I18nService);
  readonly t = this.i18n.translations();
  contexte = inject(ContexteService);
  private actifSvc = inject(ActifService);
  private tauxChangeSvc = inject(TauxChangeService);
  private toast = inject(MessageService);
  private confirm = inject(ConfirmationService);
  private fb = inject(FormBuilder);

  private readonly _crud = creerCrudReferentiel(this.contexte, this.actifSvc, this.toast, {
    succes: this.t.commun.succes,
    erreur: this.t.commun.erreur,
    suppressionImpossible: this.t.commun.suppressionImpossible,
  });

  actifs = this._crud.items;
  chargement = this._crud.chargement;
  dialogVisible = false;
  actifEnEdition: ActifDto | null = null;

  typeOptions: { label: string; value: TypeActif }[] = [
    { label: this.t.referentiels.actif.types.COMPTE_EPARGNE,   value: 'COMPTE_EPARGNE' },
    { label: this.t.referentiels.actif.types.TROISIEME_PILIER, value: 'TROISIEME_PILIER' },
    { label: this.t.referentiels.actif.types.INVESTISSEMENT,   value: 'INVESTISSEMENT' },
    { label: this.t.referentiels.actif.types.CRYPTO,           value: 'CRYPTO' },
    { label: this.t.referentiels.actif.types.IMMOBILIER,       value: 'IMMOBILIER' },
    { label: this.t.referentiels.actif.types.VEHICULE,         value: 'VEHICULE' },
    { label: this.t.referentiels.actif.types.AUTRE,            value: 'AUTRE' },
  ];
  form = this.fb.group({
    libelle: ['', Validators.required],
    typeActif: ['AUTRE' as TypeActif, Validators.required],
    soldeInitial: [0],
    devise: [this.contexte.deviseBase()],
    tauxCroissanceAnnuel: [0],
  });

  private readonly _devises = creerDevisesDisponibles(this.contexte, this.tauxChangeSvc, this.form.get('devise'));

  devisesOptions(): string[] {
    return this._devises();
  }

  typeActifLabel(type: TypeActif): string {
    return this.t.referentiels.actif.types[type] ?? type;
  }

  ouvrirCreation(): void {
    this.actifEnEdition = null;
    this.form.reset({ libelle: '', typeActif: 'AUTRE', soldeInitial: 0, devise: this.contexte.deviseBase(), tauxCroissanceAnnuel: 0 });
    this.dialogVisible = true;
  }

  ouvrirEdition(a: ActifDto): void {
    this.actifEnEdition = a;
    this.form.patchValue({ libelle: a.libelle, typeActif: a.typeActif, soldeInitial: a.soldeInitial, devise: a.devise, tauxCroissanceAnnuel: a.tauxCroissanceAnnuel * 100 });
    this.dialogVisible = true;
  }

  enregistrer(): void {
    const v = this.form.value;
    const req = {
      libelle: v.libelle!, typeActif: v.typeActif as TypeActif,
      soldeInitial: v.soldeInitial ?? 0,
      devise: v.devise ?? undefined,
      tauxCroissanceAnnuel: (v.tauxCroissanceAnnuel ?? 0) / 100,
    };
    this._crud.enregistrer(this.actifEnEdition?.id ?? null, req, () => { this.dialogVisible = false; });
  }

  supprimer(a: ActifDto): void {
    this.confirm.confirm({
      message: this.t.commun.confirmerSuppression,
      accept: () => this._crud.supprimer(a.id),
    });
  }
}
