import { Component, inject, signal, computed, OnInit, input, effect } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, Validators, ReactiveFormsModule, FormArray, FormsModule } from '@angular/forms';
import { TableModule } from 'primeng/table';
import { ButtonModule } from 'primeng/button';
import { DialogModule } from 'primeng/dialog';
import { InputTextModule } from 'primeng/inputtext';
import { InputNumberModule } from 'primeng/inputnumber';
import { SelectModule } from 'primeng/select';
import { DatePickerModule } from 'primeng/datepicker';
import { TagModule } from 'primeng/tag';
import { TooltipModule } from 'primeng/tooltip';
import { CardModule } from 'primeng/card';
import { MessageModule } from 'primeng/message';
import { ConfirmDialogModule } from 'primeng/confirmdialog';
import { MessageService, ConfirmationService } from 'primeng/api';
import { ContexteService } from '../../../core/services/contexte.service';
import { PosteService } from '../../../core/services/scenario-poste.service';
import { CategorieService, CompteService } from '../../../core/services/referentiel.service';
import { PosteDto, CategorieDto, CompteDto, VentilationCompteDto, TypePoste } from '../../../core/models/api.models';
import { MontantPipe, PeriodicitePipe } from '../../../core/pipes/format.pipes';
import { FR } from '../../../core/i18n/fr';

@Component({
  selector: 'app-postes-liste',
  standalone: true,
  providers: [ConfirmationService],
  imports: [CommonModule, FormsModule, ReactiveFormsModule, TableModule, ButtonModule, DialogModule,
    InputTextModule, InputNumberModule, SelectModule, DatePickerModule,
    TagModule, TooltipModule, CardModule, MessageModule, ConfirmDialogModule, MontantPipe, PeriodicitePipe],
  template: `
    <p-confirmdialog />
    <div class="flex flex-col gap-4">
      <!-- En-tête -->
      <div class="flex items-center gap-4 flex-wrap">
        <h1 class="text-2xl font-bold flex-1">
          {{ type() === 'REVENU' ? t.nav.revenus : type() === 'CHARGE' ? t.nav.charges : t.nav.reserves }}
        </h1>
        <!-- Tri -->
        <p-select appendTo="body"
          [ngModel]="triActuel()"
          (onChange)="triActuel.set($event.value)"
          [options]="triOptions"
          optionLabel="label" optionValue="value"
          styleClass="min-w-64 text-sm" />
        <!-- Totaux -->
        <div class="text-sm text-surface-500">
          Total mensual. :
          <span class="font-semibold text-surface-700 dark:text-surface-200">
            {{ totalMensualise() | montant }}
          </span>
        </div>
        @if (contexte.estEditor()) {
          <p-button icon="pi pi-plus" [label]="t.commun.creer" (click)="ouvrirCreation()" />
        }
      </div>

      <!-- Tableau -->
      <p-table [value]="postesTries()" styleClass="p-datatable-sm p-datatable-striped" scrollable [loading]="chargement()">
        <ng-template pTemplate="header">
          <tr>
            <th>{{ t.poste.description }}</th>
            <th>{{ t.poste.categorie }}</th>
            <th class="text-right">{{ t.poste.montant }}</th>
            <th class="text-right">{{ t.poste.montantMensualise }}</th>
            <th>{{ t.poste.periodicite }}</th>
            <th>{{ t.poste.debut }}</th>
            <th>{{ t.poste.fin }}</th>
            <th>{{ t.poste.repartition }}</th>
            <th></th>
          </tr>
        </ng-template>
        <ng-template pTemplate="body" let-p>
          <tr>
            <td>{{ p.description }}</td>
            <td><span class="text-xs text-surface-500">{{ categorieLabel(p.categorieId) }}</span></td>
            <td class="text-right font-medium">{{ p.montant | montant:p.devise }}</td>
            <td class="text-right text-surface-500">{{ p.montantMensualise | montant:p.devise }}</td>
            <td class="text-center text-sm">
              {{ p.periodiciteMois | periodicite }}
            </td>
            <td class="text-xs text-surface-500">{{ p.debut ?? '–' }}</td>
            <td class="text-xs text-surface-500">{{ p.fin ?? '–' }}</td>
            <td class="text-xs">{{ repartitionResume(p) }}</td>
            <td>
              <div class="flex gap-1">
                <p-button icon="pi pi-eye" [text]="true" severity="secondary" size="small"
                          [pTooltip]="t.poste.apercu" (click)="ouvrirApercu(p)" />
                @if (contexte.estEditor()) {
                  <p-button icon="pi pi-pencil" [text]="true" size="small" (click)="ouvrirEdition(p)" />
                  <p-button icon="pi pi-trash" [text]="true" severity="danger" size="small" (click)="supprimer(p)" />
                }
              </div>
            </td>
          </tr>
        </ng-template>
        <ng-template pTemplate="emptymessage">
          <tr><td colspan="9" class="text-center py-8 text-surface-400">{{ t.commun.aucunResultat }}</td></tr>
        </ng-template>
      </p-table>
    </div>

    <!-- Dialog formulaire poste -->
    <p-dialog [(visible)]="dialogVisible" [header]="posteEnEdition ? t.commun.modifier : t.commun.creer"
              [modal]="true" styleClass="w-full max-w-2xl">
      <form [formGroup]="form" class="flex flex-col gap-4 pt-2">
        <div class="grid grid-cols-2 gap-4">
          <!-- Description -->
          <div class="col-span-2 flex flex-col gap-1">
            <label class="text-sm font-medium">{{ t.poste.description }} *</label>
            <input pInputText formControlName="description" class="w-full" />
          </div>
          <!-- Catégorie -->
          <div class="flex flex-col gap-1">
            <label class="text-sm font-medium">{{ t.poste.categorie }}</label>
            <p-select appendTo="body" formControlName="categorieId" [options]="categories()" optionLabel="libelle"
                      optionValue="id" [showClear]="true" styleClass="w-full" />
          </div>
          <!-- Montant -->
          <div class="flex flex-col gap-1">
            <label class="text-sm font-medium">{{ t.poste.montant }} *</label>
            <p-inputnumber formControlName="montant" mode="decimal" [minFractionDigits]="2" class="w-full" />
          </div>
          <!-- Périodicité -->
          <div class="flex flex-col gap-1">
            <label class="text-sm font-medium">{{ t.poste.periodicite }}</label>
            <p-select appendTo="body" formControlName="periodiciteMois"
                      [options]="periodiciteOptions" optionLabel="label" optionValue="value"
                      styleClass="w-full" />
          </div>
          <!-- Mode -->
          <div class="flex flex-col gap-1">
            <label class="text-sm font-medium">{{ t.poste.mode }}</label>
            <p-select appendTo="body" formControlName="mode" [options]="modeOptions" optionLabel="label" optionValue="value" styleClass="w-full" />
          </div>
          <!-- Début -->
          <div class="flex flex-col gap-1">
            <label class="text-sm font-medium">{{ t.poste.debut }}</label>
            <p-datepicker appendTo="body" formControlName="debut" dateFormat="dd/mm/yy" [showButtonBar]="true" styleClass="w-full" />
          </div>
          <!-- Fin -->
          <div class="flex flex-col gap-1">
            <label class="text-sm font-medium">{{ t.poste.fin }}</label>
            <p-datepicker appendTo="body" formControlName="fin" dateFormat="dd/mm/yy" [showButtonBar]="true" styleClass="w-full" />
          </div>
        </div>

        <!-- Répartition + Comptes -->
        <div class="flex flex-col gap-2">
          <div class="flex items-center justify-between">
            <label class="text-sm font-medium">{{ t.poste.repartition }}</label>
            <div class="flex items-center gap-2">
              <span class="text-sm"
                    [class.text-green-600]="sommeRepartition === 100"
                    [class.text-red-500]="sommeRepartition !== 100 && repartitionsArray.length > 0">
                {{ sommeRepartition }}%
              </span>
              <p-button label="Équitable" [text]="true" size="small" (click)="repartirEquitablement()" />
            </div>
          </div>
          @if (sommeRepartition !== 100 && repartitionsArray.length > 0) {
            <p-message severity="warn" [text]="t.commun.repartitionInvalide" />
          }
          <!-- En-tête colonnes -->
          @if (repartitionsArray.length > 0) {
            <div class="flex items-center gap-3 text-xs text-surface-400 font-medium px-0">
              <span class="flex-1">{{ t.referentiels.membre.nom }}</span>
              <span class="w-28">{{ t.poste.repartition }}</span>
              <span class="w-44">{{ t.poste.ventilation }}</span>
            </div>
          }
          <div formArrayName="repartitions" class="flex flex-col gap-2">
            @for (ctrl of repartitionsArray.controls; track $index) {
              <div [formGroupName]="$index" class="flex items-center gap-3">
                <span class="flex-1 text-sm">{{ membres()[$index]?.nom }}</span>
                <p-inputnumber formControlName="quotePart" [min]="0" [max]="100"
                               suffix="%" [minFractionDigits]="0" styleClass="w-28"
                               (onInput)="calculerSomme()" />
                <p-select appendTo="body" formControlName="compteId"
                          [options]="comptes()" optionLabel="libelle" optionValue="id"
                          [placeholder]="t.poste.ventilation" styleClass="w-44"
                          [showClear]="false" />
              </div>
            }
          </div>
        </div>
      </form>
      <ng-template pTemplate="footer">
        <p-button [label]="t.commun.annuler" severity="secondary" (click)="dialogVisible = false" />
        <p-button [label]="t.commun.enregistrer" (click)="enregistrer()"
                  [disabled]="form.invalid || (repartitionsArray.length > 0 && sommeRepartition !== 100)" />
      </ng-template>
    </p-dialog>

    <!-- Dialog aperçu mensuel -->
    <p-dialog [(visible)]="apercuVisible" [header]="t.poste.apercu" [modal]="true" styleClass="w-96">
      @if (apercuData()) {
        <p-table [value]="apercuData()!.contributions" styleClass="p-datatable-sm">
          <ng-template pTemplate="header">
            <tr><th>{{ t.projection.mois }}</th><th class="text-right">Contribution</th></tr>
          </ng-template>
          <ng-template pTemplate="body" let-c>
            <tr>
              <td>{{ t.mois[c.mois - 1] }}</td>
              <td class="text-right">{{ c.contribution | montant }}</td>
            </tr>
          </ng-template>
        </p-table>
      }
    </p-dialog>
  `,
})
export class PostesListeComponent implements OnInit {
  readonly t = FR;
  readonly type = input<TypePoste>('REVENU');
  contexte = inject(ContexteService);
  private posteSvc = inject(PosteService);
  private categorieSvc = inject(CategorieService);
  private compteSvc = inject(CompteService);
  private toast = inject(MessageService);
  private confirm = inject(ConfirmationService);
  private fb = inject(FormBuilder);

  postes = signal<PosteDto[]>([]);
  categories = signal<CategorieDto[]>([]);
  comptes = signal<CompteDto[]>([]);
  chargement = signal(false);
  dialogVisible = false;
  apercuVisible = false;
  posteEnEdition: PosteDto | null = null;
  apercuData = signal<{ annee: number; contributions: { mois: number; contribution: number; }[] } | null>(null);
  membres = this.contexte.membres;
  sommeRepartition = 0;

  modeOptions = [
    { label: FR.poste.modeOptions.MENSUALISE, value: 'MENSUALISE' },
    { label: FR.poste.modeOptions.PERIODIQUE, value: 'PERIODIQUE' },
  ];

  periodiciteOptions = FR.poste.periodiciteLabels.map((label, i) => ({ label, value: i + 1 }));

  /** Tri actuel sélectionné */
  triActuel = signal<'DATE' | 'CATEGORIE' | 'DESCRIPTION'>('DATE');

  triOptions = [
    { label: FR.poste.triOptions.DATE,        value: 'DATE' as const },
    { label: FR.poste.triOptions.CATEGORIE,   value: 'CATEGORIE' as const },
    { label: FR.poste.triOptions.DESCRIPTION, value: 'DESCRIPTION' as const },
  ];

  form = this.fb.group({
    description: ['', Validators.required],
    categorieId: [null as string | null],
    montant: [0, [Validators.required, Validators.min(0)]],
    periodiciteMois: [1, Validators.min(1)],
    mode: ['MENSUALISE'],
    moment: ['DEBUT_PERIODE'],
    debut: [null as Date | null],
    fin: [null as Date | null],
    repartitions: this.fb.array([] as any[]),
  });

  get repartitionsArray() { return this.form.get('repartitions') as FormArray; }

  totalMensualise = computed(() =>
    this.postes().reduce((s, p) => s + (p.montantMensualise ?? 0), 0)
  );

  /** Liste triée selon le critère sélectionné dans le dropdown. */
  postesTries = computed(() => {
    const list = [...this.postes()];
    switch (this.triActuel()) {
      case 'DATE':
        return list.sort((a, b) => {
          const da = a.debut ?? '9999-12';
          const db = b.debut ?? '9999-12';
          if (da !== db) return da.localeCompare(db);
          const fa = a.fin ?? '9999-12';
          const fb = b.fin ?? '9999-12';
          return fa.localeCompare(fb);
        });
      case 'CATEGORIE':
        return list.sort((a, b) => {
          const ca = this.categorieLabel(a.categorieId);
          const cb = this.categorieLabel(b.categorieId);
          if (ca !== cb) return ca.localeCompare(cb, 'fr');
          if (a.description !== b.description) return a.description.localeCompare(b.description, 'fr');
          return b.montant - a.montant;
        });
      case 'DESCRIPTION':
        return list.sort((a, b) => {
          if (a.description !== b.description) return a.description.localeCompare(b.description, 'fr');
          return b.montant - a.montant;
        });
      default:
        return list;
    }
  });

  private readonly _chargerEffect = effect(() => {
    const foyerId = this.contexte.foyerId();
    const scenarioId = this.contexte.scenarioId();
    if (foyerId && scenarioId) {
      this.posteSvc.lister(foyerId, scenarioId).subscribe({
        next: all => this.postes.set(all.filter(p => p.type === this.type())),
        error: () => {},
      });
      this.categorieSvc.lister(foyerId, this.type() as any).subscribe(c => this.categories.set(c));
      this.compteSvc.lister(foyerId).subscribe(c => this.comptes.set(c));
    }
  });

  ngOnInit(): void {}

  charger(): void {
    const foyerId = this.contexte.foyerId();
    const scenarioId = this.contexte.scenarioId();
    if (!foyerId || !scenarioId) return;
    this.chargement.set(true);
    this.posteSvc.lister(foyerId, scenarioId).subscribe({
      next: all => {
        this.postes.set(all.filter(p => p.type === this.type()));
        this.chargement.set(false);
      },
      error: () => this.chargement.set(false),
    });
  }

  categorieLabel(id?: string): string {
    return this.categories().find(c => c.id === id)?.libelle ?? '–';
  }

  repartitionResume(p: PosteDto): string {
    if (!p.repartitions.length) return 'défaut';
    return p.repartitions.map(r => `${Math.round(r.quotePart * 100)}%`).join(' / ');
  }

  ouvrirCreation(): void {
    this.posteEnEdition = null;
    this.form.reset({ mode: 'MENSUALISE', moment: 'DEBUT_PERIODE', periodiciteMois: 1 });
    this.initialiserRepartitions();
    this.dialogVisible = true;
  }

  ouvrirEdition(p: PosteDto): void {
    this.posteEnEdition = p;
    this.form.patchValue({
      description: p.description, categorieId: p.categorieId,
      montant: p.montant, periodiciteMois: p.periodiciteMois,
      mode: p.mode, moment: p.moment,
      debut: p.debut ? new Date(p.debut) : null,
      fin: p.fin ? new Date(p.fin) : null,
    });
    this.initialiserRepartitions(p.repartitions, p.ventilations);
    this.dialogVisible = true;
  }

  ouvrirApercu(p: PosteDto): void {
    const foyerId = this.contexte.foyerId()!;
    const scenarioId = this.contexte.scenarioId()!;
    const sc = this.contexte.scenarioCourant();
    this.posteSvc.apercu(foyerId, scenarioId, p.id, sc?.anneeDepart ?? new Date().getFullYear())
      .subscribe(a => { this.apercuData.set(a); this.apercuVisible = true; });
  }

  private defaultCompteId(): string | null {
    const comptes = this.comptes();
    const courant = comptes.find(c => c.type === 'COURANT');
    return courant?.id ?? comptes[0]?.id ?? null;
  }

  private initialiserRepartitions(
    existantes?: { membreId: string; quotePart: number; nomMembre: string }[],
    ventilationsExistantes?: VentilationCompteDto[],
  ): void {
    while (this.repartitionsArray.length) this.repartitionsArray.removeAt(0);
    const membres = this.membres();
    membres.forEach(m => {
      const rep = existantes?.find(r => r.membreId === m.id);
      const vent = ventilationsExistantes?.find(v => v.membreId === m.id);
      this.repartitionsArray.push(this.fb.group({
        membreId: [m.id],
        quotePart: [rep ? Math.round(rep.quotePart * 100) : 0],
        compteId: [vent?.compteId ?? this.defaultCompteId()],
      }));
    });
    this.calculerSomme();
  }

  calculerSomme(): void {
    this.sommeRepartition = this.repartitionsArray.controls
      .reduce((s, c) => s + (c.get('quotePart')?.value ?? 0), 0);
  }

  repartirEquitablement(): void {
    const n = this.membres().length;
    if (!n) return;
    const part = Math.round(100 / n);
    const reste = 100 - part * (n - 1);
    this.repartitionsArray.controls.forEach((ctrl, i) => {
      ctrl.get('quotePart')?.setValue(i === n - 1 ? reste : part);
    });
    this.calculerSomme();
  }

  enregistrer(): void {
    const foyerId = this.contexte.foyerId()!;
    const scenarioId = this.contexte.scenarioId()!;
    const v = this.form.value;
    const repartitions = this.repartitionsArray.length
      ? this.repartitionsArray.controls.map(c => ({
          membreId: c.get('membreId')!.value,
          quotePart: (c.get('quotePart')!.value ?? 0) / 100,
        })).filter(r => r.quotePart > 0)
      : undefined;

    const ventilations = this.repartitionsArray.length
      ? this.repartitionsArray.controls
          .filter(c => c.get('compteId')?.value)
          .map(c => ({
            membreId: c.get('membreId')!.value,
            compteId: c.get('compteId')!.value,
          }))
      : undefined;

    const req = {
      type: this.type(),
      description: v.description!,
      categorieId: v.categorieId ?? undefined,
      montant: v.montant!,
      periodiciteMois: v.periodiciteMois!,
      mode: v.mode as any,
      moment: v.moment as any,
      debut: v.debut ? this.toIso(v.debut) : undefined,
      fin: v.fin ? this.toIso(v.fin) : undefined,
      ordre: 0,
      repartitions,
      ventilations,
    };

    const obs = this.posteEnEdition
      ? this.posteSvc.modifier(foyerId, scenarioId, this.posteEnEdition.id, req)
      : this.posteSvc.creer(foyerId, scenarioId, req);

    obs.subscribe({
      next: () => {
        this.toast.add({ severity: 'success', summary: FR.commun.succes });
        this.dialogVisible = false;
        this.charger();
      },
      error: (err) => this.toast.add({ severity: 'error', summary: FR.commun.erreur, detail: err?.error?.message }),
    });
  }

  supprimer(p: PosteDto): void {
    this.confirm.confirm({
      message: FR.commun.confirmerSuppression,
      accept: () => {
        const foyerId = this.contexte.foyerId()!;
        const scenarioId = this.contexte.scenarioId()!;
        this.posteSvc.supprimer(foyerId, scenarioId, p.id).subscribe({
          next: () => {
            this.toast.add({ severity: 'success', summary: FR.commun.succes });
            this.charger();
          },
          error: () => this.toast.add({ severity: 'error', summary: FR.commun.erreur }),
        });
      },
    });
  }

  private toIso(d: Date): string {
    return d.toISOString().substring(0, 10);
  }
}
