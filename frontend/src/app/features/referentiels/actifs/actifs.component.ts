import { Component, inject, signal, OnInit, effect } from '@angular/core';
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
import { ActifService } from '../../../core/services/referentiel.service';
import { ActifDto, TypeActif } from '../../../core/models/api.models';
import { MontantPipe, PctPipe } from '../../../core/pipes/format.pipes';
import { I18nService } from '../../../core/i18n/i18n.service';

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
  template: `
    <p-confirmdialog />
    <div class="flex flex-col gap-4">
      <div class="flex items-center gap-4">
        <h1 class="text-2xl font-bold flex-1">{{ t.referentiels.actif.titre }}</h1>
        @if (contexte.estEditor()) {
          <p-button icon="pi pi-plus" [label]="t.commun.creer" (click)="ouvrirCreation()" />
        }
      </div>

      <p-table [value]="actifs()" class="p-datatable-sm p-datatable-striped" [loading]="chargement()">
        <ng-template #header>
          <tr>
            <th pSortableColumn="libelle">{{ t.referentiels.actif.libelle }} <p-sort-icon field="libelle" /></th>
            <th>{{ t.referentiels.actif.typeActif }}</th>
            <th class="text-right">{{ t.referentiels.actif.soldeInitial }}</th>
            <th class="text-right">{{ t.referentiels.actif.tauxCroissance }}</th>
            <th class="text-right">{{ t.referentiels.actif.ordre }}</th>
            <th></th>
          </tr>
        </ng-template>
        <ng-template #body let-a>
          <tr>
            <td class="font-medium">{{ a.libelle }}</td>
            <td><p-tag [value]="typeActifLabel(a.typeActif)" severity="secondary" /></td>
            <td class="text-right">{{ a.soldeInitial | montant:a.devise }}</td>
            <td class="text-right text-surface-500">{{ a.tauxCroissanceAnnuel | pct:1 }}</td>
            <td class="text-right text-surface-500">{{ a.ordre }}</td>
            <td>
              <div class="flex gap-1">
                @if (contexte.estEditor()) {
                  <p-button icon="pi pi-pencil" [text]="true" size="small" (click)="ouvrirEdition(a)" />
                  <p-button icon="pi pi-trash" [text]="true" severity="danger" size="small" (click)="supprimer(a)" />
                }
              </div>
            </td>
          </tr>
        </ng-template>
        <ng-template #emptymessage>
          <tr><td colspan="6" class="text-center py-8 text-surface-400">{{ t.commun.aucunResultat }}</td></tr>
        </ng-template>
      </p-table>
    </div>

    <p-dialog [(visible)]="dialogVisible" [header]="actifEnEdition ? t.commun.modifier : t.commun.creer"
              [modal]="true" class="w-full max-w-md">
      <form [formGroup]="form" class="flex flex-col gap-4 pt-2">
        <div class="flex flex-col gap-1">
          <label class="text-sm font-medium">{{ t.referentiels.actif.libelle }} *</label>
          <input pInputText formControlName="libelle" class="w-full" />
        </div>
        <div class="grid grid-cols-2 gap-4">
          <div class="flex flex-col gap-1">
            <label class="text-sm font-medium">{{ t.referentiels.actif.typeActif }}</label>
            <p-select appendTo="body" formControlName="typeActif" [options]="typeOptions" optionLabel="label" optionValue="value" class="w-full" />
          </div>
          <div class="flex flex-col gap-1">
            <label class="text-sm font-medium">{{ t.referentiels.actif.devise }}</label>
            <p-select appendTo="body" formControlName="devise" [options]="devises" class="w-full" />
          </div>
        </div>
        <div class="grid grid-cols-2 gap-4">
          <div class="flex flex-col gap-1">
            <label class="text-sm font-medium">{{ t.referentiels.actif.soldeInitial }}</label>
            <p-inputnumber formControlName="soldeInitial" mode="decimal" [minFractionDigits]="2" class="w-full" />
          </div>
          <div class="flex flex-col gap-1">
            <label class="text-sm font-medium">{{ t.referentiels.actif.tauxCroissance }}</label>
            <p-inputnumber formControlName="tauxCroissanceAnnuel" mode="decimal" [minFractionDigits]="2"
                           [min]="-100" [max]="100" class="w-full" />
          </div>
        </div>
        <div class="flex flex-col gap-1">
          <label class="text-sm font-medium">{{ t.referentiels.actif.ordre }}</label>
          <p-inputnumber formControlName="ordre" [min]="1" class="w-full" />
        </div>
      </form>
      <ng-template #footer>
        <p-button [label]="t.commun.annuler" severity="secondary" (click)="dialogVisible = false" />
        <p-button [label]="t.commun.enregistrer" (click)="enregistrer()" [disabled]="form.invalid" />
      </ng-template>
    </p-dialog>
  `,
})
export class ActifsComponent implements OnInit {
  private readonly i18n = inject(I18nService);
  readonly t = this.i18n.translations();
  contexte = inject(ContexteService);
  private actifSvc = inject(ActifService);
  private toast = inject(MessageService);
  private confirm = inject(ConfirmationService);
  private fb = inject(FormBuilder);

  actifs = signal<ActifDto[]>([]);
  chargement = signal(false);
  dialogVisible = false;
  actifEnEdition: ActifDto | null = null;

  private readonly _chargerEffect = effect(() => {
    if (this.contexte.foyerId()) this.charger();
  });

  typeOptions: { label: string; value: TypeActif }[] = [
    { label: this.t.referentiels.actif.types.COMPTE_EPARGNE,   value: 'COMPTE_EPARGNE' },
    { label: this.t.referentiels.actif.types.TROISIEME_PILIER, value: 'TROISIEME_PILIER' },
    { label: this.t.referentiels.actif.types.INVESTISSEMENT,   value: 'INVESTISSEMENT' },
    { label: this.t.referentiels.actif.types.CRYPTO,           value: 'CRYPTO' },
    { label: this.t.referentiels.actif.types.IMMOBILIER,       value: 'IMMOBILIER' },
    { label: this.t.referentiels.actif.types.VEHICULE,         value: 'VEHICULE' },
    { label: this.t.referentiels.actif.types.AUTRE,            value: 'AUTRE' },
  ];
  devises = ['CHF', 'EUR', 'USD', 'GBP', 'CAD'];

  form = this.fb.group({
    libelle: ['', Validators.required],
    typeActif: ['AUTRE' as TypeActif, Validators.required],
    soldeInitial: [0],
    devise: [this.contexte.deviseBase()],
    tauxCroissanceAnnuel: [0],
    ordre: [1, Validators.required],
  });

  typeActifLabel(type: TypeActif): string {
    return this.t.referentiels.actif.types[type] ?? type;
  }

  ngOnInit(): void {}

  charger(): void {
    const foyerId = this.contexte.foyerId();
    if (!foyerId) return;
    this.chargement.set(true);
    this.actifSvc.lister(foyerId).subscribe({
      next: a => { this.actifs.set(a); this.chargement.set(false); },
      error: () => this.chargement.set(false),
    });
  }

  ouvrirCreation(): void {
    this.actifEnEdition = null;
    const ordre = this.actifs().length > 0 ? Math.max(...this.actifs().map(a => a.ordre)) + 1 : 1;
    this.form.reset({ libelle: '', typeActif: 'AUTRE', soldeInitial: 0, devise: this.contexte.deviseBase(), tauxCroissanceAnnuel: 0, ordre });
    this.dialogVisible = true;
  }

  ouvrirEdition(a: ActifDto): void {
    this.actifEnEdition = a;
    this.form.patchValue({ libelle: a.libelle, typeActif: a.typeActif, soldeInitial: a.soldeInitial, devise: a.devise, tauxCroissanceAnnuel: a.tauxCroissanceAnnuel * 100, ordre: a.ordre });
    this.dialogVisible = true;
  }

  enregistrer(): void {
    const foyerId = this.contexte.foyerId()!;
    const v = this.form.value;
    const req = {
      libelle: v.libelle!, typeActif: v.typeActif as TypeActif,
      soldeInitial: v.soldeInitial ?? 0,
      devise: v.devise ?? undefined,
      tauxCroissanceAnnuel: (v.tauxCroissanceAnnuel ?? 0) / 100,
      ordre: v.ordre!,
    };
    const obs = this.actifEnEdition
      ? this.actifSvc.modifier(foyerId, this.actifEnEdition.id, req)
      : this.actifSvc.creer(foyerId, req);
    obs.subscribe({
      next: () => { this.toast.add({ severity: 'success', summary: this.t.commun.succes }); this.dialogVisible = false; this.charger(); },
      error: (e) => this.toast.add({ severity: 'error', summary: this.t.commun.erreur, detail: e?.error?.message }),
    });
  }

  supprimer(a: ActifDto): void {
    this.confirm.confirm({
      message: this.t.commun.confirmerSuppression,
      accept: () => this.actifSvc.supprimer(this.contexte.foyerId()!, a.id).subscribe({
        next: () => { this.toast.add({ severity: 'success', summary: this.t.commun.succes }); this.charger(); },
        error: () => this.toast.add({ severity: 'error', summary: this.t.commun.suppressionImpossible }),
      }),
    });
  }
}



