import { Component, inject, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink, RouterLinkActive } from '@angular/router';
import { SidebarModule } from 'primeng/sidebar';
import { ContexteService } from '../../core/services/contexte.service';
import { ViewportService } from '../../core/services/viewport.service';
import { FR } from '../../core/i18n/fr';

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
  imports: [CommonModule, RouterLink, RouterLinkActive, SidebarModule],
  template: `
    <p-sidebar
      id="main-nav"
      side="left"
      variant="sidebar"
      collapsible="offcanvas"
      width="14rem"
      [overlay]="viewport.estMobile()"
      [(open)]="contexte.sidebarOuverte"
      [dismissable]="true">

      <p-sidebar-header>
        <span class="text-base font-semibold px-1">Homely</span>
      </p-sidebar-header>

      <p-sidebar-content>
        @for (section of sections(); track $index) {
          <p-sidebar-group>
            @if (section.label) {
              <p-sidebar-group-label>{{ section.label }}</p-sidebar-group-label>
            }
            <p-sidebar-group-content>
              <p-sidebar-menu>
                @for (item of section.items; track item.label) {
                  @if (item.children && item.children.length > 0) {
                    <p-sidebar-menu-item collapsible [defaultOpen]="item.defaultOpen">
                      <button type="button" pSidebarMenuButton>
                        <i [class]="item.icon"></i>
                        <span>{{ item.label }}</span>
                      </button>
                      <p-sidebar-menu-sub>
                        @for (child of item.children; track child.label) {
                          <p-sidebar-menu-sub-item>
                            <a [routerLink]="child.route!"
                               routerLinkActive
                               #rla="routerLinkActive"
                               pSidebarMenuSubButton
                               [isActive]="rla.isActive">
                              <i [class]="child.icon"></i>
                              <span>{{ child.label }}</span>
                            </a>
                          </p-sidebar-menu-sub-item>
                        }
                      </p-sidebar-menu-sub>
                    </p-sidebar-menu-item>
                  } @else {
                    <p-sidebar-menu-item>
                      <a [routerLink]="item.route!"
                         routerLinkActive
                         #rla="routerLinkActive"
                         pSidebarMenuButton
                         [isActive]="rla.isActive"
                         (click)="fermerSiMobile()">
                        <i [class]="item.icon"></i>
                        <span>{{ item.label }}</span>
                      </a>
                    </p-sidebar-menu-item>
                  }
                }
              </p-sidebar-menu>
            </p-sidebar-group-content>
          </p-sidebar-group>
        }
      </p-sidebar-content>
    </p-sidebar>
  `,
})
export class SidebarMenuComponent {
  readonly t = FR;
  readonly contexte = inject(ContexteService);
  readonly viewport = inject(ViewportService);

  readonly sections = computed<NavSection[]>(() => {
    const foyerId = this.contexte.foyerId();
    if (!foyerId) return [];
    const base = `/f/${foyerId}`;

    const sections: NavSection[] = [
      {
        label: this.t.nav.sections.pilotage,
        items: [
          { label: this.t.nav.dashboardAnnuel,  icon: 'pi pi-chart-bar', route: `${base}/dashboard-annuel` },
          { label: this.t.nav.dashboardMensuel, icon: 'pi pi-calendar',  route: `${base}/dashboard-mensuel` },
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
            label: this.t.nav.referentiels, icon: 'pi pi-cog', defaultOpen: false,
            children: [
              { label: this.t.nav.membres,    icon: 'pi pi-users',       route: `${base}/referentiels/membres` },
              { label: this.t.nav.comptes,    icon: 'pi pi-credit-card', route: `${base}/referentiels/comptes` },
              { label: this.t.nav.categories, icon: 'pi pi-tags',        route: `${base}/referentiels/categories` },
              { label: this.t.nav.actifs,     icon: 'pi pi-chart-line',  route: `${base}/referentiels/actifs` },
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

  /** Ferme automatiquement la sidebar après navigation en mode overlay (mobile). */
  fermerSiMobile(): void {
    if (this.viewport.estMobile()) {
      this.contexte.sidebarOuverte.set(false);
    }
  }
}
