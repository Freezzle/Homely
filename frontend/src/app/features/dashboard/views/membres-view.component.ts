import { CommonModule } from '@angular/common';
import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { DashboardSectionComponent } from '../shared/components/dashboard-section/dashboard-section.component';
import { IndicatorCardComponent } from '../shared/components/indicator-card/indicator-card.component';
import { DashboardFacadeService } from '../shared/services/dashboard-facade.service';

@Component({
  selector: 'app-membres-view',
  standalone: true,
  imports: [CommonModule, DashboardSectionComponent, IndicatorCardComponent],
  templateUrl: './membres-view.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class MembresViewComponent {
  protected readonly facade = inject(DashboardFacadeService);

  protected openIndicator(item: { indicator: any; data: unknown }): void {
    this.facade.ouvrirIndicateur(this.facade.dashboardViewLabel('membres'), item.indicator, item.data);
  }
}
