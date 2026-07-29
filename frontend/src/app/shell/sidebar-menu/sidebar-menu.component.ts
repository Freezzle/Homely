import { Component, inject, computed, effect } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink, RouterLinkActive } from '@angular/router';
import { SidebarModule } from 'primeng/sidebar';
import { ButtonModule } from 'primeng/button';
import { ContexteService } from '../../core/services/contexte.service';
import { ViewportService } from '../../core/services/viewport.service';
import { I18nService } from '../../core/i18n/i18n.service';

/** Un item de navigation simple (feuille ou nœud parent). */
interface NavItem {
  label: string;
  icon: string;
  route?: string;
  children?: NavItem[];
  /** Ouvre la sous-navigation par défaut. */
  defaultOpen?: boolean;
}

/** Une section (groupe) du menu. */
interface NavSection {
  label?: string;
  items: NavItem[];
}

@Component({
  selector: 'app-sidebar-menu',
  standalone: true,
  imports: [CommonModule, RouterLink, RouterLinkActive, SidebarModule, ButtonModule],
             styles: [`:host { display: contents; }`],
  templateUrl: './sidebar-menu.component.html',
})
export class SidebarMenuComponent {
  private readonly i18n = inject(I18nService);
  readonly t = this.i18n.translations();
  readonly contexte = inject(ContexteService);
  readonly viewport = inject(ViewportService);
  private precedentCompact: boolean | null = null;

  readonly sections = computed<NavSection[]>(() => {
    const foyerId = this.contexte.foyerId();
    if (!foyerId) return [];
    const base = `/f/${foyerId}`;

    const sections: NavSection[] = [
      {
        label: this.t.nav.sections.pilotage,
        items: [
          { label: this.t.nav.dashboardMensuel, icon: 'pi pi-calendar',  route: `${base}/dashboard-mensuel` },
          { label: this.t.nav.dashboardAnnuel,  icon: 'pi pi-chart-bar', route: `${base}/dashboard-annuel` },
          { label: this.t.nav.scenarios,        icon: 'pi pi-sitemap',   route: `${base}/scenarios` },
        ],
      },
      {
        label: this.t.nav.sections.budget,
        items: [
          { label: this.t.nav.revenus,   icon: 'pi pi-arrow-down', route: `${base}/revenus` },
          { label: this.t.nav.charges,   icon: 'pi pi-arrow-up',   route: `${base}/charges` },
          { label: this.t.nav.reserves,  icon: 'pi pi-wallet',     route: `${base}/reserves` },
          { label: this.t.nav.objectifs, icon: 'pi pi-flag',       route: `${base}/objectifs` },
        ],
      },
      {
        label: this.t.nav.sections.reglages,
        items: [
          {
            label: this.t.nav.referentiels, icon: 'pi pi-cog', defaultOpen: !this.viewport.estMobile(),
            children: [
              { label: this.t.nav.membres,    icon: 'pi pi-users',       route: `${base}/referentiels/membres` },
              { label: this.t.nav.comptes,    icon: 'pi pi-credit-card', route: `${base}/referentiels/comptes` },
              { label: this.t.nav.categories, icon: 'pi pi-tags',        route: `${base}/referentiels/categories` },
              { label: this.t.nav.taux,       icon: 'pi pi-dollar',      route: `${base}/referentiels/taux` },
            ],
          },
          { label: this.t.nav.parametres, icon: 'pi pi-sliders-h', route: `${base}/parametres` },
          ...(this.contexte.estOwner()
            ? [{ label: this.t.nav.acces, icon: 'pi pi-lock', route: `${base}/acces` }]
            : []),
        ],
      },
    ];
    return sections;
  });

  private readonly _syncSidebarMode = effect(() => {
    const compact = this.viewport.estCompact();
    if (this.precedentCompact === compact) {
      return;
    }

    this.precedentCompact = compact;
    this.contexte.sidebarOuverte.set(!compact);
  });

  /** Ferme automatiquement la sidebar après navigation en mode overlay (mobile + tablette). */
  fermerSiMobile(): void {
    if (this.viewport.estCompact()) {
      this.fermerSidebar();
    }
  }

  fermerSidebar(): void {
    this.contexte.sidebarOuverte.set(false);
  }
}
