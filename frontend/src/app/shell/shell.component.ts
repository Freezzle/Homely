import { Component, OnInit, OnDestroy, inject } from '@angular/core';
import { RouterOutlet, Router, NavigationEnd } from '@angular/router';
import { CommonModule } from '@angular/common';
import { filter, Subscription } from 'rxjs';
import { SidebarModule } from 'primeng/sidebar';
import { TopbarComponent } from './topbar/topbar.component';
import { SidebarMenuComponent } from './sidebar-menu/sidebar-menu.component';
import { ContexteService } from '../core/services/contexte.service';
import { FoyerService, MembreService } from '../core/services/referentiel.service';
import { ScenarioService } from '../core/services/scenario-poste.service';
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
   * Extrait le foyerId de l'URL courante (/f/<uuid>/...)
   * et charge le foyer dans le contexte si nécessaire.
   */
  private syncFoyerDepuisUrl(): void {
    const match   = this.router.url.match(/\/f\/([\w-]{36})/);
    const foyerId = match?.[1] ?? null;

    if (foyerId) {
      if (foyerId !== this.contexte.foyerId()) {
        // Nouveau foyer dans l'URL : charger depuis l'API
        this.foyerSvc.obtenir(foyerId).subscribe(f => {
          this.contexte.setFoyer(f);
          this.chargerContexteFoyer(foyerId);
        });
      }
      // Scénario : charger si absent
      if (!this.contexte.scenarioId()) {
        this.chargerContexteFoyer(foyerId);
      }
    } else if (this.contexte.foyerId()) {
      // Pas de foyerId dans l'URL : le contexte foyer (et tout ce qui en
      // dépend : scénario, membres) doit rester null. Pas d'auto-sélection :
      // la navigation vers un foyer est toujours explicite.
      this.contexte.setFoyer(null);
    }
  }

  private chargerContexteFoyer(foyerId: string): void {
    this.membreSvc.lister(foyerId).subscribe(m => this.contexte.setMembres(m));
    this.scenarioSvc.lister(foyerId).subscribe(scenarios => {
      const ref = scenarios.find(s => s.estReference) ?? scenarios[0];
      if (ref) this.contexte.setScenario(ref);
    });
  }
}
