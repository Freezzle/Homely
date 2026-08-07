import { Component, inject, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, Validators, ReactiveFormsModule } from '@angular/forms';
import { CardModule } from 'primeng/card';
import { ButtonModule } from 'primeng/button';
import { DialogModule } from 'primeng/dialog';
import { ProgressBarModule } from 'primeng/progressbar';
import { SkeletonModule } from 'primeng/skeleton';
import { ConfirmDialogModule } from 'primeng/confirmdialog';
import { TagModule } from 'primeng/tag';
import { AvatarModule } from 'primeng/avatar';
import { AvatarGroupModule } from 'primeng/avatargroup';
import { TooltipModule } from 'primeng/tooltip';
import { MessageModule } from 'primeng/message';
import { MessageService, ConfirmationService } from 'primeng/api';
import { forkJoin } from 'rxjs';
import { ContexteService } from '../../core/services/contexte.service';
import { ObjectifService } from '../../core/services/scenario-poste.service';
import { CompteService, CategorieService } from '../../core/services/referentiel.service';
import { ObjectifDto } from '../../core/models/api.models';
import { MontantPipe, DateFrPipe } from '../../core/pipes/format.pipes';
import { I18nService } from '../../core/i18n/i18n.service';
import { toIsoDateLocal, parseIsoDateLocal } from '../../core/utils/date.util';
import { creerCrudReferentielScenario } from '../../core/utils/crud-referentiel.util';
import { creerChargementReactif } from '../../core/utils/reference-data.util';
import {
  DatePickerComponent,
  InputNumberComponent,
  InputTextComponent,
  SelectComponent,
} from '../../shared/components/form-fields';

type StatutObjectif = 'DANS_LES_TEMPS' | 'EN_RETARD' | 'ATTEINT';

/** T10.7 — Écran Objectifs */
@Component({
  selector: 'app-objectifs',
  standalone: true,
  providers: [ConfirmationService],
  imports: [
    CommonModule, ReactiveFormsModule,
    CardModule, ButtonModule, DialogModule, TagModule,
    ProgressBarModule, SkeletonModule, ConfirmDialogModule,
    AvatarModule, AvatarGroupModule, TooltipModule, MessageModule,
    InputTextComponent, InputNumberComponent, DatePickerComponent, SelectComponent,
    MontantPipe, DateFrPipe,
  ],
  templateUrl: './objectifs.component.html',
})
export class ObjectifsComponent {
  private readonly i18n = inject(I18nService);
  readonly t = this.i18n.translations();
  contexte = inject(ContexteService);
  private objectifSvc = inject(ObjectifService);
  private compteSvc = inject(CompteService);
  private categorieSvc = inject(CategorieService);
  private toast = inject(MessageService);
  private confirm = inject(ConfirmationService);
  private fb = inject(FormBuilder);

  private readonly _crud = creerCrudReferentielScenario(this.contexte, this.objectifSvc, this.toast, {
    succes: this.t.commun.succes,
    erreur: this.t.commun.erreur,
    suppressionImpossible: this.t.commun.erreur,
  });

  objectifs = this._crud.items;
  chargement = this._crud.chargement;
  dialogVisible = false;
  objectifEnEdition: ObjectifDto | null = null;

  readonly membres = this.contexte.membres;

  form = this.fb.group({
    libelle: ['', Validators.required],
    montantCible: [0, [Validators.required, Validators.min(0.01)]],
    echeance: [null as Date | null],
    compteId: [null as string | null, Validators.required],
  });

  /** Comptes/catégories du foyer courant, utilisés pour rattacher un objectif à un compte. */
  private readonly _refData = creerChargementReactif(this.contexte.foyerId, foyerId =>
    forkJoin([this.compteSvc.lister(foyerId), this.categorieSvc.lister(foyerId)]),
  );

  comptes = computed(() => this._refData.donnees()?.[0] ?? []);
  categories = computed(() => this._refData.donnees()?.[1] ?? []);

  charger(): void {
    this._crud.charger();
  }

  private initiales(nom: string): string {
    return nom.trim().split(/\s+/).map(mot => mot[0]).slice(0, 2).join('').toUpperCase();
  }

  private statut(o: ObjectifDto): StatutObjectif {
    if (o.progression >= 1) return 'ATTEINT';
    if (o.echeance && parseIsoDateLocal(o.echeance) < new Date()) return 'EN_RETARD';
    return 'DANS_LES_TEMPS';
  }

  /** Cartes objectifs enrichies : statut, libellés, membres attachés (via le compte lié). */
  objectifsData = computed(() => {
    const cptes = this.comptes();
    const cats = this.categories();
    const mems = this.membres();
    return this.objectifs().map(o => {
      const compte = o.compteId ? cptes.find(c => c.id === o.compteId) : undefined;
      const membresAttaches = compte
        ? mems.filter(m => compte.membreIds?.includes(m.id)).map(m => ({ id: m.id, nom: m.nom, couleur: m.couleur, initiales: this.initiales(m.nom) }))
        : [];
      return {
        ...o,
        statut: this.statut(o),
        compteLibelle: compte?.libelle,
        categorieLibelle: o.categorieProjetId ? cats.find(c => c.id === o.categorieProjetId)?.libelle ?? '' : '',
        membresAttaches,
      };
    });
  });

  ouvrirCreation(): void {
    this.objectifEnEdition = null;
    this.form.reset({ libelle: '', montantCible: 0, echeance: null, compteId: null });
    this.dialogVisible = true;
  }

  ouvrirEdition(o: ObjectifDto): void {
    this.objectifEnEdition = o;
    this.form.patchValue({
      libelle: o.libelle,
      montantCible: o.montantCible,
      echeance: o.echeance ? parseIsoDateLocal(o.echeance) : null,
      compteId: o.compteId ?? null,
    });
    this.dialogVisible = true;
  }

  enregistrer(): void {
    const v = this.form.value;
    const req = {
      libelle: v.libelle!,
      montantCible: v.montantCible!,
      echeance: v.echeance ? toIsoDateLocal(v.echeance as Date) : undefined,
      compteId: v.compteId!,
    };
    this._crud.enregistrer(this.objectifEnEdition?.id ?? null, req, () => { this.dialogVisible = false; });
  }

  supprimer(o: ObjectifDto): void {
    this.confirm.confirm({
      message: this.t.commun.confirmerSuppression,
      accept: () => this._crud.supprimer(o.id),
    });
  }


  /** Boutons d'action des cartes objectifs — visuels uniquement pour l'instant. */
  actionAVenir(): void {
    this.toast.add({ severity: 'info', summary: this.t.objectif.actionAVenir });
  }
}
