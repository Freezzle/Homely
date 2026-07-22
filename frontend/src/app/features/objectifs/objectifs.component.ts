import { Component, inject, signal, computed, OnInit, effect } from '@angular/core';
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
import { AvatarModule } from 'primeng/avatar';
import { AvatarGroupModule } from 'primeng/avatargroup';
import { TooltipModule } from 'primeng/tooltip';
import { MessageService, ConfirmationService } from 'primeng/api';
import { ContexteService } from '../../core/services/contexte.service';
import { ObjectifService } from '../../core/services/scenario-poste.service';
import { CompteService, ActifService, CategorieService } from '../../core/services/referentiel.service';
import { ObjectifDto, CompteDto, ActifDto, CategorieDto } from '../../core/models/api.models';
import { MontantPipe, DateFrPipe } from '../../core/pipes/format.pipes';
import { FR } from '../../core/i18n/fr';

type StatutObjectif = 'DANS_LES_TEMPS' | 'EN_RETARD' | 'ATTEINT';

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
    AvatarModule, AvatarGroupModule, TooltipModule,
    MontantPipe, DateFrPipe,
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
          @for (i of [1,2,3,4]; track i) { <p-skeleton height="220px" /> }
        </div>
      } @else {
        <div class="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          @for (o of objectifsData(); track o.id) {
            <p-card styleClass="h-full" [class.opacity-60]="o.statut === 'ATTEINT'">
              <ng-template #title>
                <div class="flex items-center justify-between gap-2">
                  <div class="flex items-center gap-2 min-w-0">
                    <i class="pi pi-flag text-surface-400 shrink-0"></i>
                    <span class="font-bold truncate">{{ o.libelle }}</span>
                  </div>
                  <p-tag [value]="t.objectif.statuts[o.statut]" [rounded]="true"
                         [severity]="o.statut === 'EN_RETARD' ? 'warn' : 'success'"/>
                </div>
              </ng-template>
              <ng-template #subtitle>
                <span class="text-xs">
                  @if (o.echeance) { {{ t.objectif.echeance }} {{ o.echeance | dateFr }} · }
                  @if (o.compteLibelle) { {{ o.compteLibelle }} · }
                  @if (o.actifLibelle) { {{ o.actifLibelle }} · }
                  {{ o.categorieLibelle }}
                </span>
              </ng-template>

              <div class="flex flex-col gap-3">
                @if (contexte.estEditor()) {
                  <div class="flex justify-end gap-1 -mt-2">
                    <p-button icon="pi pi-pencil" [text]="true" size="small" (click)="ouvrirEdition(o)" />
                    <p-button icon="pi pi-trash" [text]="true" severity="danger" size="small" (click)="supprimer(o)" />
                  </div>
                }

                <!-- Montants regroupés -->
                <div class="flex items-baseline gap-1.5">
                  <span class="text-xl font-bold tabular-nums">{{ o.soldeActuel | montant }}</span>
                  <span class="text-surface-400">/</span>
                  <span class="text-surface-400 tabular-nums">{{ o.montantCible | montant }} ({{ t.objectif.cible }})</span>
                </div>

                <!-- Progression + jalons -->
                <div class="relative">
                  <p-progressbar [value]="o.progression * 100" [showValue]="false" styleClass="h-2"/>
                  <div class="absolute inset-0 flex items-center pointer-events-none">
                    @for (jalon of [25, 50, 75]; track jalon) {
                      <span class="absolute w-2.5 h-2.5 rounded-full border-2 -translate-x-1/2 pointer-events-auto"
                            [style.left.%]="jalon"
                            [class.bg-surface-0]="o.progression * 100 < jalon"
                            [class.border-surface-400]="o.progression * 100 < jalon"
                            [class.bg-surface-700]="o.progression * 100 >= jalon"
                            [class.border-surface-700]="o.progression * 100 >= jalon"
                            [class.dark:bg-surface-200]="o.progression * 100 >= jalon"
                            [class.dark:border-surface-200]="o.progression * 100 >= jalon"
                            [pTooltip]="t.objectif.jalon + ' ' + jalon + ' %'" tooltipPosition="top"></span>
                    }
                  </div>
                </div>

                <!-- Note conditionnelle si en retard -->
                @if (o.statut === 'EN_RETARD') {
                  <div class="text-xs text-surface-400">
                    {{ t.objectif.aCeRythme }} {{ o.echeance | dateFr }}
                    {{ t.objectif.verserPourTenir }} {{ o.epargneRequise | montant }}{{ t.objectif.parMoisPourTenirEcheance }}
                  </div>
                }

                <!-- Membres attachés + mensualité -->
                <div class="flex items-center justify-between">
                  @if (o.membresAttaches.length > 0) {
                    <p-avatargroup>
                      @for (m of o.membresAttaches; track m.id) {
                        <p-avatar [label]="m.initiales" shape="circle" size="normal"
                                  [style.background-color]="m.couleur" styleClass="text-white text-xs font-semibold"
                                  [pTooltip]="m.nom" tooltipPosition="top"/>
                      }
                    </p-avatargroup>
                  } @else {
                    <span></span>
                  }
                  <span class="text-sm font-semibold text-surface-500">
                    {{ o.statut === 'ATTEINT' ? t.objectif.termine : (o.epargneRequise | montant) + t.objectif.parMois }}
                  </span>
                </div>
              </div>

              <ng-template #footer>
                <div class="flex flex-wrap gap-2">
                  @if (o.statut === 'ATTEINT') {
                    <p-button [label]="t.objectif.actions.convertirReserve" size="small" (click)="actionAVenir()"/>
                    <p-button [label]="t.objectif.actions.archiver" severity="secondary" [outlined]="true" size="small" (click)="actionAVenir()"/>
                  } @else {
                    <p-button [label]="t.objectif.actions.recalibrer" size="small" (click)="actionAVenir()"/>
                    <p-button [label]="t.objectif.actions.verserExtra" severity="secondary" [outlined]="true" size="small" (click)="actionAVenir()"/>
                    <p-button [label]="t.objectif.actions.mettreEnPause" severity="secondary" [outlined]="true" size="small" (click)="actionAVenir()"/>
                  }
                </div>
              </ng-template>
            </p-card>
          }
          @if (objectifsData().length === 0) {
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
      <ng-template #footer>
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
  private categorieSvc = inject(CategorieService);
  private toast = inject(MessageService);
  private confirm = inject(ConfirmationService);
  private fb = inject(FormBuilder);

  objectifs = signal<ObjectifDto[]>([]);
  comptes = signal<CompteDto[]>([]);
  actifs = signal<ActifDto[]>([]);
  categories = signal<CategorieDto[]>([]);
  chargement = signal(false);
  dialogVisible = false;
  objectifEnEdition: ObjectifDto | null = null;

  readonly membres = this.contexte.membres;

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
      this.categorieSvc.lister(foyerId).subscribe(c => this.categories.set(c));
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

  private initiales(nom: string): string {
    return nom.trim().split(/\s+/).map(mot => mot[0]).slice(0, 2).join('').toUpperCase();
  }

  private statut(o: ObjectifDto): StatutObjectif {
    if (o.progression >= 1) return 'ATTEINT';
    if (o.echeance && new Date(o.echeance) < new Date()) return 'EN_RETARD';
    return 'DANS_LES_TEMPS';
  }

  /** Cartes objectifs enrichies : statut, libellés, membres attachés (via le compte lié). */
  objectifsData = computed(() => {
    const cptes = this.comptes();
    const actifsList = this.actifs();
    const cats = this.categories();
    const mems = this.membres();
    return this.objectifs().map(o => {
      const compte = o.compteId ? cptes.find(c => c.id === o.compteId) : undefined;
      const membresAttaches = compte
        ? mems.filter(m => compte.membreIds?.includes(m.id)).map(m => ({ id: m.id, nom: m.nom, couleur: m.couleur, initiales: this.initiales(m.nom) }))
        : [];
      return {
        ...o,
        statut: this.statut(o),
        compteLibelle: compte?.libelle,
        actifLibelle: o.actifId ? actifsList.find(a => a.id === o.actifId)?.libelle : undefined,
        categorieLibelle: o.categorieProjetId ? cats.find(c => c.id === o.categorieProjetId)?.libelle ?? '' : '',
        membresAttaches,
      };
    });
  });

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

  /** Boutons d'action des cartes objectifs — visuels uniquement pour l'instant. */
  actionAVenir(): void {
    this.toast.add({ severity: 'info', summary: this.t.objectif.actionAVenir });
  }
}

