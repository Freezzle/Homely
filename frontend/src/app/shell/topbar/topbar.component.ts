import { Component, inject, signal, OnInit, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ButtonModule } from 'primeng/button';
import { TooltipModule } from 'primeng/tooltip';
import { AvatarModule } from 'primeng/avatar';
import { MenuModule } from 'primeng/menu';
import { SidebarModule } from 'primeng/sidebar';
import { MenuItem } from 'primeng/api';
import { ContexteService } from '../../core/services/contexte.service';
import { AuthService } from '../../core/services/auth.service';
import { I18nService } from '../../core/i18n/i18n.service';
import { FoyerScenarioSwitcherComponent } from '../foyer-scenario-switcher/foyer-scenario-switcher.component';

@Component({
  selector: 'app-topbar',
  standalone: true,
  imports: [CommonModule, ButtonModule, TooltipModule, AvatarModule, MenuModule, SidebarModule, FoyerScenarioSwitcherComponent],
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


      <!-- Foyer / scénario courants : texte cliquable ouvrant la dialogue de sélection -->
      @if (contexte.foyerCourant()) {
        <button type="button"
                class="flex items-center gap-2 max-w-[50vw] md:max-w-xs px-2 py-1 rounded hover:bg-surface-100 dark:hover:bg-surface-800 text-surface-700 dark:text-surface-200"
                [pTooltip]="t.foyer.changerContexte"
                tooltipPosition="bottom"
                [attr.aria-label]="t.commun.choisirFoyerScenario"
                (click)="switcherVisible.set(true)">
          <i class="pi pi-home"></i>
          <span class="truncate text-sm font-medium">{{ libelleContexte() }}</span>
        </button>
      }

      <div class="flex-1"></div>

      <!-- Sélecteur de langue -->
      <input pButton
        [ariaLabel]="t.commun.changerLangue"
        [pTooltip]="t.commun.changerLangue"
             class="w-10"
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

      <app-foyer-scenario-switcher [(visible)]="switcherVisible" />
    </div>
  `,
})
export class TopbarComponent implements OnInit {
  readonly i18n = inject(I18nService);
  readonly t = this.i18n.translations();
  contexte = inject(ContexteService);
  private auth = inject(AuthService);

  // Visibilité de la dialogue de sélection foyer/scénario.
  readonly switcherVisible = signal(false);

  // Libellé texte affiché à la place des anciens selects : "Foyer · Scénario".
  readonly libelleContexte = computed(() => {
    const foyer = this.contexte.foyerCourant();
    const scenario = this.contexte.scenarioCourant();
    if (!foyer) {
      return '';
    }
    return scenario ? `${foyer.nom} · ${scenario.nom}` : foyer.nom;
  });

  userMenuItems: MenuItem[] = [
    { label: this.t.auth.logout, icon: 'pi pi-sign-out', command: () => this.auth.deconnecter() },
  ];

  ngOnInit(): void {
    // Chargement des foyers/scénarios délégué à FoyerScenarioSwitcherComponent.
  }

  basculerLangue(): void {
    const prochaine = this.i18n.currentLang() === 'en' ? 'fr' : 'en';
    this.i18n.setLanguage(prochaine);
  }
}
