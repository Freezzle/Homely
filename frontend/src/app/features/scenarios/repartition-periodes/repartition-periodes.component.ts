import { Component, inject, input, signal, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule, ReactiveFormsModule, FormBuilder, FormArray, Validators } from '@angular/forms';
import { ButtonModule } from 'primeng/button';
import { DialogModule } from 'primeng/dialog';
import { TableModule } from 'primeng/table';
import { TagModule } from 'primeng/tag';
import { InputNumberModule } from 'primeng/inputnumber';
import { DatePickerModule } from 'primeng/datepicker';
import { MessageModule } from 'primeng/message';
import { ConfirmDialogModule } from 'primeng/confirmdialog';
import { TooltipModule } from 'primeng/tooltip';
import { MessageService, ConfirmationService } from 'primeng/api';
import { ContexteService } from '../../../core/services/contexte.service';
import { RepartitionPeriodeService } from '../../../core/services/scenario-poste.service';
import { RepartitionPeriodeDto } from '../../../core/models/api.models';
import { PctPipe } from '../../../core/pipes/format.pipes';
import { FR } from '../../../core/i18n/fr';

/**
 * Composant d'édition des périodes de répartition (prorata) d'un scénario.
 * S'affiche sous forme de dialog depuis la liste des scénarios.
 * Masqué automatiquement si le scénario n'a qu'un seul membre.
 */
@Component({
  selector: 'app-repartition-periodes',
  standalone: true,
  providers: [ConfirmationService],
  /* display: contents rend le host transparent afin que le bouton
     reçoive le même contexte de layout que les autres boutons du tableau */
  styles: [`:host { display: contents; }`],
  imports: [CommonModule, FormsModule, ReactiveFormsModule, ButtonModule, DialogModule,
    TableModule, TagModule, InputNumberModule, DatePickerModule, MessageModule,
    ConfirmDialogModule, TooltipModule, PctPipe],
  template: `
    <p-confirmdialog />

    <!-- Bouton déclencheur : icône seule + tooltip, style cohérent avec les autres actions -->
    @if (membres().length > 1) {
      <p-button icon="pi pi-calendar-plus" [text]="true" size="small"
                [pTooltip]="t.scenario.gererPeriodes" tooltipPosition="top"
                (click)="ouvrirDialog()" />
    }

    <!-- Dialog liste des périodes -->
    <p-dialog [(visible)]="dialogVisible" [header]="t.scenario.periodes"
              [modal]="true" styleClass="w-full max-w-3xl" [closable]="true">
      <div class="flex flex-col gap-4">

        <!-- Tableau des périodes existantes -->
        @if (periodes().length > 0) {
          <p-table [value]="periodes()" class="p-datatable-sm p-datatable-striped">
            <ng-template #header>
              <tr>
                <th>{{ t.scenario.debutPeriode }}</th>
                <th>{{ t.scenario.finPeriode }}</th>
                <th>{{ t.referentiels.membre.titre }}</th>
                <th></th>
              </tr>
            </ng-template>
            <ng-template #body let-p>
              <tr>
                <td>{{ p.debut | date:'dd.MM.yyyy' }}</td>
                <td>
                  @if (!p.fin) {
                    <p-tag [value]="t.scenario.periodeOuverte" severity="success" />
                  } @else {
                    {{ p.fin | date:'dd.MM.yyyy' }}
                  }
                </td>
                <td>
                  <div class="flex flex-wrap gap-1">
                    @for (part of p.parts; track part.membreId) {
                      <span class="inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full"
                            [style.background-color]="normaliserCouleur(part.couleurMembre)"
                            [style.color]="contrasteCouleur(part.couleurMembre)">
                        {{ part.nomMembre }} · {{ part.quotePart | pct }}
                      </span>
                    }
                  </div>
                </td>
                <td>
                  @if (contexte.estEditor()) {
                    <div class="flex gap-1 justify-end">
                      <p-button icon="pi pi-pencil" [text]="true" size="small"
                                (click)="ouvrirEdition(p)" />
                      <p-button icon="pi pi-trash" [text]="true" severity="danger" size="small"
                                (click)="confirmerSuppression(p)" />
                    </div>
                  }
                </td>
              </tr>
            </ng-template>
          </p-table>
        } @else {
          <p class="text-surface-500 text-sm">{{ t.commun.aucunResultat }}</p>
        }

        @if (contexte.estEditor()) {
          <p-button [label]="t.scenario.nouvellePeriode" icon="pi pi-plus"
                    size="small" (click)="ouvrirCreation()" />
        }
      </div>
    </p-dialog>

    <!-- Dialog formulaire période -->
    <p-dialog [(visible)]="formVisible"
              [header]="periodeEnEdition ? t.commun.modifier : t.commun.creer"
              [modal]="true" styleClass="w-full max-w-lg">
      <form [formGroup]="form" class="flex flex-col gap-4 pt-2">
        <div class="grid grid-cols-2 gap-4">
          <div class="flex flex-col gap-1">
            <label class="text-sm font-medium">{{ t.scenario.debutPeriode }} *</label>
            <p-datepicker formControlName="debut" dateFormat="dd.mm.yy" class="w-full" appendTo="body"
                          [showButtonBar]="true" />
          </div>
          <div class="flex flex-col gap-1">
            <label class="text-sm font-medium">{{ t.scenario.finPeriode }}</label>
            <p-datepicker formControlName="fin" dateFormat="dd.mm.yy" class="w-full" appendTo="body"
                          [showButtonBar]="true" [showClear]="true" />
          </div>
        </div>

        <div class="flex flex-col gap-2">
          <div class="flex items-center justify-between">
            <label class="text-sm font-medium">{{ t.poste.repartition }} *
              <span class="ml-2 font-normal text-xs"
                    [class.text-green-600]="sommeParts === 100"
                    [class.text-red-500]="sommeParts !== 100">
                {{ sommeParts }}%
              </span>
            </label>
          </div>
          @if (sommeParts !== 100) {
            <p-message severity="warn">{{ t.commun.repartitionInvalide }}</p-message>
          }
          <div formArrayName="parts" class="flex flex-col gap-2">
            @for (ctrl of partsArray.controls; track ctrl; let i = $index) {
              <div [formGroupName]="i" class="grid grid-cols-2 items-center gap-3">
                <span class="text-sm">{{ membres()[i]?.nom }}</span>
                <p-inputnumber formControlName="quotePart" [min]="0" [max]="100"
                               suffix="%" [minFractionDigits]="0"
                               (onInput)="calculerSomme()" />
              </div>
            }
          </div>
        </div>
      </form>
      <ng-template #footer>
        <p-button [label]="t.commun.annuler" severity="secondary" (click)="formVisible = false" />
        <p-button [label]="t.commun.enregistrer" (click)="enregistrer()"
                  [disabled]="form.invalid || sommeParts !== 100" />
      </ng-template>
    </p-dialog>
  `,
})
export class RepartitionPeriodesComponent implements OnInit {
  readonly t = FR;
  protected readonly Math = Math;

  readonly scenarioId = input.required<string>();

  contexte = inject(ContexteService);
  private periodeSvc = inject(RepartitionPeriodeService);
  private toast = inject(MessageService);
  private confirm = inject(ConfirmationService);
  private fb = inject(FormBuilder);

  periodes = signal<RepartitionPeriodeDto[]>([]);
  membres = this.contexte.membres;
  dialogVisible = false;
  formVisible = false;
  periodeEnEdition: RepartitionPeriodeDto | null = null;
  sommeParts = 0;

  form = this.fb.group({
    debut: [null as Date | null, Validators.required],
    fin:   [null as Date | null],
    parts: this.fb.array([] as any[]),
  });

  get partsArray() { return this.form.get('parts') as FormArray; }

  ngOnInit(): void {}

  ouvrirDialog(): void {
    this.dialogVisible = true;
    this.chargerPeriodes();
  }

  private chargerPeriodes(): void {
    const foyerId = this.contexte.foyerId()!;
    if (!foyerId) return;
    this.periodeSvc.lister(foyerId, this.scenarioId()).subscribe({
      next: p => this.periodes.set(p),
      error: () => this.toast.add({ severity: 'error', summary: FR.commun.erreur }),
    });
  }

  ouvrirCreation(): void {
    this.periodeEnEdition = null;
    this.form.reset();
    this.initialiserParts();
    this.formVisible = true;
  }

  ouvrirEdition(p: RepartitionPeriodeDto): void {
    this.periodeEnEdition = p;
    this.form.patchValue({
      debut: p.debut ? new Date(p.debut) : null,
      fin:   p.fin   ? new Date(p.fin)   : null,
    });
    this.initialiserParts(p.parts.map(pp => ({ membreId: pp.membreId, quotePart: Math.round(pp.quotePart * 100) })));
    this.formVisible = true;
  }

  private initialiserParts(existantes?: { membreId: string; quotePart: number }[]): void {
    const membres = this.membres();
    while (this.partsArray.length > membres.length) this.partsArray.removeAt(this.partsArray.length - 1);
    membres.forEach((m, i) => {
      const ex = existantes?.find(e => e.membreId === m.id);
      const quotePart = ex ? ex.quotePart : 0;
      if (i < this.partsArray.length) {
        this.partsArray.at(i).patchValue({ membreId: m.id, quotePart });
      } else {
        this.partsArray.push(this.fb.group({ membreId: [m.id], quotePart: [quotePart] }));
      }
    });
    this.calculerSomme();
  }

  calculerSomme(): void {
    this.sommeParts = this.partsArray.controls.reduce((s, c) => s + (c.get('quotePart')?.value ?? 0), 0);
  }

  enregistrer(): void {
    const foyerId = this.contexte.foyerId()!;
    const v = this.form.value;
    const req = {
      debut: v.debut ? this.toIso(v.debut!) : undefined,
      fin:   v.fin   ? this.toIso(v.fin!)   : undefined,
      parts: this.partsArray.controls.map(c => ({
        membreId: c.get('membreId')!.value,
        quotePart: (c.get('quotePart')!.value ?? 0) / 100,
      })),
    };

    const obs = this.periodeEnEdition
      ? this.periodeSvc.modifier(foyerId, this.scenarioId(), this.periodeEnEdition.id, req)
      : this.periodeSvc.creer(foyerId, this.scenarioId(), req);

    obs.subscribe({
      next: () => {
        this.toast.add({ severity: 'success', summary: FR.commun.succes });
        this.formVisible = false;
        // Recharger les données sans fermer le dialog liste qui est déjà visible derrière
        this.chargerPeriodes();
      },
      error: (err) => this.toast.add({ severity: 'error', summary: FR.commun.erreur, detail: err?.error?.message }),
    });
  }

  confirmerSuppression(p: RepartitionPeriodeDto): void {
    this.confirm.confirm({
      message: FR.commun.confirmerSuppression,
      accept: () => {
        const foyerId = this.contexte.foyerId()!;
        this.periodeSvc.supprimer(foyerId, this.scenarioId(), p.id).subscribe({
          next: () => {
            this.toast.add({ severity: 'success', summary: FR.commun.succes });
            this.chargerPeriodes();
          },
          error: (err) => this.toast.add({ severity: 'error', summary: FR.commun.erreur, detail: err?.error?.message }),
        });
      },
    });
  }

  normaliserCouleur(c?: string | null): string {
    if (!c) return '#64748b';
    return c.startsWith('#') ? c : `#${c}`;
  }

  contrasteCouleur(hex?: string | null): string {
    const h = (hex ?? '#64748b').replace('#', '');
    if (h.length !== 6) return '#ffffff';
    const r = parseInt(h.slice(0, 2), 16);
    const g = parseInt(h.slice(2, 4), 16);
    const b = parseInt(h.slice(4, 6), 16);
    return (0.299 * r + 0.587 * g + 0.114 * b) > 170 ? '#111827' : '#ffffff';
  }

  private toIso(d: Date): string { return d.toISOString().substring(0, 10); }
}







