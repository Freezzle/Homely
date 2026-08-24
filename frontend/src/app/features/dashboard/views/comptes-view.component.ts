import { CommonModule } from '@angular/common';
import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { CardModule } from 'primeng/card';
import { DashboardSectionComponent } from '../shared/components/dashboard-section/dashboard-section.component';
import { IndicatorCardComponent } from '../shared/components/indicator-card/indicator-card.component';
import { ComptesHubRecapComponent } from '../indicators/virements-comptes/comptes-hub-recap/comptes-hub-recap.component';
import { DashboardFacadeService } from '../shared/services/dashboard-facade.service';

@Component({
  selector: 'app-comptes-view',
  standalone: true,
  imports: [CommonModule, CardModule, DashboardSectionComponent, IndicatorCardComponent, ComptesHubRecapComponent],
  templateUrl: './comptes-view.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ComptesViewComponent {
  protected readonly facade = inject(DashboardFacadeService);

  protected openIndicator(item: { indicator: any; data: unknown }): void {
    this.facade.ouvrirIndicateur(this.facade.dashboardViewLabel('comptes'), item.indicator, item.data);
  }
}
