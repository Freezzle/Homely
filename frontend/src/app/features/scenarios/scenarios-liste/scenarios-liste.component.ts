import { Component, inject, signal, OnInit, effect } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule, ReactiveFormsModule, FormBuilder, Validators } from '@angular/forms';
import { TableModule } from 'primeng/table';
import { ButtonModule } from 'primeng/button';
import { DialogModule } from 'primeng/dialog';
import { TagModule } from 'primeng/tag';
import { InputTextModule } from 'primeng/inputtext';
import { InputNumberModule } from 'primeng/inputnumber';
import { TooltipModule } from 'primeng/tooltip';
import { ConfirmDialogModule } from 'primeng/confirmdialog';
import { MessageService, ConfirmationService } from 'primeng/api';
import { ContexteService } from '../../../core/services/contexte.service';
import { ScenarioService } from '../../../core/services/scenario-poste.service';
import { ScenarioDto } from '../../../core/models/api.models';
import { MontantPipe } from '../../../core/pipes/format.pipes';
import { FR } from '../../../core/i18n/fr';
import { RepartitionPeriodesComponent } from '../repartition-periodes/repartition-periodes.component';

@Component({
  selector: 'app-scenarios-liste',
  standalone: true,
  providers: [ConfirmationService],
  imports: [CommonModule, FormsModule, ReactiveFormsModule, TableModule, ButtonModule,
    DialogModule, TagModule, InputTextModule, InputNumberModule, TooltipModule,
    ConfirmDialogModule, MontantPipe, RepartitionPeriodesComponent],
  template: `
    <p-confirmdialog />
    <div class="flex flex-col gap-4">
      <div class="flex items-center gap-4">
        <h1 class="text-2xl font-bold flex-1">{{ t.nav.scenarios }}</h1>
        @if (contexte.estEditor()) {
          <p-button icon="pi pi-plus" [label]="t.commun.creer" (click)="ouvrirCreation()" />
        }
      </div>

      <p-table [value]="scenarios()" styleClass="p-datatable-sm p-datatable-striped" [loading]="chargement()">
         <ng-template #header>
           <tr>
             <th>{{ t.commun.enregistrer }}</th>
             <th>Statut</th>
             <th class="text-right">{{ t.scenario.anneeDepart }}</th>
             <th class="text-right">{{ t.scenario.tresorerieInitiale }}</th>
             <th class="text-right">{{ t.scenario.horizonAnnees }}</th>
             <th></th>
           </tr>
         </ng-template>
         <ng-template #body let-s>
           <tr [class.font-bold]="s.estReference">
             <td>{{ s.nom }}</td>
             <td>
               @if (s.estReference) {
                 <p-tag [value]="t.scenario.reference" severity="success" />
               }
             </td>
             <td class="text-right">{{ s.anneeDepart }}</td>
             <td class="text-right">{{ s.tresorerieInitiale | montant }}</td>
             <td class="text-right">{{ s.horizonAnnees }} ans</td>
             <td>
               <div class="flex gap-1 items-center">
                 @if (contexte.estEditor()) {
                   <p-button icon="pi pi-pencil" [text]="true" size="small" (click)="ouvrirEdition(s)" />
                   <p-button icon="pi pi-copy" [text]="true" size="small" [pTooltip]="t.scenario.dupliquer" (click)="dupliquer(s)" />
                 }
                 <!-- Bouton périodes de prorata (masqué si mono-membre) -->
                 @if (membres().length > 1) {
                   <app-repartition-periodes [scenarioId]="s.id" />
                 }
                 @if (contexte.estOwner() && !s.estReference) {
                   <p-button icon="pi pi-star" [text]="true" severity="warn" size="small"
                             [pTooltip]="t.scenario.definirReference" (click)="definirReference(s)" />
                   <p-button icon="pi pi-trash" [text]="true" severity="danger" size="small" (click)="supprimer(s)" />
                 }
               </div>
             </td>
           </tr>
         </ng-template>
       </p-table>
    </div>

    <!-- Dialog formulaire -->
    <p-dialog [(visible)]="dialogVisible" [header]="scenarioEnEdition ? t.commun.modifier : t.commun.creer"
              [modal]="true" styleClass="w-full max-w-lg">
      <form [formGroup]="form" class="flex flex-col gap-4 pt-2">
        <div class="flex flex-col gap-1">
          <label class="text-sm font-medium">Nom *</label>
          <input pInputText formControlName="nom" class="w-full" />
        </div>
        <div class="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div class="flex flex-col gap-1 min-w-0">
            <label class="text-sm font-medium">{{ t.scenario.anneeDepart }}</label>
            <p-inputnumber formControlName="anneeDepart" [min]="2020" [max]="2099" [useGrouping]="false"
                           styleClass="w-full" inputStyleClass="w-full" />
          </div>
          <div class="flex flex-col gap-1 min-w-0">
            <label class="text-sm font-medium">{{ t.scenario.tresorerieInitiale }}</label>
            <p-inputnumber formControlName="tresorerieInitiale" mode="decimal" [minFractionDigits]="2"
                           styleClass="w-full" inputStyleClass="w-full" />
          </div>
          <div class="flex flex-col gap-1 min-w-0">
            <label class="text-sm font-medium">{{ t.scenario.horizonAnnees }}</label>
            <p-inputnumber formControlName="horizonAnnees" [min]="1" [max]="100"
                           styleClass="w-full" inputStyleClass="w-full" />
          </div>
        </div>
        <!-- Répartition par défaut -->
        <div class="flex flex-col gap-2">
          <div class="flex items-center justify-between">
            <label class="text-sm font-medium">{{ t.scenario.repartition }}</label>
            <span class="text-sm" [class.text-green-600]="sommeRep === 100" [class.text-red-500]="sommeRep !== 100">
              {{ sommeRep }}%
            </span>
          </div>
          @for (m of membres(); track m.id) {
            <div class="flex items-center gap-3">
              <span class="flex-1 text-sm">{{ m.nom }}</span>
              <input pInputText [value]="repsMap[m.id]" type="number" min="0" max="100"
                     class="w-24 text-right" (input)="onRepChange(m.id, $any($event.target).value)" />
              <span class="text-sm">%</span>
            </div>
          }
        </div>
      </form>
      <ng-template #footer>
        <p-button [label]="t.commun.annuler" severity="secondary" (click)="dialogVisible = false" />
        <p-button [label]="t.commun.enregistrer" (click)="enregistrer()"
                  [disabled]="form.invalid || sommeRep !== 100" />
      </ng-template>
    </p-dialog>
  `,
})
export class ScenariosListeComponent implements OnInit {
  readonly t = FR;
  contexte = inject(ContexteService);
  private scenarioSvc = inject(ScenarioService);
  private toast = inject(MessageService);
  private confirm = inject(ConfirmationService);
  private fb = inject(FormBuilder);

  scenarios = signal<ScenarioDto[]>([]);
  membres = this.contexte.membres;
  chargement = signal(false);
  dialogVisible = false;
  scenarioEnEdition: ScenarioDto | null = null;
  repsMap: Record<string, number> = {};
  sommeRep = 0;

  form = this.fb.group({
    nom: ['', Validators.required],
    anneeDepart: [new Date().getFullYear(), Validators.required],
    tresorerieInitiale: [0],
    horizonAnnees: [9, [Validators.required, Validators.min(1)]],
  });

  private readonly _chargerEffect = effect(() => {
    if (this.contexte.foyerId()) this.charger();
  });

  ngOnInit(): void {}

  charger(): void {
    const foyerId = this.contexte.foyerId();
    if (!foyerId) return;
    this.chargement.set(true);
    this.scenarioSvc.lister(foyerId).subscribe({
      next: s => {
        this.scenarios.set(s);
        const courant = this.contexte.scenarioCourant();
        const reference = s.find(x => x.estReference) ?? s[0] ?? null;
        const scenarioActif = courant ? (s.find(x => x.id === courant.id) ?? reference) : reference;
        this.contexte.setScenario(scenarioActif);
        this.chargement.set(false);
      },
      error: () => this.chargement.set(false),
    });
  }

  ouvrirCreation(): void {
    this.scenarioEnEdition = null;
    this.form.reset({ anneeDepart: new Date().getFullYear(), tresorerieInitiale: 0, horizonAnnees: 9 });
    this.initReps();
    this.dialogVisible = true;
  }

  ouvrirEdition(s: ScenarioDto): void {
    this.scenarioEnEdition = s;
    this.form.patchValue({ nom: s.nom, anneeDepart: s.anneeDepart, tresorerieInitiale: s.tresorerieInitiale, horizonAnnees: s.horizonAnnees });
    this.repsMap = {};
    s.repartitions.forEach(r => { this.repsMap[r.membreId] = Math.round(r.quotePart * 100); });
    this.calculerSomme();
    this.dialogVisible = true;
  }

  private initReps(): void {
    this.repsMap = {};
    const membres = this.membres();
    if (membres.length) {
      const part = Math.round(100 / membres.length);
      const reste = 100 - part * (membres.length - 1);
      membres.forEach((m, i) => { this.repsMap[m.id] = i === membres.length - 1 ? reste : part; });
    }
    this.calculerSomme();
  }

  onRepChange(membreId: string, val: string): void {
    this.repsMap[membreId] = parseInt(val, 10) || 0;
    this.calculerSomme();
  }

  calculerSomme(): void {
    this.sommeRep = Object.values(this.repsMap).reduce((s, v) => s + (v || 0), 0);
  }

  enregistrer(): void {
    const foyerId = this.contexte.foyerId()!;
    const v = this.form.value;
    const repartitions = this.membres()
      .filter(m => (this.repsMap[m.id] ?? 0) > 0)
      .map(m => ({ membreId: m.id, quotePart: (this.repsMap[m.id] ?? 0) / 100 }));
    const req = { nom: v.nom!, anneeDepart: v.anneeDepart!, tresorerieInitiale: v.tresorerieInitiale ?? 0, horizonAnnees: v.horizonAnnees!, repartitions };
    const obs = this.scenarioEnEdition
      ? this.scenarioSvc.modifier(foyerId, this.scenarioEnEdition.id, req)
      : this.scenarioSvc.creer(foyerId, req);
    obs.subscribe({
      next: () => {
        this.toast.add({ severity: 'success', summary: FR.commun.succes });
        this.dialogVisible = false;
        this.charger();
        this.contexte.notifierRefresh();
      },
      error: (e) => this.toast.add({ severity: 'error', summary: FR.commun.erreur, detail: e?.error?.message }),
    });
  }

  dupliquer(s: ScenarioDto): void {
    this.scenarioSvc.dupliquer(this.contexte.foyerId()!, s.id).subscribe({
      next: () => { this.toast.add({ severity: 'success', summary: FR.commun.succes }); this.charger(); this.contexte.notifierRefresh(); },
    });
  }

  definirReference(s: ScenarioDto): void {
    this.scenarioSvc.definirReference(this.contexte.foyerId()!, s.id).subscribe({
      next: () => { this.toast.add({ severity: 'success', summary: FR.commun.succes }); this.charger(); this.contexte.notifierRefresh(); },
    });
  }

  supprimer(s: ScenarioDto): void {
    this.confirm.confirm({
      message: FR.commun.confirmerSuppression,
      accept: () => this.scenarioSvc.supprimer(this.contexte.foyerId()!, s.id).subscribe({
        next: () => { this.toast.add({ severity: 'success', summary: FR.commun.succes }); this.charger(); this.contexte.notifierRefresh(); },
      }),
    });
  }
}
