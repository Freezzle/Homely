import { Component, inject, computed, effect } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink, RouterLinkActive } from '@angular/router';
import { SidebarModule } from 'primeng/sidebar';
import { ButtonModule } from 'primeng/button';
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
  imports: [CommonModule, RouterLink, RouterLinkActive, SidebarModule, ButtonModule],
             styles: [`:host { display: contents; }`],
  template: `
      <p-sidebar
              id="main-nav"
              side="left"
              variant="sidebar"
              [collapsible]="viewport.estCompact() ? 'offcanvas' : 'icon'"
              width="14rem"
              [overlay]="viewport.estCompact()"
              [open]="contexte.sidebarOuverte()"
              (openChange)="contexte.sidebarOuverte.set($event)"
              [dismissable]="viewport.estCompact()">

          <p-sidebar-spacer/>
          <p-sidebar-aside>
              <p-sidebar-panel>
                  <p-sidebar-header>
                      <div class="flex items-center justify-between gap-2 w-full px-1">
                        <p-button
                            pSidebarTrigger
                            target="main-nav"
                            [icon]="'pi pi-bars'"
                            [ariaLabel]="t.commun.fermer"
                            [rounded]="true"
                            severity="secondary"
                            [text]="true"
                        />
                      </div>
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
                                                    @if (item.children && item.children.length > 0) {
                                                      <i class="pi pi-chevron-down ml-auto"></i>
                                                    }
                                                  </button>
                                                  <p-sidebar-menu-sub>
                                                      @for (child of item.children; track child.label) {
                                                          <p-sidebar-menu-sub-item>
                                                              <a [routerLink]="child.route!"
                                                                 routerLinkActive
                                                                 #rla="routerLinkActive"
                                                                 pSidebarMenuSubButton
                                                                 [isActive]="rla.isActive"
                                                                 (click)="fermerSiMobile()">
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
              </p-sidebar-panel>
          </p-sidebar-aside>
      </p-sidebar>
  `,
})
export class SidebarMenuComponent {
  readonly t = FR;
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
            label: this.t.nav.referentiels, icon: 'pi pi-cog', defaultOpen: !this.viewport.estMobile(),
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
