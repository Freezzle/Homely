import { Component, inject, signal, OnInit, effect } from '@angular/core';
import { CommonModule } from '@angular/common';
import {FormBuilder, Validators, ReactiveFormsModule, FormsModule} from '@angular/forms';
import { TableModule } from 'primeng/table';
import { ButtonModule } from 'primeng/button';
import { DialogModule } from 'primeng/dialog';
import { InputTextModule } from 'primeng/inputtext';
import { InputNumberModule } from 'primeng/inputnumber';
import { SelectModule } from 'primeng/select';
import { TagModule } from 'primeng/tag';
import { MessageModule } from 'primeng/message';
import { MessageService } from 'primeng/api';
import { ContexteService } from '../../../core/services/contexte.service';
import { CategorieService } from '../../../core/services/referentiel.service';
import { CategorieDto, TypeCategorie } from '../../../core/models/api.models';
import { FR } from '../../../core/i18n/fr';

/** T10.2 — CRUD Catégories */
@Component({
  selector: 'app-categories',
  standalone: true,
             imports: [
               CommonModule, ReactiveFormsModule,
               TableModule, ButtonModule, DialogModule, TagModule, MessageModule,
               InputTextModule, InputNumberModule, SelectModule, FormsModule
             ],
  template: `
    <div class="flex flex-col gap-4">
      <div class="flex items-center gap-4">
        <h1 class="text-2xl font-bold flex-1">{{ t.referentiels.categorie.titre }}</h1>
        @if (contexte.estEditor()) {
          <p-button icon="pi pi-plus" [label]="t.commun.creer" (click)="ouvrirCreation()" />
        }
      </div>

      <p-table [value]="categories()" styleClass="p-datatable-sm p-datatable-striped" [loading]="chargement()">
        <ng-template pTemplate="header">
          <tr>
            <th pSortableColumn="libelle">{{ t.referentiels.categorie.libelle }} <p-sortIcon field="libelle" /></th>
            <th>{{ t.referentiels.categorie.typePoste }}</th>
            <th class="text-right">{{ t.referentiels.categorie.ordre }}</th>
            <th class="text-center">{{ t.referentiels.categorie.systeme }}</th>
            <th></th>
          </tr>
        </ng-template>
        <ng-template pTemplate="body" let-c>
          <tr>
            <td class="font-medium">{{ c.libelle }}</td>
            <td>
              <p-tag [value]="c.typePoste" [severity]="c.typePoste === 'REVENU' ? 'success' : c.typePoste === 'CHARGE' ? 'danger' : 'info'" />
            </td>
            <td class="text-right text-surface-500">{{ c.ordre }}</td>
            <td class="text-center">
              <i [class]="c.systeme ? 'pi pi-lock text-surface-400' : 'pi pi-user text-primary'"></i>
            </td>
            <td>
              <div class="flex gap-1">
                @if (contexte.estEditor() && !c.systeme) {
                  <p-button icon="pi pi-pencil" [text]="true" size="small" (click)="ouvrirEdition(c)" />
                  <p-button icon="pi pi-trash" [text]="true" severity="danger" size="small" (click)="ouvrirSuppression(c)" />
                }
              </div>
            </td>
          </tr>
        </ng-template>
        <ng-template pTemplate="emptymessage">
          <tr><td colspan="5" class="text-center py-8 text-surface-400">{{ t.commun.aucunResultat }}</td></tr>
        </ng-template>
      </p-table>
    </div>

    <!-- Dialog création / édition -->
    <p-dialog [(visible)]="dialogVisible" [header]="categorieEnEdition ? t.commun.modifier : t.commun.creer"
              [modal]="true" styleClass="w-full max-w-md">
      <form [formGroup]="form" class="flex flex-col gap-4 pt-2">
        <div class="flex flex-col gap-1">
          <label class="text-sm font-medium">{{ t.referentiels.categorie.libelle }} *</label>
          <input pInputText formControlName="libelle" class="w-full" />
        </div>
        <div class="grid grid-cols-2 gap-4">
          <div class="flex flex-col gap-1">
            <label class="text-sm font-medium">{{ t.referentiels.categorie.typePoste }}</label>
            <p-select appendTo="body" formControlName="typePoste" [options]="typeOptions" optionLabel="label" optionValue="value" styleClass="w-full" />
          </div>
          <div class="flex flex-col gap-1">
            <label class="text-sm font-medium">{{ t.referentiels.categorie.ordre }}</label>
            <p-inputnumber formControlName="ordre" [min]="1" class="w-full" />
          </div>
        </div>
      </form>
      <ng-template pTemplate="footer">
        <p-button [label]="t.commun.annuler" severity="secondary" (click)="dialogVisible = false" />
        <p-button [label]="t.commun.enregistrer" (click)="enregistrer()" [disabled]="form.invalid" />
      </ng-template>
    </p-dialog>

    <!-- Dialog suppression avec migration optionnelle -->
    <p-dialog [(visible)]="suppressionDialogVisible"
              [header]="t.referentiels.categorie.dialogSuppressionTitre"
              [modal]="true" styleClass="w-full max-w-lg">
      @if (categorieASupprimer) {
        <div class="flex flex-col gap-4 pt-2">
          <p-message severity="warn" styleClass="w-full">
            <span>{{ t.referentiels.categorie.dialogSuppressionInfo }}</span>
          </p-message>

          <div class="flex flex-col gap-1">
            <label class="text-sm font-medium">{{ t.referentiels.categorie.migrerVers }}</label>
            <p-select
              appendTo="body"
              [(ngModel)]="migrerVersCategorieId"
              [options]="categoriesMigration()"
              optionLabel="libelle"
              optionValue="id"
              [showClear]="true"
              [placeholder]="t.referentiels.categorie.migrerVersPlaceholder"
              styleClass="w-full" />
          </div>
        </div>
      }
      <ng-template pTemplate="footer">
        <p-button [label]="t.commun.annuler" severity="secondary" (click)="suppressionDialogVisible = false" />
        <p-button [label]="t.commun.supprimer" severity="danger" [loading]="suppressionEnCours()" (click)="confirmerSuppression()" />
      </ng-template>
    </p-dialog>
  `,
})
export class CategoriesComponent implements OnInit {
  readonly t = FR;
  contexte = inject(ContexteService);
  private categorieSvc = inject(CategorieService);
  private toast = inject(MessageService);
  private fb = inject(FormBuilder);

  categories = signal<CategorieDto[]>([]);
  chargement = signal(false);
  suppressionEnCours = signal(false);

  // Dialog création/édition
  dialogVisible = false;
  categorieEnEdition: CategorieDto | null = null;

  // Dialog suppression
  suppressionDialogVisible = false;
  categorieASupprimer: CategorieDto | null = null;
  migrerVersCategorieId: string | null = null;

  /** Catégories disponibles pour la migration (même typePoste, hors catégorie à supprimer) */
  categoriesMigration = signal<CategorieDto[]>([]);

  private readonly _chargerEffect = effect(() => {
    if (this.contexte.foyerId()) this.charger();
  });

  typeOptions: { label: string; value: TypeCategorie }[] = [
    { label: 'Revenu', value: 'REVENU' },
    { label: 'Charge', value: 'CHARGE' },
    { label: 'Réserve', value: 'RESERVE' },
  ];

  form = this.fb.group({
    libelle: ['', Validators.required],
    typePoste: ['REVENU' as TypeCategorie, Validators.required],
    ordre: [1, Validators.required],
  });

  ngOnInit(): void {}

  charger(): void {
    const foyerId = this.contexte.foyerId();
    if (!foyerId) return;
    this.chargement.set(true);
    this.categorieSvc.lister(foyerId).subscribe({
      next: c => { this.categories.set(c); this.chargement.set(false); },
      error: () => this.chargement.set(false),
    });
  }

  ouvrirCreation(): void {
    this.categorieEnEdition = null;
    const ordre = this.categories().filter(c => !c.systeme).length + 1;
    this.form.reset({ libelle: '', typePoste: 'REVENU', ordre });
    this.dialogVisible = true;
  }

  ouvrirEdition(c: CategorieDto): void {
    this.categorieEnEdition = c;
    this.form.patchValue({ libelle: c.libelle, typePoste: c.typePoste, ordre: c.ordre });
    this.dialogVisible = true;
  }

  enregistrer(): void {
    const foyerId = this.contexte.foyerId()!;
    const v = this.form.value;
    const req = { libelle: v.libelle!, typePoste: v.typePoste as TypeCategorie, ordre: v.ordre! };
    const obs = this.categorieEnEdition
      ? this.categorieSvc.modifier(foyerId, this.categorieEnEdition.id, req)
      : this.categorieSvc.creer(foyerId, req);
    obs.subscribe({
      next: () => { this.toast.add({ severity: 'success', summary: FR.commun.succes }); this.dialogVisible = false; this.charger(); },
      error: (e) => this.toast.add({ severity: 'error', summary: FR.commun.erreur, detail: e?.error?.message }),
    });
  }

  ouvrirSuppression(c: CategorieDto): void {
    this.categorieASupprimer = c;
    this.migrerVersCategorieId = null;
    // Proposer uniquement les catégories du même typePoste (hors celle à supprimer)
    this.categoriesMigration.set(
      this.categories().filter(cat => cat.typePoste === c.typePoste && cat.id !== c.id)
    );
    this.suppressionDialogVisible = true;
  }

  confirmerSuppression(): void {
    const foyerId = this.contexte.foyerId()!;
    const c = this.categorieASupprimer!;
    this.suppressionEnCours.set(true);
    this.categorieSvc
      .supprimer(foyerId, c.id, this.migrerVersCategorieId ?? undefined)
      .subscribe({
        next: () => {
          this.toast.add({ severity: 'success', summary: FR.commun.succes });
          this.suppressionDialogVisible = false;
          this.suppressionEnCours.set(false);
          this.charger();
        },
        error: () => {
          this.toast.add({ severity: 'error', summary: FR.commun.suppressionImpossible });
          this.suppressionEnCours.set(false);
        },
      });
  }
}
