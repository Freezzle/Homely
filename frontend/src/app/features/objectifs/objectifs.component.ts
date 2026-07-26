import { Component, inject, signal, computed, OnInit, effect } from '@angular/core';
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
import { ContexteService } from '../../core/services/contexte.service';
import { ObjectifService } from '../../core/services/scenario-poste.service';
import { CompteService, ActifService, CategorieService } from '../../core/services/referentiel.service';
import { ObjectifDto, CompteDto, ActifDto, CategorieDto } from '../../core/models/api.models';
import { MontantPipe, DateFrPipe } from '../../core/pipes/format.pipes';
import { I18nService } from '../../core/i18n/i18n.service';
import { toIsoDateLocal, parseIsoDateLocal } from '../../core/utils/date.util';

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
export class ObjectifsComponent implements OnInit {
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

  objectifs = signal<ObjectifDto[]>([]);
  comptes = signal<CompteDto[]>([]);
  actifs = signal<ActifDto[]>([]);
  categories = signal<CategorieDto[]>([]);
  chargement = signal(false);
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

  private readonly _chargerEffect = effect(() => {
    const foyerId = this.contexte.foyerId();
    const scenarioId = this.contexte.scenarioId();
    if (foyerId) {
      this.compteSvc.lister(foyerId).subscribe(c => this.comptes.set(c));
      this.actifSvc.lister(foyerId).subscribe(a => this.actifs.set(a));
      this.categorieSvc.lister(foyerId).subscribe(c => this.categories.set(c));
    }
    if (foyerId && scenarioId) this.charger();
  });

  ngOnInit(): void {}

  charger(): void {
    const foyerId = this.contexte.foyerId();
    const scenarioId = this.contexte.scenarioId();
    if (!foyerId || !scenarioId) return;
    this.chargement.set(true);
    this.objectifSvc.lister(foyerId, scenarioId).subscribe({
      next: o => { this.objectifs.set(o); this.chargement.set(false); },
      error: () => this.chargement.set(false),
    });
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
    const foyerId = this.contexte.foyerId()!;
    const scenarioId = this.contexte.scenarioId()!;
    const v = this.form.value;
    const req = {
      libelle: v.libelle!,
      montantCible: v.montantCible!,
      echeance: v.echeance ? toIsoDateLocal(v.echeance as Date) : undefined,
      compteId: v.compteId ?? undefined,
      actifId: v.actifId ?? undefined,
    };
    const obs = this.objectifEnEdition
      ? this.objectifSvc.modifier(foyerId, scenarioId, this.objectifEnEdition.id, req)
      : this.objectifSvc.creer(foyerId, scenarioId, req);
    obs.subscribe({
      next: () => { this.toast.add({ severity: 'success', summary: this.t.commun.succes }); this.dialogVisible = false; this.charger(); },
      error: (e) => this.toast.add({ severity: 'error', summary: this.t.commun.erreur, detail: e?.error?.message }),
    });
  }

  supprimer(o: ObjectifDto): void {
    this.confirm.confirm({
      message: this.t.commun.confirmerSuppression,
      accept: () => this.objectifSvc.supprimer(this.contexte.foyerId()!, this.contexte.scenarioId()!, o.id).subscribe({
        next: () => { this.toast.add({ severity: 'success', summary: this.t.commun.succes }); this.charger(); },
        error: (e) => this.toast.add({ severity: 'error', summary: this.t.commun.erreur, detail: e?.error?.message }),
      }),
    });
  }

  /** Boutons d'action des cartes objectifs — visuels uniquement pour l'instant. */
  actionAVenir(): void {
    this.toast.add({ severity: 'info', summary: this.t.objectif.actionAVenir });
  }
}

