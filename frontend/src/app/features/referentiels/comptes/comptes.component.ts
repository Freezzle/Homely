import { Component, inject, signal, effect } from '@angular/core';
import { CommonModule } from '@angular/common';
import { TableModule } from 'primeng/table';
import { ConfirmDialogModule } from 'primeng/confirmdialog';
import { TooltipModule } from 'primeng/tooltip';
import { MessageService, ConfirmationService } from 'primeng/api';
import { ContexteService } from '../../../core/services/contexte.service';
import { CompteService, MembreService } from '../../../core/services/referentiel.service';
import { CompteDto, MembreDto } from '../../../core/models/api.models';
import { MontantPipe } from '../../../core/pipes/format.pipes';
import { I18nService } from '../../../core/i18n/i18n.service';
import { ButtonComponent } from '../../../shared/components/button/button.component';
import { TagComponent } from '../../../shared/components/tag/tag.component';
import { creerCrudReferentiel } from '../../../core/utils/crud-referentiel.util';
import { notifierErreur } from '../../../core/utils/toast.util';
import { CompteFormDialogComponent, CompteFormRequest } from './compte-form-dialog/compte-form-dialog.component';

/** T10.2 — CRUD Comptes avec rattachement membres */
@Component({
  selector: 'app-comptes',
  standalone: true,
  providers: [ConfirmationService],
  imports: [
      CommonModule, TableModule, ButtonComponent, TooltipModule,
      ConfirmDialogModule, MontantPipe, TagComponent, CompteFormDialogComponent,
  ],
  templateUrl: './comptes.component.html',
})
export class ComptesComponent {
  private readonly i18n = inject(I18nService);
  readonly t = this.i18n.translations();
  contexte = inject(ContexteService);
  private compteSvc  = inject(CompteService);
  private membreSvc  = inject(MembreService);
  private toast      = inject(MessageService);
  private confirm    = inject(ConfirmationService);

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
    this.dialogVisible = true;
  }

  ouvrirEdition(c: CompteDto): void {
    this.compteEnEdition = c;
    this.dialogVisible = true;
  }

  /** La popin a validé sa saisie : il ne reste qu'à persister et refermer. */
  enregistrer(req: CompteFormRequest): void {
    this._crud.enregistrer(this.compteEnEdition?.id ?? null, req, () => { this.dialogVisible = false; });
  }

  supprimer(c: CompteDto): void {
    this.confirm.confirm({
      message: this.t.commun.confirmerSuppression,
      accept: () => this._crud.supprimer(c.id),
    });
  }
}
