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
import { I18nService } from '../../../core/i18n/i18n.service';
import { TagComponent } from '../../../shared/components/tag/tag.component';
import { toIsoDateLocal, parseIsoDateLocal } from '../../../core/utils/date.util';

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
    ConfirmDialogModule, TooltipModule, PctPipe, TagComponent],
  templateUrl: './repartition-periodes.component.html',
})
export class RepartitionPeriodesComponent implements OnInit {
  private readonly i18n = inject(I18nService);
  readonly t = this.i18n.translations();
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
      error: (err) => this.toast.add({ severity: 'error', summary: this.t.commun.erreur, detail: err?.error?.message }),
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
      debut: p.debut ? parseIsoDateLocal(p.debut) : null,
      fin:   p.fin   ? parseIsoDateLocal(p.fin)   : null,
    });
    this.initialiserParts(p.parts.map(pp => ({ membreId: pp.membreId, quotePart: Math.round(pp.quotePart * 10000) / 100 })));
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
    const total = this.partsArray.controls.reduce((s, c) => s + (c.get('quotePart')?.value ?? 0), 0);
    // Neutralise les résidus binaires (ex. 33.33+33.33+33.34 = 100.00000000000001).
    this.sommeParts = Math.round(total * 100) / 100;
  }

  /** Tolérance flottante : une somme visuellement à 100% ne doit jamais être refusée à tort. */
  get sommePartsValide(): boolean {
    return Math.abs(this.sommeParts - 100) < 0.01;
  }

  /**
   * Miroir côté UX des règles serveur (docs/01 §6.5) : fin >= début, pas de
   * chevauchement entre périodes, au plus une période ouverte par scénario.
   * Retourne le message d'erreur à afficher, ou null si la période est valide.
   */
  get periodeErreur(): string | null {
    const v = this.form.value;
    const debut = v.debut as Date | null;
    if (!debut) return null;
    const fin = (v.fin as Date | null) ?? null;

    if (fin && fin.getTime() < debut.getTime()) {
      return this.t.scenario.periodeFinAvantDebut;
    }

    const autres = this.periodes().filter(p => p.id !== this.periodeEnEdition?.id);
    const debutTime = debut.getTime();
    const finTime = fin ? fin.getTime() : Number.POSITIVE_INFINITY;

    for (const p of autres) {
      if (!p.debut) continue;
      const pDebutTime = parseIsoDateLocal(p.debut).getTime();
      const pFinTime = p.fin ? parseIsoDateLocal(p.fin).getTime() : Number.POSITIVE_INFINITY;
      // Deux intervalles [debut,fin] et [pDebut,pFin] se chevauchent si
      // debut <= pFin ET pDebut <= fin (bornes incluses : la fin d'une période
      // et le début de la suivante ne doivent pas être le même jour).
      if (debutTime <= pFinTime && pDebutTime <= finTime) {
        return this.t.scenario.periodeChevauche;
      }
    }

    if (!fin && autres.some(p => !p.fin)) {
      return this.t.scenario.periodeOuverteDejaExistante;
    }

    return null;
  }

  get periodeValide(): boolean {
    return this.periodeErreur === null;
  }

  enregistrer(): void {
    if (!this.periodeValide) {
      this.toast.add({ severity: 'warn', summary: this.t.commun.erreur, detail: this.periodeErreur! });
      return;
    }
    const foyerId = this.contexte.foyerId()!;
    const v = this.form.value;
    const req = {
      debut: v.debut ? this.toIso(v.debut!) : undefined,
      fin:   v.fin   ? this.toIso(v.fin!)   : undefined,
      parts: this.partsArray.controls.map(c => ({
        membreId: c.get('membreId')!.value,
        quotePart: Math.round((c.get('quotePart')!.value ?? 0) * 100) / 10000,
      })),
    };

    const obs = this.periodeEnEdition
      ? this.periodeSvc.modifier(foyerId, this.scenarioId(), this.periodeEnEdition.id, req)
      : this.periodeSvc.creer(foyerId, this.scenarioId(), req);

    obs.subscribe({
      next: () => {
        this.toast.add({ severity: 'success', summary: this.t.commun.succes });
        this.formVisible = false;
        // Recharger les données sans fermer le dialog liste qui est déjà visible derrière
        this.chargerPeriodes();
      },
      error: (err) => this.toast.add({ severity: 'error', summary: this.t.commun.erreur, detail: err?.error?.message }),
    });
  }

  confirmerSuppression(p: RepartitionPeriodeDto): void {
    this.confirm.confirm({
      message: this.t.commun.confirmerSuppression,
      accept: () => {
        const foyerId = this.contexte.foyerId()!;
        this.periodeSvc.supprimer(foyerId, this.scenarioId(), p.id).subscribe({
          next: () => {
            this.toast.add({ severity: 'success', summary: this.t.commun.succes });
            this.chargerPeriodes();
          },
          error: (err) => this.toast.add({ severity: 'error', summary: this.t.commun.erreur, detail: err?.error?.message }),
        });
      },
    });
  }


  private toIso(d: Date): string { return toIsoDateLocal(d); }
}







