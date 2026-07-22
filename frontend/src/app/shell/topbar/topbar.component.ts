import { Component, inject, signal, OnInit, effect, untracked, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { SelectModule } from 'primeng/select';
import { ButtonModule } from 'primeng/button';
import { TooltipModule } from 'primeng/tooltip';
import { AvatarModule } from 'primeng/avatar';
import { MenuModule } from 'primeng/menu';
import { SidebarModule } from 'primeng/sidebar';
import { MenuItem } from 'primeng/api';
import { ContexteService } from '../../core/services/contexte.service';
import { AuthService } from '../../core/services/auth.service';
import { FoyerService } from '../../core/services/referentiel.service';
import { ScenarioService } from '../../core/services/scenario-poste.service';
import { FoyerDto, ScenarioDto } from '../../core/models/api.models';
import { I18nService } from '../../core/i18n/i18n.service';

@Component({
  selector: 'app-topbar',
  standalone: true,
  imports: [CommonModule, FormsModule, SelectModule, ButtonModule, TooltipModule, AvatarModule, MenuModule, SidebarModule],
  template: `
    <div class="flex flex-wrap items-center gap-2 md:gap-3 px-3 md:px-4 py-2 border-b border-surface-200 dark:border-surface-700 shadow-sm">
      <!-- Bouton toggle sidebar (mobile uniquement) -->
      @if (contexte.foyerId()) {
        <button type="button"
                pSidebarTrigger
                target="main-nav"
                class="lg:hidden inline-flex items-center justify-center w-9 h-9 rounded hover:bg-surface-100 dark:hover:bg-surface-800 text-surface-700 dark:text-surface-200"
                [attr.aria-label]="t.nav.ouvrirMenu">
          <i class="pi pi-bars"></i>
        </button>
      }


      <!-- Sélecteur foyer (masqué si aucun foyer) -->
      @if (afficherSelecteurs()) {
        <p-select appendTo="body"
          [options]="foyers()"
          [(ngModel)]="foyerSelectionne"
          optionLabel="nom"
          [placeholder]="t.foyer.choisir"
          class="min-w-40 md:min-w-44"
          (onChange)="onFoyerChange($event.value)"
        />
      }

       <!-- Sélecteur scénario -->
       @if (afficherSelecteurs() && contexte.foyerCourant() && scenarios().length > 0) {
         <p-select appendTo="body"
           [options]="scenarios()"
           [(ngModel)]="scenarioSelectionne"
           optionLabel="nom"
           [placeholder]="t.scenario.choisir"
           class="min-w-44 md:min-w-52"
           (onChange)="onScenarioChange($event.value)"
         >
           <ng-template #item let-s>
             <span>{{ s.nom }}</span>
             @if (s.estReference) {
               <span class="ml-2 text-xs bg-primary text-white rounded px-1">{{ t.scenario.reference }}</span>
             }
           </ng-template>
         </p-select>
       }

      <div class="flex-1"></div>

      <!-- Sélecteur de langue -->
      <input pButton
        [ariaLabel]="t.commun.changerLangue"
        [pTooltip]="t.commun.changerLangue"
        tooltipPosition="bottom"
        [rounded]="true"
        severity="secondary"
        [text]="true"
             value="{{ i18n.currentLang() === 'en' ? 'EN' : 'FR' }}"
        (click)="basculerLangue()"/>

      <!-- Bouton dark mode -->
      <p-button
        [icon]="contexte.isDark() ? 'pi pi-sun' : 'pi pi-moon'"
        [ariaLabel]="t.commun.basculerTheme"
        [rounded]="true"
        severity="secondary"
        [text]="true"
        (click)="contexte.toggleDark()"
      />

      <!-- Menu utilisateur -->
      <p-button
        icon="pi pi-user"
        [ariaLabel]="t.commun.menuUtilisateur"
        [rounded]="true"
        severity="secondary"
        [text]="true"
        (click)="menuUser.toggle($event)"
      />
      <p-menu #menuUser [popup]="true" [model]="userMenuItems"
              appendTo="body" />
    </div>
  `,
})
export class TopbarComponent implements OnInit {
  readonly i18n = inject(I18nService);
  readonly t = this.i18n.translations();
  contexte = inject(ContexteService);
  private auth = inject(AuthService);
  private foyerSvc = inject(FoyerService);
  private scenarioSvc = inject(ScenarioService);
  private router = inject(Router);

  foyers = signal<FoyerDto[]>([]);
  scenarios = signal<ScenarioDto[]>([]);
  readonly afficherSelecteurs = computed(() => this.foyers().length > 0);
  foyerSelectionne: FoyerDto | null = null;
  scenarioSelectionne: ScenarioDto | null = null;

  userMenuItems: MenuItem[] = [
    { label: this.t.auth.logout, icon: 'pi pi-sign-out', command: () => this.auth.deconnecter() },
  ];

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
      return;
    }
    this.contexte.setFoyer(foyer);
    // chargerScenarios est déclenché automatiquement par l'effect _syncFoyer
    this.router.navigate(['/f', foyer.id, 'dashboard-annuel']);
  }

  onScenarioChange(scenario: ScenarioDto): void {
    this.contexte.setScenario(scenario);
  }

  basculerLangue(): void {
    const prochaine = this.i18n.currentLang() === 'en' ? 'fr' : 'en';
    this.i18n.setLanguage(prochaine);
  }
}
