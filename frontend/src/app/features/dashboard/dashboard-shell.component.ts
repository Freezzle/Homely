import { CommonModule } from '@angular/common';
import { Component, computed, effect, inject, input, numberAttribute } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { ReactiveFormsModule } from '@angular/forms';
import { ActivatedRoute, NavigationEnd, Router, RouterOutlet } from '@angular/router';
import { filter, map, startWith } from 'rxjs';
import { DialogModule } from 'primeng/dialog';
import { SkeletonModule } from 'primeng/skeleton';
import { PeriodRailComponent } from '../../shared/components/period-rail/period-rail.component';
import { DashboardView, ViewSwitcherComponent } from '../../shared/components/view-switcher/view-switcher.component';
import { SelectComponent, InputNumberComponent, InputTextComponent } from '../../shared/components/form-fields';
import { ButtonComponent } from '../../shared/components/button/button.component';
import { IndicatorDrawerComponent } from './shared/components/indicator-drawer/indicator-drawer.component';
import { DashboardFacadeService, DashboardViewKey } from './shared/services/dashboard-facade.service';

@Component({
  selector: 'app-dashboard-shell',
  standalone: true,
  imports: [
    CommonModule,
    RouterOutlet,
    ReactiveFormsModule,
    DialogModule,
    SkeletonModule,
    PeriodRailComponent,
    ViewSwitcherComponent,
    SelectComponent,
    InputNumberComponent,
    InputTextComponent,
    ButtonComponent,
    IndicatorDrawerComponent,
  ],
  providers: [DashboardFacadeService],
  templateUrl: './dashboard-shell.component.html',
})
export class DashboardShellComponent {
  protected readonly facade = inject(DashboardFacadeService);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);

  readonly annee = input.required<number, string>({ transform: numberAttribute });
  readonly mois = input<number | undefined, string | undefined>(undefined, {
    transform: (value) => value !== undefined ? Number.parseInt(value, 10) : undefined,
  });
  readonly sujetId = input.required<string>();

  private readonly activeViewKey = toSignal(
    this.router.events.pipe(
      filter((event) => event instanceof NavigationEnd),
      startWith(null),
      map(() => (this.route.firstChild?.routeConfig?.path as DashboardViewKey | undefined) ?? 'apercu'),
    ),
    { initialValue: 'apercu' as DashboardViewKey },
  );

  protected readonly currentViewKey = computed(() => this.activeViewKey());

  protected readonly dashboardViews = computed<DashboardView[]>(() => [
    { key: 'apercu', label: this.facade.dashboardViewLabel('apercu'), icon: 'apercu' },
    { key: 'comptes', label: this.facade.dashboardViewLabel('comptes'), icon: 'comptes' },
    { key: 'postes', label: this.facade.dashboardViewLabel('postes'), icon: 'postes' },
    { key: 'membres', label: this.facade.dashboardViewLabel('membres'), icon: 'membres' },
  ]);

  private readonly syncRouteParams = effect(() => {
    this.facade.setRouteParams({
      annee: this.annee(),
      mois: this.mois(),
      sujetId: this.sujetId(),
    });
  });

  private readonly syncViewKey = effect(() => {
    this.facade.setCurrentViewKey(this.currentViewKey());
  });

  protected onViewChange(viewKey: DashboardView['key']): void {
    if (viewKey === this.currentViewKey()) {
      return;
    }

    void this.router.navigate([viewKey], {
      relativeTo: this.route,
      queryParamsHandling: 'preserve',
    });
  }
}
