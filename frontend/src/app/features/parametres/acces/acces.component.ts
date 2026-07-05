import { Component, inject, signal, OnInit, effect } from '@angular/core';
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
import { ContexteService } from '../../../core/services/contexte.service';
import { FoyerService } from '../../../core/services/referentiel.service';
import { AccesFoyerDto, RoleFoyer } from '../../../core/models/api.models';
import { FR } from '../../../core/i18n/fr';

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
  template: `
    <p-confirmdialog />
    <div class="flex flex-col gap-4">
      <div class="flex items-center gap-4">
        <h1 class="text-2xl font-bold flex-1">{{ t.acces.titre }}</h1>
        @if (contexte.estOwner()) {
          <p-button icon="pi pi-user-plus" [label]="t.acces.inviter" (click)="ouvrirInvitation()" />
        }
      </div>

      <p-table [value]="acces()" styleClass="p-datatable-sm p-datatable-striped" [loading]="chargement()">
        <ng-template pTemplate="header">
          <tr>
            <th>Nom</th>
            <th>{{ t.acces.email }}</th>
            <th>{{ t.acces.role }}</th>
            <th></th>
          </tr>
        </ng-template>
        <ng-template pTemplate="body" let-a>
          <tr>
            <td class="font-medium">{{ a.nomComplet }}</td>
            <td class="text-surface-500">{{ a.email }}</td>
            <td>
              <p-tag [value]="roleLabel(a.role)"
                     [severity]="a.role === 'OWNER' ? 'warn' : a.role === 'EDITOR' ? 'info' : 'secondary'" />
            </td>
            <td>
              <div class="flex gap-1">
                @if (contexte.estOwner() && a.role !== 'OWNER') {
                  <p-button icon="pi pi-cog" [text]="true" size="small"
                            pTooltip="Changer le rôle" (click)="ouvrirChangerRole(a)" />
                  <p-button icon="pi pi-user-minus" [text]="true" severity="danger" size="small"
                            [pTooltip]="t.acces.retirer" (click)="retirer(a)" />
                }
              </div>
            </td>
          </tr>
        </ng-template>
        <ng-template pTemplate="emptymessage">
          <tr><td colspan="4" class="text-center py-8 text-surface-400">{{ t.commun.aucunResultat }}</td></tr>
        </ng-template>
      </p-table>
    </div>

    <!-- Dialog invitation -->
    <p-dialog [(visible)]="inviteVisible" [header]="t.acces.inviter" [modal]="true" styleClass="w-full max-w-md">
      <form [formGroup]="inviteForm" class="flex flex-col gap-4 pt-2">
        <div class="flex flex-col gap-1">
          <label class="text-sm font-medium">{{ t.acces.email }} *</label>
          <input pInputText formControlName="email" type="email" class="w-full" />
        </div>
        <div class="flex flex-col gap-1">
          <label class="text-sm font-medium">{{ t.acces.role }}</label>
          <p-select appendTo="body" formControlName="role" [options]="roleOptions" optionLabel="label" optionValue="value" styleClass="w-full" />
        </div>
      </form>
      <ng-template pTemplate="footer">
        <p-button [label]="t.commun.annuler" severity="secondary" (click)="inviteVisible = false" />
        <p-button [label]="t.acces.inviter" (click)="inviter()" [disabled]="inviteForm.invalid" />
      </ng-template>
    </p-dialog>

    <!-- Dialog changer rôle -->
    <p-dialog [(visible)]="roleVisible" [header]="'Changer le rôle'" [modal]="true" styleClass="w-full max-w-sm">
      <div class="flex flex-col gap-4 pt-2">
        <p-select appendTo="body" [(ngModel)]="nouveauRole" [options]="roleOptions" optionLabel="label" optionValue="value" styleClass="w-full" />
      </div>
      <ng-template pTemplate="footer">
        <p-button [label]="t.commun.annuler" severity="secondary" (click)="roleVisible = false" />
        <p-button [label]="t.commun.enregistrer" (click)="changerRole()" />
      </ng-template>
    </p-dialog>
  `,
})
export class AccesComponent implements OnInit {
  readonly t = FR;
  contexte = inject(ContexteService);
  private foyerSvc = inject(FoyerService);
  private toast = inject(MessageService);
  private confirm = inject(ConfirmationService);
  private fb = inject(FormBuilder);

  acces = signal<AccesFoyerDto[]>([]);
  chargement = signal(false);
  inviteVisible = false;
  roleVisible = false;
  accesEnEdition: AccesFoyerDto | null = null;
  nouveauRole: RoleFoyer = 'VIEWER';

  roleOptions: { label: string; value: RoleFoyer }[] = [
    { label: FR.acces.roles.EDITOR, value: 'EDITOR' },
    { label: FR.acces.roles.VIEWER, value: 'VIEWER' },
  ];

  inviteForm = this.fb.group({
    email: ['', [Validators.required, Validators.email]],
    role: ['VIEWER' as RoleFoyer, Validators.required],
  });

  roleLabel(role: RoleFoyer): string {
    return FR.acces.roles[role] ?? role;
  }

  // effect() en initialiseur de champ = contexte d'injection valide ✓
  private readonly _chargerEffect = effect(() => {
    if (this.contexte.foyerId()) this.charger();
  });

  ngOnInit(): void {}

  charger(): void {
    const foyerId = this.contexte.foyerId();
    if (!foyerId) return;
    this.chargement.set(true);
    this.foyerSvc.listerAcces(foyerId).subscribe({
      next: a => { this.acces.set(a); this.chargement.set(false); },
      error: () => this.chargement.set(false),
    });
  }

  ouvrirInvitation(): void {
    this.inviteForm.reset({ email: '', role: 'VIEWER' });
    this.inviteVisible = true;
  }

  inviter(): void {
    const foyerId = this.contexte.foyerId()!;
    const v = this.inviteForm.value;
    this.foyerSvc.inviter(foyerId, { email: v.email!, role: v.role as RoleFoyer }).subscribe({
      next: () => { this.toast.add({ severity: 'success', summary: FR.commun.succes }); this.inviteVisible = false; this.charger(); },
      error: (e) => this.toast.add({ severity: 'error', summary: FR.commun.erreur, detail: e?.error?.message }),
    });
  }

  ouvrirChangerRole(a: AccesFoyerDto): void {
    this.accesEnEdition = a;
    this.nouveauRole = a.role;
    this.roleVisible = true;
  }

  changerRole(): void {
    const foyerId = this.contexte.foyerId()!;
    this.foyerSvc.changerRole(foyerId, this.accesEnEdition!.id, { role: this.nouveauRole }).subscribe({
      next: () => { this.toast.add({ severity: 'success', summary: FR.commun.succes }); this.roleVisible = false; this.charger(); },
      error: (e) => this.toast.add({ severity: 'error', summary: FR.commun.erreur, detail: e?.error?.message }),
    });
  }

  retirer(a: AccesFoyerDto): void {
    this.confirm.confirm({
      message: FR.commun.confirmerSuppression,
      accept: () => this.foyerSvc.retirerAcces(this.contexte.foyerId()!, a.id).subscribe({
        next: () => { this.toast.add({ severity: 'success', summary: FR.commun.succes }); this.charger(); },
        error: (e) => this.toast.add({ severity: 'error', summary: FR.commun.erreur, detail: e?.error?.message }),
      }),
    });
  }
}

