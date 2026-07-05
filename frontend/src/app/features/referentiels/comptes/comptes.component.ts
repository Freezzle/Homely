import { Component, inject, signal, OnInit, effect } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, Validators, ReactiveFormsModule } from '@angular/forms';
import { TableModule } from 'primeng/table';
import { ButtonModule } from 'primeng/button';
import { DialogModule } from 'primeng/dialog';
import { InputTextModule } from 'primeng/inputtext';
import { InputNumberModule } from 'primeng/inputnumber';
import { SelectModule } from 'primeng/select';
import { ConfirmDialogModule } from 'primeng/confirmdialog';
import { TagModule } from 'primeng/tag';
import { MessageService, ConfirmationService } from 'primeng/api';
import { ContexteService } from '../../../core/services/contexte.service';
import { CompteService } from '../../../core/services/referentiel.service';
import { CompteDto, TypeCompte } from '../../../core/models/api.models';
import { MontantPipe } from '../../../core/pipes/format.pipes';
import { FR } from '../../../core/i18n/fr';

/** T10.2 — CRUD Comptes */
@Component({
  selector: 'app-comptes',
  standalone: true,
  providers: [ConfirmationService],
  imports: [
    CommonModule, ReactiveFormsModule,
    TableModule, ButtonModule, DialogModule, TagModule,
    InputTextModule, InputNumberModule, SelectModule,
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
            <th>{{ t.referentiels.compte.type }}</th>
            <th class="text-right">{{ t.referentiels.compte.soldeInitial }}</th>
            <th>{{ t.referentiels.compte.devise }}</th>
            <th class="text-right">{{ t.referentiels.compte.ordre }}</th>
            <th></th>
          </tr>
        </ng-template>
        <ng-template pTemplate="body" let-c>
          <tr>
            <td class="font-medium">{{ c.libelle }}</td>
            <td><p-tag [value]="typeLabel(c.type)" severity="secondary" /></td>
            <td class="text-right">{{ c.soldeInitial | montant:c.devise }}</td>
            <td class="text-surface-500">{{ c.devise }}</td>
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
              [modal]="true" styleClass="w-full max-w-md">
      <form [formGroup]="form" class="flex flex-col gap-4 pt-2">
        <div class="flex flex-col gap-1">
          <label class="text-sm font-medium">{{ t.referentiels.compte.libelle }} *</label>
          <input pInputText formControlName="libelle" class="w-full" />
        </div>
        <div class="grid grid-cols-2 gap-4">
          <div class="flex flex-col gap-1">
            <label class="text-sm font-medium">{{ t.referentiels.compte.type }}</label>
            <p-select appendTo="body" formControlName="type" [options]="typeOptions" optionLabel="label" optionValue="value" styleClass="w-full" />
          </div>
          <div class="flex flex-col gap-1">
            <label class="text-sm font-medium">{{ t.referentiels.compte.devise }}</label>
            <p-select appendTo="body" formControlName="devise" [options]="devises" styleClass="w-full" />
          </div>
        </div>
        <div class="grid grid-cols-2 gap-4">
          <div class="flex flex-col gap-1">
            <label class="text-sm font-medium">{{ t.referentiels.compte.soldeInitial }}</label>
            <p-inputnumber formControlName="soldeInitial" mode="decimal" [minFractionDigits]="2" class="w-full" />
          </div>
          <div class="flex flex-col gap-1">
            <label class="text-sm font-medium">{{ t.referentiels.compte.ordre }}</label>
            <p-inputnumber formControlName="ordre" [min]="1" class="w-full" />
          </div>
        </div>
      </form>
      <ng-template pTemplate="footer">
        <p-button [label]="t.commun.annuler" severity="secondary" (click)="dialogVisible = false" />
        <p-button [label]="t.commun.enregistrer" (click)="enregistrer()" [disabled]="form.invalid" />
      </ng-template>
    </p-dialog>
  `,
})
export class ComptesComponent implements OnInit {
  readonly t = FR;
  contexte = inject(ContexteService);
  private compteSvc = inject(CompteService);
  private toast = inject(MessageService);
  private confirm = inject(ConfirmationService);
  private fb = inject(FormBuilder);

  comptes = signal<CompteDto[]>([]);
  chargement = signal(false);
  dialogVisible = false;
  compteEnEdition: CompteDto | null = null;

  typeOptions: { label: string; value: TypeCompte }[] = [
    { label: FR.referentiels.compte.types.COURANT, value: 'COURANT' },
    { label: FR.referentiels.compte.types.EPARGNE, value: 'EPARGNE' },
    { label: FR.referentiels.compte.types.COMMUN,  value: 'COMMUN'  },
    { label: FR.referentiels.compte.types.AUTRE,   value: 'AUTRE'   },
  ];
  devises = ['CHF', 'EUR', 'USD', 'GBP', 'CAD'];

  form = this.fb.group({
    libelle:      ['', Validators.required],
    type:         ['COURANT' as TypeCompte, Validators.required],
    soldeInitial: [0],
    devise:       [this.contexte.deviseBase()],
    ordre:        [1, Validators.required],
  });

  typeLabel(type: TypeCompte): string {
    return FR.referentiels.compte.types[type] ?? type;
  }

  private readonly _chargerEffect = effect(() => {
    if (this.contexte.foyerId()) this.charger();
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

  ouvrirCreation(): void {
    this.compteEnEdition = null;
    const ordre = this.comptes().length > 0 ? Math.max(...this.comptes().map(c => c.ordre)) + 1 : 1;
    this.form.reset({ libelle: '', type: 'COURANT', soldeInitial: 0, devise: this.contexte.deviseBase(), ordre });
    this.dialogVisible = true;
  }

  ouvrirEdition(c: CompteDto): void {
    this.compteEnEdition = c;
    this.form.patchValue({ libelle: c.libelle, type: c.type, soldeInitial: c.soldeInitial, devise: c.devise, ordre: c.ordre });
    this.dialogVisible = true;
  }

  enregistrer(): void {
    const foyerId = this.contexte.foyerId()!;
    const v = this.form.value;
    const req = { libelle: v.libelle!, type: v.type as TypeCompte, soldeInitial: v.soldeInitial ?? 0, devise: v.devise ?? undefined, ordre: v.ordre! };
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
