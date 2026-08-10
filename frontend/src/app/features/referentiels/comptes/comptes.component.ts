import { Component, inject, signal, effect } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, Validators, ReactiveFormsModule } from '@angular/forms';
import { TableModule } from 'primeng/table';
import { ButtonModule } from 'primeng/button';
import { DialogModule } from 'primeng/dialog';
import { ConfirmDialogModule } from 'primeng/confirmdialog';
import { MessageModule } from 'primeng/message';
import { TooltipModule } from 'primeng/tooltip';
import { MessageService, ConfirmationService } from 'primeng/api';
import { ContexteService } from '../../../core/services/contexte.service';
import { CompteService, MembreService, TauxChangeService } from '../../../core/services/referentiel.service';
import { CompteDto, MembreDto } from '../../../core/models/api.models';
import { MontantPipe } from '../../../core/pipes/format.pipes';
import { I18nService } from '../../../core/i18n/i18n.service';
import { TagComponent } from '../../../shared/components/tag/tag.component';
import {
  InputNumberComponent,
  InputTextComponent,
  MultiSelectComponent,
  SelectComponent,
} from '../../../shared/components/form-fields';
import { creerDevisesDisponibles } from '../../../core/utils/devise-options.util';
import { creerCrudReferentiel } from '../../../core/utils/crud-referentiel.util';
import { notifierErreur } from '../../../core/utils/toast.util';

/** T10.2 — CRUD Comptes avec rattachement membres */
@Component({
  selector: 'app-comptes',
  standalone: true,
  providers: [ConfirmationService],
  imports: [
      CommonModule, ReactiveFormsModule,
      TableModule, ButtonModule, DialogModule, MessageModule, TooltipModule,
      InputTextComponent, InputNumberComponent, SelectComponent, MultiSelectComponent,
      ConfirmDialogModule, MontantPipe, TagComponent,
  ],
  templateUrl: './comptes.component.html',
})
export class ComptesComponent {
  private readonly i18n = inject(I18nService);
  readonly t = this.i18n.translations();
  contexte = inject(ContexteService);
  private compteSvc  = inject(CompteService);
  private membreSvc  = inject(MembreService);
  private tauxChangeSvc = inject(TauxChangeService);
  private toast      = inject(MessageService);
  private confirm    = inject(ConfirmationService);
  private fb         = inject(FormBuilder);

  private readonly _crud = creerCrudReferentiel(this.contexte, this.compteSvc, this.toast, {
    succes: this.t.commun.succes,
    erreur: this.t.commun.erreur,
    suppressionImpossible: this.t.commun.suppressionImpossible,
  });

  comptes       = this._crud.items;
  membresActifs = signal<MembreDto[]>([]);
  chargement    = this._crud.chargement;
  dialogVisible = false;
  compteEnEdition: CompteDto | null = null;

  form = this.fb.group({
    libelle:      ['', Validators.required],
    membreIds:    [[] as string[], Validators.required],
    soldeInitial: [0],
    devise:       [this.contexte.deviseBase()],
  });

  private readonly _devises = creerDevisesDisponibles(this.contexte, this.tauxChangeSvc, this.form.get('devise'));

  devisesOptions(): string[] {
    return this._devises();
  }

  membreIdsNonVides(): boolean {
    const ids = this.form.get('membreIds')?.value;
    return Array.isArray(ids) && ids.length > 0;
  }

  membreParId(id: string): MembreDto | undefined {
    return this.membresActifs().find(m => m.id === id);
  }

  /** Membres rattachés à un compte (pour l'affichage des tags). */
  membresForCompte(c: CompteDto): MembreDto[] {
    return c.membreIds.map(id => this.membreParId(id)).filter((m): m is MembreDto => !!m);
  }

  /** Ce compte est-il le compte primaire du membre donné ? */
  estPrimairePour(c: CompteDto, membreId: string): boolean {
    return c.membresPrimaireIds.includes(membreId);
  }

  /** Bascule le statut "compte primaire" de ce membre sur ce compte (le retire s'il l'a déjà). */
  togglePrimaire(c: CompteDto, membreId: string): void {
    const foyerId = this.contexte.foyerId();
    if (!foyerId) return;
    const nouveauCompteId = this.estPrimairePour(c, membreId) ? null : c.id;
    this.membreSvc.definirComptePrimaire(foyerId, membreId, nouveauCompteId).subscribe({
      next: () => { this._crud.charger(); this.chargerMembres(); },
      error: (e) => notifierErreur(this.toast, this.t.commun.erreur, e),
    });
  }

  private readonly _chargerMembresEffect = effect(() => {
    if (this.contexte.foyerId()) this.chargerMembres();
  });

  chargerMembres(): void {
    const foyerId = this.contexte.foyerId();
    if (!foyerId) return;
    this.membreSvc.lister(foyerId).subscribe({
      next: m => this.membresActifs.set(m.filter(mb => mb.actif)),
    });
  }

  ouvrirCreation(): void {
    this.compteEnEdition = null;
    // Pré-sélectionner tous les membres actifs par défaut
    const tousIds = this.membresActifs().map(m => m.id);
    this.form.reset({ libelle: '', membreIds: tousIds, soldeInitial: 0, devise: this.contexte.deviseBase() });
    this.dialogVisible = true;
  }

  ouvrirEdition(c: CompteDto): void {
    this.compteEnEdition = c;
    // membreIds : seulement ceux qui sont actifs (les inactifs sont préservés côté serveur)
    const membreIdsActifs = c.membreIds.filter(id => this.membresActifs().some(m => m.id === id));
    this.form.patchValue({
      libelle: c.libelle, membreIds: membreIdsActifs,
      soldeInitial: c.soldeInitial, devise: c.devise,
    });
    this.dialogVisible = true;
  }

  enregistrer(): void {
    if (!this.membreIdsNonVides()) return;
    const v = this.form.value;
    const req = {
      libelle: v.libelle!,
      membreIds: v.membreIds as string[],
      soldeInitial: v.soldeInitial ?? 0,
      devise: v.devise ?? undefined,
    };
    this._crud.enregistrer(this.compteEnEdition?.id ?? null, req, () => { this.dialogVisible = false; });
  }

  supprimer(c: CompteDto): void {
    this.confirm.confirm({
      message: this.t.commun.confirmerSuppression,
      accept: () => this._crud.supprimer(c.id),
    });
  }
}
