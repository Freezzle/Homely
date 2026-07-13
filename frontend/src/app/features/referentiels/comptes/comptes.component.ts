import { Component, inject, signal, OnInit, effect } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, Validators, ReactiveFormsModule } from '@angular/forms';
import { TableModule } from 'primeng/table';
import { ButtonModule } from 'primeng/button';
import { DialogModule } from 'primeng/dialog';
import { InputTextModule } from 'primeng/inputtext';
import { InputNumberModule } from 'primeng/inputnumber';
import { SelectModule } from 'primeng/select';
import { MultiSelectModule } from 'primeng/multiselect';
import { ConfirmDialogModule } from 'primeng/confirmdialog';
import { MessageModule } from 'primeng/message';
import { TagModule } from 'primeng/tag';
import { MessageService, ConfirmationService } from 'primeng/api';
import { ContexteService } from '../../../core/services/contexte.service';
import { CompteService, MembreService } from '../../../core/services/referentiel.service';
import { CompteDto, MembreDto } from '../../../core/models/api.models';
import { MontantPipe } from '../../../core/pipes/format.pipes';
import { FR } from '../../../core/i18n/fr';

/** T10.2 — CRUD Comptes avec rattachement membres */
@Component({
  selector: 'app-comptes',
  standalone: true,
  providers: [ConfirmationService],
  imports: [
    CommonModule, ReactiveFormsModule,
    TableModule, ButtonModule, DialogModule, TagModule, MessageModule,
    InputTextModule, InputNumberModule, SelectModule, MultiSelectModule,
    ConfirmDialogModule, MontantPipe,
  ],
  template: `
    <p-confirmdialog />
    <div class="flex flex-col gap-4">
      <div class="flex items-center gap-4">
        <h1 class="text-2xl font-bold flex-1">{{ t.referentiels.compte.titre }}</h1>
        @if (contexte.estEditor()) {
          <p-button icon="pi pi-plus" [label]="t.commun.creer" (click)="ouvrirCreation()" />
        }
      </div>

      <p-table [value]="comptes()" styleClass="p-datatable-sm p-datatable-striped" [loading]="chargement()">
        <ng-template pTemplate="header">
          <tr>
            <th pSortableColumn="libelle">{{ t.referentiels.compte.libelle }} <p-sortIcon field="libelle" /></th>
            <th class="text-right">{{ t.referentiels.compte.soldeInitial }}</th>
            <th>{{ t.referentiels.compte.devise }}</th>
            <th>{{ t.referentiels.compte.membres }}</th>
            <th class="text-right">{{ t.referentiels.compte.ordre }}</th>
            <th></th>
          </tr>
        </ng-template>
        <ng-template pTemplate="body" let-c>
          <tr>
            <td class="font-medium">{{ c.libelle }}</td>
            <td class="text-right">{{ c.soldeInitial | montant:c.devise }}</td>
            <td class="text-surface-500">{{ c.devise }}</td>
            <td>
              <div class="flex flex-wrap gap-1">
                @for (mid of c.membreIds; track mid) {
                  <p-tag [value]="nomMembre(mid)" severity="secondary" />
                }
              </div>
            </td>
            <td class="text-right text-surface-500">{{ c.ordre }}</td>
            <td>
              <div class="flex gap-1">
                @if (contexte.estEditor()) {
                  <p-button icon="pi pi-pencil" [text]="true" size="small" (click)="ouvrirEdition(c)" />
                  <p-button icon="pi pi-trash" [text]="true" severity="danger" size="small" (click)="supprimer(c)" />
                }
              </div>
            </td>
          </tr>
        </ng-template>
        <ng-template pTemplate="emptymessage">
          <tr><td colspan="6" class="text-center py-8 text-surface-400">{{ t.commun.aucunResultat }}</td></tr>
        </ng-template>
      </p-table>
    </div>

    <p-dialog [(visible)]="dialogVisible" [header]="compteEnEdition ? t.commun.modifier : t.commun.creer"
              [modal]="true" styleClass="w-full max-w-lg">
      <form [formGroup]="form" class="flex flex-col gap-4 pt-2">
        <div class="flex flex-col gap-1">
          <label class="text-sm font-medium">{{ t.referentiels.compte.libelle }} *</label>
          <input pInputText formControlName="libelle" class="w-full" />
        </div>

        <!-- Membres rattachés -->
        <div class="flex flex-col gap-1">
          <label class="text-sm font-medium">{{ t.referentiels.compte.membres }} *</label>
          <p-multiselect
            appendTo="body"
            formControlName="membreIds"
            [options]="membresActifs()"
            optionLabel="nom"
            optionValue="id"
            [placeholder]="t.referentiels.compte.membresPlaceholder"
            styleClass="w-full"
            display="chip" />
          @if (form.get('membreIds')?.invalid && form.get('membreIds')?.touched) {
            <p-message severity="warn" [text]="t.referentiels.compte.membresRequis" />
          }
        </div>

        <div class="grid grid-cols-2 gap-4">
          <div class="flex flex-col gap-1">
            <label class="text-sm font-medium">{{ t.referentiels.compte.devise }}</label>
            <p-select appendTo="body" formControlName="devise" [options]="devises" styleClass="w-full" />
          </div>
          <div class="flex flex-col gap-1">
            <label class="text-sm font-medium">{{ t.referentiels.compte.ordre }}</label>
            <p-inputnumber formControlName="ordre" [min]="1" class="w-full" />
          </div>
        </div>
        <div class="flex flex-col gap-1">
          <label class="text-sm font-medium">{{ t.referentiels.compte.soldeInitial }}</label>
          <p-inputnumber formControlName="soldeInitial" mode="decimal" [minFractionDigits]="2" class="w-full" />
        </div>
      </form>
      <ng-template pTemplate="footer">
        <p-button [label]="t.commun.annuler" severity="secondary" (click)="dialogVisible = false" />
        <p-button [label]="t.commun.enregistrer" (click)="enregistrer()"
                  [disabled]="form.invalid || !membreIdsNonVides()" />
      </ng-template>
    </p-dialog>
  `,
})
export class ComptesComponent implements OnInit {
  readonly t = FR;
  contexte = inject(ContexteService);
  private compteSvc  = inject(CompteService);
  private membreSvc  = inject(MembreService);
  private toast      = inject(MessageService);
  private confirm    = inject(ConfirmationService);
  private fb         = inject(FormBuilder);

  comptes       = signal<CompteDto[]>([]);
  membresActifs = signal<MembreDto[]>([]);
  chargement    = signal(false);
  dialogVisible = false;
  compteEnEdition: CompteDto | null = null;

  devises = ['CHF', 'EUR', 'USD', 'GBP', 'CAD'];

  form = this.fb.group({
    libelle:      ['', Validators.required],
    membreIds:    [[] as string[], Validators.required],
    soldeInitial: [0],
    devise:       [this.contexte.deviseBase()],
    ordre:        [1, Validators.required],
  });

  membreIdsNonVides(): boolean {
    const ids = this.form.get('membreIds')?.value;
    return Array.isArray(ids) && ids.length > 0;
  }

  nomMembre(id: string): string {
    return this.membresActifs().find(m => m.id === id)?.nom ?? id.substring(0, 8);
  }

  private readonly _chargerEffect = effect(() => {
    if (this.contexte.foyerId()) {
      this.charger();
      this.chargerMembres();
    }
  });

  ngOnInit(): void {}

  charger(): void {
    const foyerId = this.contexte.foyerId();
    if (!foyerId) return;
    this.chargement.set(true);
    this.compteSvc.lister(foyerId).subscribe({
      next: c => { this.comptes.set(c); this.chargement.set(false); },
      error: () => this.chargement.set(false),
    });
  }

  chargerMembres(): void {
    const foyerId = this.contexte.foyerId();
    if (!foyerId) return;
    this.membreSvc.lister(foyerId).subscribe({
      next: m => this.membresActifs.set(m.filter(mb => mb.actif)),
    });
  }

  ouvrirCreation(): void {
    this.compteEnEdition = null;
    const ordre = this.comptes().length > 0 ? Math.max(...this.comptes().map(c => c.ordre)) + 1 : 1;
    // Pré-sélectionner tous les membres actifs par défaut
    const tousIds = this.membresActifs().map(m => m.id);
    this.form.reset({ libelle: '', membreIds: tousIds, soldeInitial: 0, devise: this.contexte.deviseBase(), ordre });
    this.dialogVisible = true;
  }

  ouvrirEdition(c: CompteDto): void {
    this.compteEnEdition = c;
    // membreIds : seulement ceux qui sont actifs (les inactifs sont préservés côté serveur)
    const membreIdsActifs = c.membreIds.filter(id => this.membresActifs().some(m => m.id === id));
    this.form.patchValue({
      libelle: c.libelle, membreIds: membreIdsActifs,
      soldeInitial: c.soldeInitial, devise: c.devise, ordre: c.ordre,
    });
    this.dialogVisible = true;
  }

  enregistrer(): void {
    if (!this.membreIdsNonVides()) return;
    const foyerId = this.contexte.foyerId()!;
    const v = this.form.value;
    const req = {
      libelle: v.libelle!,
      membreIds: v.membreIds as string[],
      soldeInitial: v.soldeInitial ?? 0,
      devise: v.devise ?? undefined,
      ordre: v.ordre!,
    };
    const obs = this.compteEnEdition
      ? this.compteSvc.modifier(foyerId, this.compteEnEdition.id, req)
      : this.compteSvc.creer(foyerId, req);
    obs.subscribe({
      next: () => { this.toast.add({ severity: 'success', summary: FR.commun.succes }); this.dialogVisible = false; this.charger(); },
      error: (e) => this.toast.add({ severity: 'error', summary: FR.commun.erreur, detail: e?.error?.message }),
    });
  }

  supprimer(c: CompteDto): void {
    this.confirm.confirm({
      message: FR.commun.confirmerSuppression,
      accept: () => this.compteSvc.supprimer(this.contexte.foyerId()!, c.id).subscribe({
        next: () => { this.toast.add({ severity: 'success', summary: FR.commun.succes }); this.charger(); },
        error: () => this.toast.add({ severity: 'error', summary: FR.commun.suppressionImpossible }),
      }),
    });
  }
}
