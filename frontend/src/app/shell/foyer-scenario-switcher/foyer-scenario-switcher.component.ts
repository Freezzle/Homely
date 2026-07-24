import { Component, inject, signal, OnInit, effect, untracked, model } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { SelectModule } from 'primeng/select';
import { DialogModule } from 'primeng/dialog';
import { ContexteService } from '../../core/services/contexte.service';
import { FoyerService } from '../../core/services/referentiel.service';
import { ScenarioService } from '../../core/services/scenario-poste.service';
import { FoyerDto, ScenarioDto } from '../../core/models/api.models';
import { I18nService } from '../../core/i18n/i18n.service';

/**
 * Dialogue de sélection du foyer / scénario courants.
 *
 * Isolée dans son propre composant afin de pouvoir facilement changer la
 * méthode de sélection à l'avenir (ex: drawer, page dédiée) sans toucher à la
 * topbar : celle-ci ne fait qu'ouvrir/fermer ce composant via `[(visible)]`.
 */
@Component({
  selector: 'app-foyer-scenario-switcher',
  standalone: true,
  imports: [CommonModule, FormsModule, SelectModule, DialogModule],
  template: `
    <p-dialog [(visible)]="visible" [modal]="true" [header]="t.foyer.changerContexte"
              class="w-full max-w-md">
      <div class="flex flex-col gap-4 pt-2">
        @if (foyers().length > 0) {
          <div class="flex flex-col gap-1">
            <label class="text-sm font-medium">{{ t.foyer.choisir }}</label>
            <p-select appendTo="body"
              [options]="foyers()"
              [(ngModel)]="foyerSelectionne"
              optionLabel="nom"
              [placeholder]="t.foyer.choisir"
              class="w-full"
              (onChange)="onFoyerChange($event.value)"
            />
          </div>
        }

        @if (scenarios().length > 0) {
          <div class="flex flex-col gap-1">
            <label class="text-sm font-medium">{{ t.scenario.choisir }}</label>
            <p-select appendTo="body"
              [options]="scenarios()"
              [(ngModel)]="scenarioSelectionne"
              optionLabel="nom"
              [placeholder]="t.scenario.choisir"
              class="w-full"
              (onChange)="onScenarioChange($event.value)"
            >
              <ng-template #item let-s>
                <span>{{ s.nom }}</span>
                @if (s.estReference) {
                  <span class="ml-2 text-xs bg-primary text-white rounded px-1">{{ t.scenario.reference }}</span>
                }
              </ng-template>
            </p-select>
          </div>
        }
      </div>
    </p-dialog>
  `,
})
export class FoyerScenarioSwitcherComponent implements OnInit {
  readonly i18n = inject(I18nService);
  readonly t = this.i18n.translations();
  private contexte = inject(ContexteService);
  private foyerSvc = inject(FoyerService);
  private scenarioSvc = inject(ScenarioService);
  private router = inject(Router);

  // Visibilité de la dialogue, pilotée par le parent (topbar) via [(visible)].
  readonly visible = model(false);

  foyers = signal<FoyerDto[]>([]);
  scenarios = signal<ScenarioDto[]>([]);
  foyerSelectionne: FoyerDto | null = null;
  scenarioSelectionne: ScenarioDto | null = null;

  // Réagit UNIQUEMENT à foyerCourant (pas à foyers/scenarios → pas de double-appel)
  private readonly _syncFoyer = effect(() => {
    const foyer = this.contexte.foyerCourant();
    // Lecture non-trackée de la liste de foyers (évite re-runs inutiles quand foyers se charge)
    this.foyerSelectionne = foyer
      ? (untracked(() => this.foyers()).find(f => f.id === foyer.id) ?? foyer)
      : null;
    if (foyer) {
      this.chargerScenarios(foyer.id);
    } else {
      this.scenarios.set([]);
      this.scenarioSelectionne = null;
    }
  });
  private readonly _syncScenario = effect(() => {
    this.scenarioSelectionne = this.contexte.scenarioCourant();
  });
  private readonly _refreshLists = effect(() => {
    // Dépendance explicite au signal de refresh global du contexte.
    this.contexte.refreshVersion();
    this.chargerFoyers();
    // Important: un refresh peut venir d'une mutation de scénario sans changement de foyer.
    const foyer = untracked(() => this.contexte.foyerCourant());
    if (foyer) {
      this.chargerScenarios(foyer.id);
    }
  });

  ngOnInit(): void {
    // Chargement initial piloté par _refreshLists.
  }

  private chargerFoyers(): void {
    this.foyerSvc.lister().subscribe(f => {
      this.foyers.set(f);
      if (f.length === 0) {
        this.contexte.setFoyer(null);
        this.scenarios.set([]);
        this.foyerSelectionne = null;
        this.scenarioSelectionne = null;
        return;
      }
      // Resynchroniser la sélection affichée une fois la liste chargée
      const foyer = this.contexte.foyerCourant();
      if (foyer) {
        this.foyerSelectionne = f.find(x => x.id === foyer.id) ?? this.foyerSelectionne;
      }
    });
  }

  private chargerScenarios(foyerId: string): void {
    this.scenarioSvc.lister(foyerId).subscribe(scenarios => {
      this.scenarios.set(scenarios);
      const currentSc = this.contexte.scenarioCourant();
      const reference = scenarios.find(s => s.estReference) ?? scenarios[0] ?? null;
      const scenarioActif = currentSc
        ? (scenarios.find(s => s.id === currentSc.id) ?? reference)
        : reference;
      this.scenarioSelectionne = scenarioActif;
      this.contexte.setScenario(scenarioActif);
    });
  }

  onFoyerChange(foyer: FoyerDto | null): void {
    if (!foyer) {
      this.contexte.setFoyer(null);
      this.router.navigate(['/foyers']);
      this.visible.set(false);
      return;
    }
    this.contexte.setFoyer(foyer);
    // chargerScenarios est déclenché automatiquement par l'effect _syncFoyer
    this.router.navigate(['/f', foyer.id, 'dashboard-mensuel']);
    this.visible.set(false);
  }

  onScenarioChange(scenario: ScenarioDto): void {
    this.contexte.setScenario(scenario);
    this.visible.set(false);
  }
}
