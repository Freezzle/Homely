import { Component, inject, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, Validators, ReactiveFormsModule, AbstractControl, ValidationErrors } from '@angular/forms';
import { CardModule } from 'primeng/card';
import { ButtonModule } from 'primeng/button';
import { DialogModule } from 'primeng/dialog';
import { InputTextModule } from 'primeng/inputtext';
import { InputNumberModule } from 'primeng/inputnumber';
import { SelectModule } from 'primeng/select';
import { DatePickerModule } from 'primeng/datepicker';
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
import { CompteService, ActifService, CategorieService } from '../../core/services/referentiel.service';
import { ObjectifDto } from '../../core/models/api.models';
import { MontantPipe, DateFrPipe } from '../../core/pipes/format.pipes';
import { I18nService } from '../../core/i18n/i18n.service';
import { toIsoDateLocal, parseIsoDateLocal } from '../../core/utils/date.util';
import { creerCrudReferentielScenario } from '../../core/utils/crud-referentiel.util';
import { creerChargementReactif } from '../../core/utils/reference-data.util';

type StatutObjectif = 'DANS_LES_TEMPS' | 'EN_RETARD' | 'ATTEINT';

/** T10.7 — Écran Objectifs */
@Component({
  selector: 'app-objectifs',
  standalone: true,
  providers: [ConfirmationService],
  imports: [
    CommonModule, ReactiveFormsModule,
    CardModule, ButtonModule, DialogModule, TagModule,
    InputTextModule, InputNumberModule, SelectModule, DatePickerModule,
    ProgressBarModule, SkeletonModule, ConfirmDialogModule,
    AvatarModule, AvatarGroupModule, TooltipModule, MessageModule,
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
  private actifSvc = inject(ActifService);
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

  /**
   * Un objectif doit être rattaché à exactement un support : un compte OU un actif
   * (jamais les deux, jamais aucun) — docs/02 §4 "compte_id XOR actif_id".
   */
  private static readonly supportXorValidator = (group: AbstractControl): ValidationErrors | null => {
    const compteId = group.get('compteId')?.value;
    const actifId = group.get('actifId')?.value;
    return (!!compteId) !== (!!actifId) ? null : { supportXor: true };
  };

  form = this.fb.group({
    libelle: ['', Validators.required],
    montantCible: [0, [Validators.required, Validators.min(0.01)]],
    echeance: [null as Date | null],
    compteId: [null as string | null],
    actifId: [null as string | null],
  }, { validators: ObjectifsComponent.supportXorValidator });

  /** Comptes/actifs/catégories du foyer courant, utilisés pour rattacher un objectif à un support. */
  private readonly _refData = creerChargementReactif(this.contexte.foyerId, foyerId =>
    forkJoin([this.compteSvc.lister(foyerId), this.actifSvc.lister(foyerId), this.categorieSvc.lister(foyerId)]),
  );

  comptes = computed(() => this._refData.donnees()?.[0] ?? []);
  actifs = computed(() => this._refData.donnees()?.[1] ?? []);
  categories = computed(() => this._refData.donnees()?.[2] ?? []);

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
    const actifsList = this.actifs();
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
        actifLibelle: o.actifId ? actifsList.find(a => a.id === o.actifId)?.libelle : undefined,
        categorieLibelle: o.categorieProjetId ? cats.find(c => c.id === o.categorieProjetId)?.libelle ?? '' : '',
        membresAttaches,
      };
    });
  });

  ouvrirCreation(): void {
    this.objectifEnEdition = null;
    this.form.reset({ libelle: '', montantCible: 0, echeance: null, compteId: null, actifId: null });
    this.dialogVisible = true;
  }

  ouvrirEdition(o: ObjectifDto): void {
    this.objectifEnEdition = o;
    this.form.patchValue({
      libelle: o.libelle,
      montantCible: o.montantCible,
      echeance: o.echeance ? parseIsoDateLocal(o.echeance) : null,
      compteId: o.compteId ?? null,
      actifId: o.actifId ?? null,
    });
    this.dialogVisible = true;
  }

  onCompteChange(event: any): void {
    if (event.value) this.form.get('actifId')?.setValue(null);
    this.form.get('compteId')?.markAsTouched();
    this.form.get('actifId')?.markAsTouched();
  }

  onActifChange(event: any): void {
    if (event.value) this.form.get('compteId')?.setValue(null);
    this.form.get('compteId')?.markAsTouched();
    this.form.get('actifId')?.markAsTouched();
  }

  enregistrer(): void {
    const v = this.form.value;
    const req = {
      libelle: v.libelle!,
      montantCible: v.montantCible!,
      echeance: v.echeance ? toIsoDateLocal(v.echeance as Date) : undefined,
      compteId: v.compteId ?? undefined,
      actifId: v.actifId ?? undefined,
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

