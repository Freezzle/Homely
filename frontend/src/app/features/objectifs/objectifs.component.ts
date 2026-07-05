import { Component, inject, signal, OnInit, effect } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, Validators, ReactiveFormsModule } from '@angular/forms';
import { CardModule } from 'primeng/card';
import { ButtonModule } from 'primeng/button';
import { DialogModule } from 'primeng/dialog';
import { InputTextModule } from 'primeng/inputtext';
import { InputNumberModule } from 'primeng/inputnumber';
import { SelectModule } from 'primeng/select';
import { DatePickerModule } from 'primeng/datepicker';
import { ProgressBarModule } from 'primeng/progressbar';
import { SkeletonModule } from 'primeng/skeleton';
import { ConfirmDialogModule } from 'primeng/confirmdialog';
import { TagModule } from 'primeng/tag';
import { MessageService, ConfirmationService } from 'primeng/api';
import { ContexteService } from '../../core/services/contexte.service';
import { ObjectifService } from '../../core/services/scenario-poste.service';
import { CompteService, ActifService } from '../../core/services/referentiel.service';
import { ObjectifDto, CompteDto, ActifDto } from '../../core/models/api.models';
import { MontantPipe, PctPipe, DateFrPipe } from '../../core/pipes/format.pipes';
import { FR } from '../../core/i18n/fr';

/** T10.7 — Écran Objectifs */
@Component({
  selector: 'app-objectifs',
  standalone: true,
  providers: [ConfirmationService],
  imports: [
    CommonModule, ReactiveFormsModule,
    CardModule, ButtonModule, DialogModule, TagModule,
    InputTextModule, InputNumberModule, SelectModule, DatePickerModule,
    ProgressBarModule, SkeletonModule, ConfirmDialogModule,
    MontantPipe, PctPipe, DateFrPipe,
  ],
  template: `
    <p-confirmdialog />
    <div class="flex flex-col gap-4">
      <div class="flex items-center gap-4">
        <h1 class="text-2xl font-bold flex-1">{{ t.objectif.titre }}</h1>
        @if (contexte.estEditor()) {
          <p-button icon="pi pi-plus" [label]="t.commun.creer" (click)="ouvrirCreation()" />
        }
      </div>

      @if (chargement()) {
        <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
          @for (i of [1,2,3,4]; track i) { <p-skeleton height="160px" /> }
        </div>
      } @else {
        <div class="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          @for (o of objectifs(); track o.id) {
            <p-card styleClass="h-full">
              <div class="flex flex-col gap-3">
                <div class="flex items-start justify-between">
                  <div>
                    <div class="font-semibold text-lg">{{ o.libelle }}</div>
                    @if (o.echeance) {
                      <div class="text-sm text-surface-500">{{ o.echeance | dateFr }}</div>
                    }
                  </div>
                  @if (contexte.estEditor()) {
                    <div class="flex gap-1">
                      <p-button icon="pi pi-pencil" [text]="true" size="small" (click)="ouvrirEdition(o)" />
                      <p-button icon="pi pi-trash" [text]="true" severity="danger" size="small" (click)="supprimer(o)" />
                    </div>
                  }
                </div>

                <!-- Progression -->
                <div>
                  <div class="flex justify-between text-sm mb-1">
                    <span>{{ o.soldeActuel | montant }}</span>
                    <span class="text-surface-500">/ {{ o.montantCible | montant }}</span>
                  </div>
                  <p-progressbar [value]="o.progression * 100" styleClass="h-2" />
                  <div class="text-xs text-surface-400 mt-1">{{ o.progression | pct:1 }}</div>
                </div>

                <!-- Épargne requise -->
                @if (o.epargneRequise > 0) {
                  <div class="text-sm bg-surface-50 dark:bg-surface-800 rounded p-2">
                    <span class="text-surface-500">{{ t.objectif.epargneRequise }} :</span>
                    <span class="font-semibold ml-1">{{ o.epargneRequise | montant }}</span>
                  </div>
                }

                <!-- Compte ou actif lié -->
                @if (o.compteId) {
                  <p-tag [value]="libelleCompte(o.compteId)" icon="pi pi-credit-card" severity="secondary" />
                }
                @if (o.actifId) {
                  <p-tag [value]="libelleActif(o.actifId)" icon="pi pi-chart-line" severity="secondary" />
                }
              </div>
            </p-card>
          }
          @if (objectifs().length === 0) {
            <div class="col-span-full text-center py-12 text-surface-400">
              <i class="pi pi-flag text-4xl mb-4 block"></i>
              <p>{{ t.commun.aucunResultat }}</p>
            </div>
          }
        </div>
      }
    </div>

    <p-dialog [(visible)]="dialogVisible" [header]="objectifEnEdition ? t.commun.modifier : t.commun.creer"
              [modal]="true" styleClass="w-full max-w-md">
      <form [formGroup]="form" class="flex flex-col gap-4 pt-2">
        <div class="flex flex-col gap-1">
          <label class="text-sm font-medium">{{ t.objectif.libelle }} *</label>
          <input pInputText formControlName="libelle" class="w-full" />
        </div>
        <div class="grid grid-cols-2 gap-4">
          <div class="flex flex-col gap-1">
            <label class="text-sm font-medium">{{ t.objectif.montantCible }} *</label>
            <p-inputnumber formControlName="montantCible" mode="decimal" [minFractionDigits]="2" class="w-full" />
          </div>
          <div class="flex flex-col gap-1">
            <label class="text-sm font-medium">{{ t.objectif.echeance }}</label>
            <p-datepicker appendTo="body" formControlName="echeance" dateFormat="dd/mm/yy" [showButtonBar]="true" styleClass="w-full" />
          </div>
        </div>
        <!-- Compte ou actif (XOR) -->
        <div class="flex flex-col gap-1">
          <label class="text-sm font-medium">{{ t.objectif.compte }}</label>
          <p-select appendTo="body" formControlName="compteId" [options]="comptes()" optionLabel="libelle" optionValue="id"
                    [showClear]="true" styleClass="w-full" (onChange)="onCompteChange($event)" />
        </div>
        <div class="flex flex-col gap-1">
          <label class="text-sm font-medium">{{ t.objectif.actif }}</label>
          <p-select appendTo="body" formControlName="actifId" [options]="actifs()" optionLabel="libelle" optionValue="id"
                    [showClear]="true" styleClass="w-full" (onChange)="onActifChange($event)" />
        </div>
      </form>
      <ng-template pTemplate="footer">
        <p-button [label]="t.commun.annuler" severity="secondary" (click)="dialogVisible = false" />
        <p-button [label]="t.commun.enregistrer" (click)="enregistrer()" [disabled]="form.invalid" />
      </ng-template>
    </p-dialog>
  `,
})
export class ObjectifsComponent implements OnInit {
  readonly t = FR;
  contexte = inject(ContexteService);
  private objectifSvc = inject(ObjectifService);
  private compteSvc = inject(CompteService);
  private actifSvc = inject(ActifService);
  private toast = inject(MessageService);
  private confirm = inject(ConfirmationService);
  private fb = inject(FormBuilder);

  objectifs = signal<ObjectifDto[]>([]);
  comptes = signal<CompteDto[]>([]);
  actifs = signal<ActifDto[]>([]);
  chargement = signal(false);
  dialogVisible = false;
  objectifEnEdition: ObjectifDto | null = null;

  form = this.fb.group({
    libelle: ['', Validators.required],
    montantCible: [0, [Validators.required, Validators.min(0.01)]],
    echeance: [null as Date | null],
    compteId: [null as string | null],
    actifId: [null as string | null],
  });

  private readonly _chargerEffect = effect(() => {
    const foyerId = this.contexte.foyerId();
    const scenarioId = this.contexte.scenarioId();
    if (foyerId) {
      this.compteSvc.lister(foyerId).subscribe(c => this.comptes.set(c));
      this.actifSvc.lister(foyerId).subscribe(a => this.actifs.set(a));
    }
    if (foyerId && scenarioId) this.charger();
  });

  ngOnInit(): void {}

  charger(): void {
    const foyerId = this.contexte.foyerId();
    const scenarioId = this.contexte.scenarioId();
    if (!foyerId || !scenarioId) return;
    this.chargement.set(true);
    this.objectifSvc.lister(foyerId, scenarioId).subscribe({
      next: o => { this.objectifs.set(o); this.chargement.set(false); },
      error: () => this.chargement.set(false),
    });
  }

  libelleCompte(id: string): string {
    return this.comptes().find(c => c.id === id)?.libelle ?? id;
  }

  libelleActif(id: string): string {
    return this.actifs().find(a => a.id === id)?.libelle ?? id;
  }

  ouvrirCreation(): void {
    this.objectifEnEdition = null;
    this.form.reset({ libelle: '', montantCible: 0, echeance: null, compteId: null, actifId: null });
    this.dialogVisible = true;
  }

  ouvrirEdition(o: ObjectifDto): void {
    this.objectifEnEdition = o;
    this.form.patchValue({
      libelle: o.libelle,
      montantCible: o.montantCible,
      echeance: o.echeance ? new Date(o.echeance) : null,
      compteId: o.compteId ?? null,
      actifId: o.actifId ?? null,
    });
    this.dialogVisible = true;
  }

  onCompteChange(event: any): void {
    if (event.value) this.form.get('actifId')?.setValue(null);
  }

  onActifChange(event: any): void {
    if (event.value) this.form.get('compteId')?.setValue(null);
  }

  enregistrer(): void {
    const foyerId = this.contexte.foyerId()!;
    const scenarioId = this.contexte.scenarioId()!;
    const v = this.form.value;
    const req = {
      libelle: v.libelle!,
      montantCible: v.montantCible!,
      echeance: v.echeance ? (v.echeance as Date).toISOString().substring(0, 10) : undefined,
      compteId: v.compteId ?? undefined,
      actifId: v.actifId ?? undefined,
    };
    const obs = this.objectifEnEdition
      ? this.objectifSvc.modifier(foyerId, scenarioId, this.objectifEnEdition.id, req)
      : this.objectifSvc.creer(foyerId, scenarioId, req);
    obs.subscribe({
      next: () => { this.toast.add({ severity: 'success', summary: FR.commun.succes }); this.dialogVisible = false; this.charger(); },
      error: (e) => this.toast.add({ severity: 'error', summary: FR.commun.erreur, detail: e?.error?.message }),
    });
  }

  supprimer(o: ObjectifDto): void {
    this.confirm.confirm({
      message: FR.commun.confirmerSuppression,
      accept: () => this.objectifSvc.supprimer(this.contexte.foyerId()!, this.contexte.scenarioId()!, o.id).subscribe({
        next: () => { this.toast.add({ severity: 'success', summary: FR.commun.succes }); this.charger(); },
        error: () => this.toast.add({ severity: 'error', summary: FR.commun.erreur }),
      }),
    });
  }
}

