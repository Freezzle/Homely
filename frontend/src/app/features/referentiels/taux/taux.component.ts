import { Component, inject, signal, OnInit, effect } from '@angular/core';
import { CommonModule, UpperCasePipe } from '@angular/common';
import { FormBuilder, Validators, ReactiveFormsModule } from '@angular/forms';
import { TableModule } from 'primeng/table';
import { ButtonModule } from 'primeng/button';
import { DialogModule } from 'primeng/dialog';
import { InputTextModule } from 'primeng/inputtext';
import { InputNumberModule } from 'primeng/inputnumber';
import { TagModule } from 'primeng/tag';
import { ConfirmDialogModule } from 'primeng/confirmdialog';
import { MessageService, ConfirmationService } from 'primeng/api';
import { ContexteService } from '../../../core/services/contexte.service';
import { TauxChangeService } from '../../../core/services/referentiel.service';
import { TauxChangeDto } from '../../../core/models/api.models';
import { I18nService } from '../../../core/i18n/i18n.service';

/** T10.2 — Taux de change (CRUD upsert) */
@Component({
  selector: 'app-taux',
  standalone: true,
  providers: [ConfirmationService],
  imports: [
    CommonModule, ReactiveFormsModule, UpperCasePipe,
    TableModule, ButtonModule, DialogModule, TagModule,
    InputTextModule, InputNumberModule,
    ConfirmDialogModule,
  ],
  template: `
    <p-confirmdialog />
    <div class="flex flex-col gap-4">
      <div class="flex items-center gap-4">
        <h1 class="text-2xl font-bold flex-1">{{ t.referentiels.taux.titre }}</h1>
        <p-tag [value]="t.foyer.deviseBase + ' : ' + contexte.deviseBase()" severity="info" />
        @if (contexte.estEditor()) {
          <p-button icon="pi pi-plus" [label]="t.commun.creer" (click)="ouvrirCreation()" />
        }
      </div>

      <p-table [value]="taux()" class="p-datatable-sm p-datatable-striped" [loading]="chargement()">
        <ng-template #header>
          <tr>
            <th>{{ t.referentiels.taux.devise }}</th>
            <th class="text-right">{{ t.referentiels.taux.tauxVersBase }}</th>
            <th></th>
          </tr>
        </ng-template>
        <ng-template #body let-tx>
          <tr>
            <td class="font-medium">{{ tx.devise }}</td>
            <td class="text-right">{{ tx.tauxVersBase }}</td>
            <td>
              <div class="flex gap-1">
                @if (contexte.estEditor()) {
                  <p-button icon="pi pi-pencil" [text]="true" size="small" (click)="ouvrirEdition(tx)" />
                  <p-button icon="pi pi-trash" [text]="true" severity="danger" size="small" (click)="supprimer(tx)" />
                }
              </div>
            </td>
          </tr>
        </ng-template>
        <ng-template #emptymessage>
          <tr><td colspan="3" class="text-center py-8 text-surface-400">{{ t.commun.aucunResultat }}</td></tr>
        </ng-template>
      </p-table>
    </div>

    <p-dialog [(visible)]="dialogVisible" [header]="tauxEnEdition ? t.commun.modifier : t.commun.creer"
              [modal]="true" class="w-full max-w-sm">
      <form [formGroup]="form" class="flex flex-col gap-4 pt-2">
        <div class="flex flex-col gap-1">
          <label class="text-sm font-medium">{{ t.referentiels.taux.devise }} *</label>
          <input pInputText formControlName="devise" class="w-full"
                 [readonly]="!!tauxEnEdition" placeholder="EUR, USD…" />
        </div>
        <div class="flex flex-col gap-1">
          <label class="text-sm font-medium">{{ t.referentiels.taux.tauxVersBase }} *</label>
          <p-inputnumber formControlName="tauxVersBase" mode="decimal" [minFractionDigits]="6" [maxFractionDigits]="6"
                         [min]="0.000001" class="w-full" />
          <small class="text-surface-400">1 {{ (form.value.devise || '?') | uppercase }} = valeur {{ contexte.deviseBase() }}</small>
        </div>
      </form>
      <ng-template #footer>
        <p-button [label]="t.commun.annuler" severity="secondary" (click)="dialogVisible = false" />
        <p-button [label]="t.commun.enregistrer" (click)="enregistrer()" [disabled]="form.invalid" />
      </ng-template>
    </p-dialog>
  `,
})
export class TauxComponent implements OnInit {
  private readonly i18n = inject(I18nService);
  readonly t = this.i18n.translations();
  contexte = inject(ContexteService);
  private tauxSvc = inject(TauxChangeService);
  private toast = inject(MessageService);
  private confirm = inject(ConfirmationService);
  private fb = inject(FormBuilder);

  taux = signal<TauxChangeDto[]>([]);
  chargement = signal(false);
  dialogVisible = false;
  tauxEnEdition: TauxChangeDto | null = null;

  form = this.fb.group({
    devise: ['', [Validators.required, Validators.pattern(/^[A-Za-z]{3}$/)]],
    tauxVersBase: [1, [Validators.required, Validators.min(0.000001)]],
  });

  private readonly _chargerEffect = effect(() => {
    if (this.contexte.foyerId()) this.charger();
  });

  ngOnInit(): void {}

  charger(): void {
    const foyerId = this.contexte.foyerId();
    if (!foyerId) return;
    this.chargement.set(true);
    this.tauxSvc.lister(foyerId).subscribe({
      next: t => { this.taux.set(t); this.chargement.set(false); },
      error: () => this.chargement.set(false),
    });
  }

  ouvrirCreation(): void {
    this.tauxEnEdition = null;
    this.form.reset({ devise: '', tauxVersBase: 1 });
    this.form.get('devise')?.enable();
    this.dialogVisible = true;
  }

  ouvrirEdition(tx: TauxChangeDto): void {
    this.tauxEnEdition = tx;
    this.form.patchValue({ devise: tx.devise, tauxVersBase: tx.tauxVersBase });
    this.dialogVisible = true;
  }

  enregistrer(): void {
    const foyerId = this.contexte.foyerId()!;
    const v = this.form.value;
    const req = { devise: v.devise!.toUpperCase(), tauxVersBase: v.tauxVersBase! };
    this.tauxSvc.creerOuModifier(foyerId, req).subscribe({
      next: () => { this.toast.add({ severity: 'success', summary: this.t.commun.succes }); this.dialogVisible = false; this.charger(); },
      error: (e) => this.toast.add({ severity: 'error', summary: this.t.commun.erreur, detail: e?.error?.message }),
    });
  }

  supprimer(tx: TauxChangeDto): void {
    this.confirm.confirm({
      message: this.t.commun.confirmerSuppression,
      accept: () => this.tauxSvc.supprimer(this.contexte.foyerId()!, tx.id).subscribe({
        next: () => { this.toast.add({ severity: 'success', summary: this.t.commun.succes }); this.charger(); },
        error: () => this.toast.add({ severity: 'error', summary: this.t.commun.erreur }),
      }),
    });
  }
}





