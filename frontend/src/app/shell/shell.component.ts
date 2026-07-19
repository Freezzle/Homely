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

@Component({
  selector: 'app-shell',
  standalone: true,
  imports: [RouterOutlet, CommonModule, SidebarModule, TopbarComponent, SidebarMenuComponent],
  template: `
    <p-sidebar-layout class="flex h-screen bg-surface-50 dark:bg-surface-950 mx-auto w-full md:max-w-2/3">
      @if (contexte.foyerId()) {
        <app-sidebar-menu />
      }
      <p-sidebar-main class="flex flex-col flex-1 overflow-hidden">
        <app-topbar class="sticky top-0 z-50" />
        <main class="flex-1 overflow-y-auto p-4 md:p-6">
          <router-outlet />
        </main>
      </p-sidebar-main>
    </p-sidebar-layout>
  `,
})
export class ShellComponent implements OnInit, OnDestroy {
  contexte             = inject(ContexteService);
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
    } else {
      if (this.contexte.foyerId()) {
        this.contexte.setFoyer(null);
      }
      // Pas de foyerId dans l'URL → tenter auto-sélection si un seul foyer
      if (!this.contexte.foyerId()) {
        this.foyerSvc.lister().subscribe(foyers => {
          if (foyers.length === 1) {
            this.contexte.setFoyer(foyers[0]);
            this.chargerContexteFoyer(foyers[0].id);
          }
        });
      }
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
