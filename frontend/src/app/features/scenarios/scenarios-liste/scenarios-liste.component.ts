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
import { I18nService } from '../../../core/i18n/i18n.service';
import { RepartitionPeriodesComponent } from '../repartition-periodes/repartition-periodes.component';

@Component({
  selector: 'app-scenarios-liste',
  standalone: true,
  providers: [ConfirmationService],
  imports: [CommonModule, FormsModule, ReactiveFormsModule, TableModule, ButtonModule,
    DialogModule, TagModule, InputTextModule, InputNumberModule, TooltipModule,
    ConfirmDialogModule, MontantPipe, RepartitionPeriodesComponent],
  templateUrl: './scenarios-liste.component.html',
})
export class ScenariosListeComponent implements OnInit {
  private readonly i18n = inject(I18nService);
  readonly t = this.i18n.translations();
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
    // Conserve la précision décimale (ex. 33.33) au lieu d'arrondir à l'entier,
    // ce qui déformerait des quotes-parts valides et casserait la fidélité au centime.
    s.repartitions.forEach(r => { this.repsMap[r.membreId] = Math.round(r.quotePart * 10000) / 100; });
    this.calculerSomme();
    this.dialogVisible = true;
  }

  private initReps(): void {
    this.repsMap = {};
    const membres = this.membres();
    if (membres.length) {
      const part = Math.round((100 / membres.length) * 100) / 100;
      const reste = Math.round((100 - part * (membres.length - 1)) * 100) / 100;
      membres.forEach((m, i) => { this.repsMap[m.id] = i === membres.length - 1 ? reste : part; });
    }
    this.calculerSomme();
  }

  onRepChange(membreId: string, val: string): void {
    this.repsMap[membreId] = parseFloat(val) || 0;
    this.calculerSomme();
  }

  calculerSomme(): void {
    const total = Object.values(this.repsMap).reduce((s, v) => s + (v || 0), 0);
    // Neutralise les résidus binaires (ex. 33.33+33.33+33.34 = 100.00000000000001).
    this.sommeRep = Math.round(total * 100) / 100;
  }

  /** Tolérance flottante : évite qu'une somme visuellement à 100% (ex. 99.999999) soit refusée à tort. */
  get sommeRepValide(): boolean {
    return Math.abs(this.sommeRep - 100) < 0.01;
  }

  enregistrer(): void {
    const foyerId = this.contexte.foyerId()!;
    const v = this.form.value;
    const repartitions = this.membres()
      .filter(m => (this.repsMap[m.id] ?? 0) > 0)
      .map(m => ({ membreId: m.id, quotePart: Math.round((this.repsMap[m.id] ?? 0) * 100) / 10000 }));
    const req = { nom: v.nom!, anneeDepart: v.anneeDepart!, tresorerieInitiale: v.tresorerieInitiale ?? 0, horizonAnnees: v.horizonAnnees!, repartitions };
    const obs = this.scenarioEnEdition
      ? this.scenarioSvc.modifier(foyerId, this.scenarioEnEdition.id, req)
      : this.scenarioSvc.creer(foyerId, req);
    obs.subscribe({
      next: () => {
        this.toast.add({ severity: 'success', summary: this.t.commun.succes });
        this.dialogVisible = false;
        this.charger();
        this.contexte.notifierRefresh();
      },
      error: (e) => this.toast.add({ severity: 'error', summary: this.t.commun.erreur, detail: e?.error?.message }),
    });
  }

  dupliquer(s: ScenarioDto): void {
    this.scenarioSvc.dupliquer(this.contexte.foyerId()!, s.id).subscribe({
      next: () => { this.toast.add({ severity: 'success', summary: this.t.commun.succes }); this.charger(); this.contexte.notifierRefresh(); },
    });
  }

  definirReference(s: ScenarioDto): void {
    this.scenarioSvc.definirReference(this.contexte.foyerId()!, s.id).subscribe({
      next: () => { this.toast.add({ severity: 'success', summary: this.t.commun.succes }); this.charger(); this.contexte.notifierRefresh(); },
    });
  }

  supprimer(s: ScenarioDto): void {
    this.confirm.confirm({
      message: this.t.commun.confirmerSuppression,
      accept: () => this.scenarioSvc.supprimer(this.contexte.foyerId()!, s.id).subscribe({
        next: () => { this.toast.add({ severity: 'success', summary: this.t.commun.succes }); this.charger(); this.contexte.notifierRefresh(); },
      }),
    });
  }
}
