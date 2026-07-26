import { Component, inject, signal, OnInit } from '@angular/core';
import { toObservable, takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { CommonModule } from '@angular/common';
import { FormBuilder, Validators, ReactiveFormsModule, FormsModule } from '@angular/forms';
import { TableModule } from 'primeng/table';
import { ButtonModule } from 'primeng/button';
import { DialogModule } from 'primeng/dialog';
import { InputTextModule } from 'primeng/inputtext';
import { SelectModule } from 'primeng/select';
import { TagModule } from 'primeng/tag';
import { TooltipModule } from 'primeng/tooltip';
import { ConfirmDialogModule } from 'primeng/confirmdialog';
import { MessageService, ConfirmationService } from 'primeng/api';
import { of } from 'rxjs';
import { switchMap, catchError } from 'rxjs/operators';
import { ContexteService } from '../../../core/services/contexte.service';
import { FoyerService } from '../../../core/services/referentiel.service';
import { AccesFoyerDto, RoleFoyer } from '../../../core/models/api.models';
import { I18nService } from '../../../core/i18n/i18n.service';

/** T10.2 — Gestion des accès (OWNER uniquement) */
@Component({
  selector: 'app-acces',
  standalone: true,
  providers: [ConfirmationService],
  imports: [
    CommonModule, ReactiveFormsModule, FormsModule,
    TableModule, ButtonModule, DialogModule, TagModule, TooltipModule,
    InputTextModule, SelectModule,
    ConfirmDialogModule,
  ],
  templateUrl: './acces.component.html',
})
export class AccesComponent implements OnInit {
  private readonly i18n = inject(I18nService);
  readonly t = this.i18n.translations();
  contexte = inject(ContexteService);
  private foyerSvc = inject(FoyerService);
  private toast = inject(MessageService);
  private confirm = inject(ConfirmationService);
  private fb = inject(FormBuilder);

  acces = signal<AccesFoyerDto[]>([]);
  chargement = signal(false);
  enCours = signal(false);
  inviteVisible = false;
  roleVisible = false;
  accesEnEdition: AccesFoyerDto | null = null;
  nouveauRole: RoleFoyer = 'VIEWER';

  roleOptions: { label: string; value: RoleFoyer }[] = [
    { label: this.t.acces.roles.EDITOR, value: 'EDITOR' },
    { label: this.t.acces.roles.VIEWER, value: 'VIEWER' },
  ];

  inviteForm = this.fb.group({
    email: ['', [Validators.required, Validators.email]],
    role: ['VIEWER' as RoleFoyer, Validators.required],
  });

  roleLabel(role: RoleFoyer): string {
    return this.t.acces.roles[role] ?? role;
  }

  /**
   * Flux réactif sur le foyer courant : `switchMap` annule automatiquement toute
   * requête `listerAcces` encore en vol dès que le foyer change, ce qui évite
   * qu'une réponse tardive d'un ancien foyer n'écrase les accès affichés pour
   * le foyer nouvellement sélectionné (fuite d'informations inter-foyers).
   */
  private readonly _chargerSub = toObservable(this.contexte.foyerId)
    .pipe(
      switchMap(foyerId => {
        if (!foyerId) {
          this.acces.set([]);
          return of(null);
        }
        this.chargement.set(true);
        return this.foyerSvc.listerAcces(foyerId).pipe(
          catchError(() => of(null)),
        );
      }),
      takeUntilDestroyed(),
    )
    .subscribe(a => {
      this.chargement.set(false);
      if (a) this.acces.set(a);
    });

  ngOnInit(): void {}

  charger(): void {
    const foyerId = this.contexte.foyerId();
    if (!foyerId) return;
    this.chargement.set(true);
    this.foyerSvc.listerAcces(foyerId).pipe(
      catchError(() => of(null)),
    ).subscribe(a => {
      this.chargement.set(false);
      if (a) this.acces.set(a);
    });
  }

  ouvrirInvitation(): void {
    this.inviteForm.reset({ email: '', role: 'VIEWER' });
    this.inviteVisible = true;
  }

  inviter(): void {
    if (this.enCours()) return;
    this.enCours.set(true);
    const foyerId = this.contexte.foyerId()!;
    const v = this.inviteForm.value;
    this.foyerSvc.inviter(foyerId, { email: v.email!, role: v.role as RoleFoyer }).subscribe({
      next: () => { this.enCours.set(false); this.toast.add({ severity: 'success', summary: this.t.commun.succes }); this.inviteVisible = false; this.charger(); },
      error: (e) => { this.enCours.set(false); this.toast.add({ severity: 'error', summary: this.t.commun.erreur, detail: e?.error?.message }); },
    });
  }

  ouvrirChangerRole(a: AccesFoyerDto): void {
    this.accesEnEdition = a;
    this.nouveauRole = a.role;
    this.roleVisible = true;
  }

  changerRole(): void {
    if (this.enCours()) return;
    this.enCours.set(true);
    const foyerId = this.contexte.foyerId()!;
    this.foyerSvc.changerRole(foyerId, this.accesEnEdition!.id, { role: this.nouveauRole }).subscribe({
      next: () => { this.enCours.set(false); this.toast.add({ severity: 'success', summary: this.t.commun.succes }); this.roleVisible = false; this.charger(); },
      error: (e) => { this.enCours.set(false); this.toast.add({ severity: 'error', summary: this.t.commun.erreur, detail: e?.error?.message }); },
    });
  }

  retirer(a: AccesFoyerDto): void {
    this.confirm.confirm({
      message: this.t.commun.confirmerSuppression,
      accept: () => {
        if (this.enCours()) return;
        this.enCours.set(true);
        this.foyerSvc.retirerAcces(this.contexte.foyerId()!, a.id).subscribe({
          next: () => { this.enCours.set(false); this.toast.add({ severity: 'success', summary: this.t.commun.succes }); this.charger(); },
          error: (e) => { this.enCours.set(false); this.toast.add({ severity: 'error', summary: this.t.commun.erreur, detail: e?.error?.message }); },
        });
      },
    });
  }
}

