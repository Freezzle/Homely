import { Component, inject, signal, effect } from '@angular/core';
import { CommonModule } from '@angular/common';
import { TableModule } from 'primeng/table';
import { TooltipModule } from 'primeng/tooltip';
import { ConfirmDialogModule } from 'primeng/confirmdialog';
import { MessageService, ConfirmationService } from 'primeng/api';
import { ContexteService } from '../../../core/services/contexte.service';
import { ScenarioService } from '../../../core/services/scenario-poste.service';
import { ScenarioDto } from '../../../core/models/api.models';
import { MontantPipe } from '../../../core/pipes/format.pipes';
import { I18nService } from '../../../core/i18n/i18n.service';
import { notifierSucces, notifierErreur } from '../../../core/utils/toast.util';
import { ButtonComponent } from '../../../shared/components/button/button.component';
import { TagComponent } from '../../../shared/components/tag/tag.component';
import { ScenarioFormDialogComponent, ScenarioFormRequest } from './scenario-form-dialog/scenario-form-dialog.component';

@Component({
  selector: 'app-scenarios-liste',
  standalone: true,
  providers: [ConfirmationService],
  imports: [CommonModule, TableModule, ButtonComponent,
    TagComponent, TooltipModule, ConfirmDialogModule,
    MontantPipe, ScenarioFormDialogComponent],
  templateUrl: './scenarios-liste.component.html',
})
export class ScenariosListeComponent {
  private readonly i18n = inject(I18nService);
  readonly t = this.i18n.translations();
  contexte = inject(ContexteService);
  private scenarioSvc = inject(ScenarioService);
  private toast = inject(MessageService);
  private confirm = inject(ConfirmationService);

  scenarios = signal<ScenarioDto[]>([]);
  membres = this.contexte.membres;
  chargement = signal(false);
  dialogVisible = false;
  scenarioEnEdition: ScenarioDto | null = null;

  private readonly _chargerEffect = effect(() => {
    if (this.contexte.foyerId()) this.charger();
  });

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
    this.dialogVisible = true;
  }

  ouvrirEdition(s: ScenarioDto): void {
    this.scenarioEnEdition = s;
    this.dialogVisible = true;
  }

  /** La popin a validé sa saisie : il ne reste qu'à persister et recharger. */
  enregistrer(req: ScenarioFormRequest): void {
    const foyerId = this.contexte.foyerId()!;
    const obs = this.scenarioEnEdition
      ? this.scenarioSvc.modifier(foyerId, this.scenarioEnEdition.id, req)
      : this.scenarioSvc.creer(foyerId, req);
    obs.subscribe({
      next: () => {
        notifierSucces(this.toast, this.t.commun.succes);
        this.dialogVisible = false;
        this.charger();
        this.contexte.notifierRefresh();
      },
      error: (e) => notifierErreur(this.toast, this.t.commun.erreur, e),
    });
  }

  dupliquer(s: ScenarioDto): void {
    this.scenarioSvc.dupliquer(this.contexte.foyerId()!, s.id).subscribe({
      next: () => { notifierSucces(this.toast, this.t.commun.succes); this.charger(); this.contexte.notifierRefresh(); },
    });
  }

  definirReference(s: ScenarioDto): void {
    this.scenarioSvc.definirReference(this.contexte.foyerId()!, s.id).subscribe({
      next: () => { notifierSucces(this.toast, this.t.commun.succes); this.charger(); this.contexte.notifierRefresh(); },
    });
  }

  supprimer(s: ScenarioDto): void {
    this.confirm.confirm({
      message: this.t.commun.confirmerSuppression,
      accept: () => this.scenarioSvc.supprimer(this.contexte.foyerId()!, s.id).subscribe({
        next: () => { notifierSucces(this.toast, this.t.commun.succes); this.charger(); this.contexte.notifierRefresh(); },
      }),
    });
  }
}
