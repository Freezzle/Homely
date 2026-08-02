import { Component, OnInit, OnDestroy, inject, signal, effect, untracked } from '@angular/core';
import { RouterOutlet, Router, NavigationEnd } from '@angular/router';
import { CommonModule } from '@angular/common';
import { filter, Subscription } from 'rxjs';
import { SidebarModule } from 'primeng/sidebar';
import { TopbarComponent } from './topbar/topbar.component';
import { SidebarMenuComponent } from './sidebar-menu/sidebar-menu.component';
import { ContexteService } from '../core/services/contexte.service';
import { FoyerService, MembreService } from '../core/services/referentiel.service';
import { ScenarioService } from '../core/services/scenario-poste.service';
import { creerChargementReactif } from '../core/utils/reference-data.util';
import {ViewportService} from '../core/services/viewport.service';

@Component({
  selector: 'app-shell',
  standalone: true,
  imports: [RouterOutlet, CommonModule, SidebarModule, TopbarComponent, SidebarMenuComponent],
  templateUrl: './shell.component.html',
})
export class ShellComponent implements OnInit, OnDestroy {
  contexte             = inject(ContexteService);
    viewport = inject(ViewportService);
  private foyerSvc     = inject(FoyerService);
  private membreSvc    = inject(MembreService);
  private scenarioSvc  = inject(ScenarioService);
  private router       = inject(Router);
  private sub?: Subscription;

  /** Id du foyer extrait de l'URL courante (`/f/<uuid>/...`), `null` sinon. Clé unique
   *  partagée par les 3 chargements ci-dessous : dès qu'elle change, `rxResource`
   *  annule automatiquement les requêtes en vol pour l'ancien foyer — plus aucun
   *  risque qu'une réponse tardive (foyer précédent) écrase les données du foyer
   *  actuellement affiché (race auparavant possible avec des `.subscribe()` bruts). */
  private readonly _foyerIdDepuisUrl = signal<string | null>(null);

  private readonly _foyerChargement = creerChargementReactif(this._foyerIdDepuisUrl, (foyerId) =>
    this.foyerSvc.obtenir(foyerId),
  );
  private readonly _membresChargement = creerChargementReactif(this._foyerIdDepuisUrl, (foyerId) =>
    this.membreSvc.lister(foyerId),
  );
  private readonly _scenariosChargement = creerChargementReactif(this._foyerIdDepuisUrl, (foyerId) =>
    this.scenarioSvc.lister(foyerId),
  );

  /** Applique dans le contexte global les résultats disponibles, dans l'ordre
   *  foyer → membres → scénario. Idempotent et sans dépendance d'ordre d'arrivée
   *  réseau : se ré-exécute à chaque résolution partielle, et `contexte.setFoyer()`
   *  ne vide membres/scénario que si l'id de foyer a réellement changé. */
  private readonly _syncContexteFoyer = effect(() => {
    const foyerId = this._foyerIdDepuisUrl();
    if (!foyerId) {
      untracked(() => this.contexte.setFoyer(null));
      return;
    }
    const foyer = this._foyerChargement.donnees();
    const membres = this._membresChargement.donnees();
    const scenarios = this._scenariosChargement.donnees();
    untracked(() => {
      // Garde-fou : ignore une valeur transitoirement obsolète (Resource API pouvant
      // garder la dernière valeur résolue visible pendant le chargement de la nouvelle clé).
      if (foyer?.id === foyerId) this.contexte.setFoyer(foyer);
      if (membres) this.contexte.setMembres(membres);
      if (scenarios) {
        const reference = scenarios.find((s) => s.estReference) ?? scenarios[0];
        if (reference) this.contexte.setScenario(reference);
      }
    });
  });

  ngOnInit(): void {
    // ① Charger IMMÉDIATEMENT le foyer depuis l'URL courante
    //    (évite la race condition du premier rendu)
    this.syncFoyerDepuisUrl();

    // ② Réagir aux navigations futures
    this.sub = this.router.events
      .pipe(filter(e => e instanceof NavigationEnd))
      .subscribe(() => this.syncFoyerDepuisUrl());
  }

  ngOnDestroy(): void { this.sub?.unsubscribe(); }

  /**
   * Extrait le foyerId de l'URL courante (/f/<uuid>/...) et met à jour la clé de
   * chargement partagée. Le chargement effectif (foyer, membres, scénario) est
   * entièrement délégué aux `creerChargementReactif` + l'effect ci-dessus.
   */
  private syncFoyerDepuisUrl(): void {
    const match   = this.router.url.match(/\/f\/([\w-]{36})/);
    const foyerId = match?.[1] ?? null;
    this._foyerIdDepuisUrl.set(foyerId);
  }
}
