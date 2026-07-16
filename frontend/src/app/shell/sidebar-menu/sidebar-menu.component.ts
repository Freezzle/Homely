import { Component, inject, computed } from '@angular/core';
import { Router } from '@angular/router';
import { PanelMenuModule } from 'primeng/panelmenu';
import { MenuItem } from 'primeng/api';
import { ContexteService } from '../../core/services/contexte.service';
import { FR } from '../../core/i18n/fr';

@Component({
  selector: 'app-sidebar-menu',
  standalone: true,
  imports: [PanelMenuModule],
  template: `
    <nav class="w-56 h-full bg-surface-0 dark:bg-surface-900 border-r border-surface-200 dark:border-surface-700 overflow-y-auto py-2">
      <p-panelMenu [model]="menuItems()" styleClass="border-none" />
    </nav>
  `,
})
export class SidebarMenuComponent {
  readonly t = FR;
  private contexte = inject(ContexteService);
  private router = inject(Router);

  readonly menuItems = computed<MenuItem[]>(() => {
    const foyerId = this.contexte.foyerId();
    if (!foyerId) return [];
    const base = `/f/${foyerId}`;
    return [
      {
        label: this.t.nav.dashboardAnnuel, icon: 'pi pi-chart-bar',
        command: () => this.router.navigate([`${base}/dashboard-annuel`]),
      },
      {
        label: this.t.nav.dashboardMensuel, icon: 'pi pi-calendar',
        command: () => this.router.navigate([`${base}/dashboard-mensuel`]),
      },
      { separator: true },
      { label: this.t.nav.scenarios, icon: 'pi pi-sitemap', command: () => this.router.navigate([`${base}/scenarios`]) },
      { separator: true },
      { label: this.t.nav.revenus, icon: 'pi pi-arrow-down', command: () => this.router.navigate([`${base}/revenus`]) },
      { label: this.t.nav.charges, icon: 'pi pi-arrow-up', command: () => this.router.navigate([`${base}/charges`]) },
      { label: this.t.nav.reserves, icon: 'pi pi-wallet', command: () => this.router.navigate([`${base}/reserves`]) },
      { label: this.t.nav.objectifs, icon: 'pi pi-flag', command: () => this.router.navigate([`${base}/objectifs`]) },
      { separator: true },
      {
        label: this.t.nav.referentiels, icon: 'pi pi-cog',
        items: [
          { label: this.t.nav.membres, icon: 'pi pi-users', command: () => this.router.navigate([`${base}/referentiels/membres`]) },
          { label: this.t.nav.comptes, icon: 'pi pi-credit-card', command: () => this.router.navigate([`${base}/referentiels/comptes`]) },
          { label: this.t.nav.categories, icon: 'pi pi-tags', command: () => this.router.navigate([`${base}/referentiels/categories`]) },
          { label: this.t.nav.actifs, icon: 'pi pi-chart-line', command: () => this.router.navigate([`${base}/referentiels/actifs`]) },
          { label: this.t.nav.taux, icon: 'pi pi-dollar', command: () => this.router.navigate([`${base}/referentiels/taux`]) },
        ],
      },
      { separator: true },
      { label: this.t.nav.parametres, icon: 'pi pi-sliders-h', command: () => this.router.navigate([`${base}/parametres`]) },
      ...(this.contexte.estOwner()
        ? [{ label: this.t.nav.acces, icon: 'pi pi-lock', command: () => this.router.navigate([`${base}/acces`]) }]
        : []),
    ];
  });
}
