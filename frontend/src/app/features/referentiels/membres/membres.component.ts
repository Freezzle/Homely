import { Component, inject, signal, OnInit, effect } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, Validators, ReactiveFormsModule } from '@angular/forms';
import { TableModule } from 'primeng/table';
import { ButtonModule } from 'primeng/button';
import { DialogModule } from 'primeng/dialog';
import { InputTextModule } from 'primeng/inputtext';
import { InputNumberModule } from 'primeng/inputnumber';
import { ColorPickerModule } from 'primeng/colorpicker';
import { ConfirmDialogModule } from 'primeng/confirmdialog';
import { MessageService, ConfirmationService } from 'primeng/api';
import { ContexteService } from '../../../core/services/contexte.service';
import { MembreService } from '../../../core/services/referentiel.service';
import { MembreDto } from '../../../core/models/api.models';
import { FR } from '../../../core/i18n/fr';

/** T10.2 — CRUD Membres */
@Component({
  selector: 'app-membres',
  standalone: true,
  providers: [ConfirmationService],
  imports: [
    CommonModule, ReactiveFormsModule,
    TableModule, ButtonModule, DialogModule,
    InputTextModule, InputNumberModule, ColorPickerModule,
    ConfirmDialogModule,
  ],
  template: `
    <p-confirmdialog />
    <div class="flex flex-col gap-4">
      <div class="flex items-center gap-4">
        <h1 class="text-2xl font-bold flex-1">{{ t.referentiels.membre.titre }}</h1>
        @if (contexte.estEditor()) {
          <p-button icon="pi pi-plus" [label]="t.commun.creer" (click)="ouvrirCreation()" />
        }
      </div>

      <p-table [value]="membres()" styleClass="p-datatable-sm p-datatable-striped" [loading]="chargement()">
        <ng-template #header>
          <tr>
            <th>{{ t.referentiels.membre.couleur }}</th>
            <th pSortableColumn="nom">{{ t.referentiels.membre.nom }} <p-sort-icon field="nom" /></th>
            <th class="text-right">{{ t.referentiels.membre.ordre }}</th>
            <th class="text-center">{{ t.referentiels.membre.actif }}</th>
            <th></th>
          </tr>
        </ng-template>
        <ng-template #body let-m>
          <tr>
            <td>
              <span class="inline-block w-5 h-5 rounded-full border border-surface-300"
                    [style.background-color]="m.couleur"></span>
            </td>
            <td class="font-medium">{{ m.nom }}</td>
            <td class="text-right text-surface-500">{{ m.ordre }}</td>
            <td class="text-center">
              <i [class]="m.actif ? 'pi pi-check text-green-500' : 'pi pi-times text-surface-300'"></i>
            </td>
            <td>
              <div class="flex gap-1">
                @if (contexte.estEditor()) {
                  <p-button icon="pi pi-pencil" [text]="true" size="small" (click)="ouvrirEdition(m)" />
                  <p-button icon="pi pi-trash" [text]="true" severity="danger" size="small" (click)="supprimer(m)" />
                }
              </div>
            </td>
          </tr>
        </ng-template>
        <ng-template #emptymessage>
          <tr><td colspan="5" class="text-center py-8 text-surface-400">{{ t.commun.aucunResultat }}</td></tr>
        </ng-template>
      </p-table>
    </div>

    <p-dialog [(visible)]="dialogVisible" [header]="membreEnEdition ? t.commun.modifier : t.commun.creer"
              [modal]="true" styleClass="w-full max-w-md">
      <form [formGroup]="form" class="flex flex-col gap-4 pt-2">
        <div class="flex flex-col gap-1">
          <label class="text-sm font-medium">{{ t.referentiels.membre.nom }} *</label>
          <input pInputText formControlName="nom" class="w-full" />
        </div>
        <div class="flex flex-col gap-1">
          <label class="text-sm font-medium">{{ t.referentiels.membre.couleur }}</label>
          <p-colorpicker appendTo="body" formControlName="couleur" />
        </div>
        <div class="flex flex-col gap-1">
          <label class="text-sm font-medium">{{ t.referentiels.membre.ordre }}</label>
          <p-inputnumber formControlName="ordre" [min]="1" [max]="99" class="w-full" />
        </div>
      </form>
      <ng-template #footer>
        <p-button [label]="t.commun.annuler" severity="secondary" (click)="dialogVisible = false" />
        <p-button [label]="t.commun.enregistrer" (click)="enregistrer()" [disabled]="form.invalid" />
      </ng-template>
    </p-dialog>
  `,
})
export class MembresComponent implements OnInit {
  readonly t = FR;
  contexte = inject(ContexteService);
  private membreSvc = inject(MembreService);
  private toast = inject(MessageService);
  private confirm = inject(ConfirmationService);
  private fb = inject(FormBuilder);

  membres = signal<MembreDto[]>([]);
  chargement = signal(false);
  dialogVisible = false;
  membreEnEdition: MembreDto | null = null;

  form = this.fb.group({
    nom: ['', Validators.required],
    couleur: ['#6366f1'],
    ordre: [1, Validators.required],
  });

  // effect() en initialiseur de champ = contexte d'injection valide ✓
  private readonly _chargerEffect = effect(() => {
    if (this.contexte.foyerId()) this.charger();
  });

  ngOnInit(): void {}

  charger(): void {
    const foyerId = this.contexte.foyerId();
    if (!foyerId) return;
    this.chargement.set(true);
    this.membreSvc.lister(foyerId).subscribe({
      next: m => { this.membres.set(m); this.chargement.set(false); },
      error: () => this.chargement.set(false),
    });
  }

  ouvrirCreation(): void {
    this.membreEnEdition = null;
    const ordre = this.membres().length > 0 ? Math.max(...this.membres().map(m => m.ordre)) + 1 : 1;
    this.form.reset({ nom: '', couleur: '#6366f1', ordre });
    this.dialogVisible = true;
  }

  ouvrirEdition(m: MembreDto): void {
    this.membreEnEdition = m;
    this.form.patchValue({ nom: m.nom, couleur: m.couleur, ordre: m.ordre });
    this.dialogVisible = true;
  }

  enregistrer(): void {
    const foyerId = this.contexte.foyerId()!;
    const v = this.form.value;
    // p-colorpicker format hex retourne parfois sans '#' → normalisation défensive
    const raw = v.couleur ?? '6366f1';
    const couleur = raw.startsWith('#') ? raw : '#' + raw;
    const req = { nom: v.nom!, couleur, ordre: v.ordre! };
    const obs = this.membreEnEdition
      ? this.membreSvc.modifier(foyerId, this.membreEnEdition.id, req)
      : this.membreSvc.creer(foyerId, req);
    obs.subscribe({
      next: () => {
        this.toast.add({ severity: 'success', summary: FR.commun.succes });
        this.dialogVisible = false;
        this.charger();
      },
      error: (e) => this.toast.add({ severity: 'error', summary: FR.commun.erreur, detail: e?.error?.message }),
    });
  }

  supprimer(m: MembreDto): void {
    this.confirm.confirm({
      message: FR.commun.confirmerSuppression,
      accept: () => this.membreSvc.supprimer(this.contexte.foyerId()!, m.id).subscribe({
        next: () => { this.toast.add({ severity: 'success', summary: FR.commun.succes }); this.charger(); },
        error: () => this.toast.add({ severity: 'error', summary: FR.commun.suppressionImpossible }),
      }),
    });
  }
}
