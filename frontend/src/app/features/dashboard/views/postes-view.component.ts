import { CommonModule } from '@angular/common';
import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { SkeletonModule } from 'primeng/skeleton';
import { CarteInfoComponent } from '../../../shared/components/carte-info/carte-info.component';
import { IndicateurDonutComponent } from '../../../shared/components/indicateurs/donut/indicateur-donut.component';
import { DashboardSectionComponent } from '../shared/components/dashboard-section/dashboard-section.component';
import { IndicatorCardComponent } from '../shared/components/indicator-card/indicator-card.component';
import { DashboardFacadeService } from '../shared/services/dashboard-facade.service';

@Component({
  selector: 'app-postes-view',
  standalone: true,
  imports: [CommonModule, SkeletonModule, CarteInfoComponent, IndicateurDonutComponent, DashboardSectionComponent, IndicatorCardComponent],
  templateUrl: './postes-view.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PostesViewComponent {
  protected readonly facade = inject(DashboardFacadeService);

  protected openIndicator(item: { indicator: any; data: unknown }): void {
    this.facade.ouvrirIndicateur(this.facade.dashboardViewLabel('postes'), item.indicator, item.data);
  }
}
