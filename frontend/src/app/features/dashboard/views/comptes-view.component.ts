import { CommonModule } from '@angular/common';
import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { CardModule } from 'primeng/card';
import { DashboardSectionComponent } from '../shared/components/dashboard-section/dashboard-section.component';
import { IndicatorCardComponent } from '../shared/components/indicator-card/indicator-card.component';
import { TableVirementsComptesComponent } from '../shared/components/table-virements-comptes/table-virements-comptes.component';
import { DashboardFacadeService } from '../shared/services/dashboard-facade.service';

@Component({
  selector: 'app-comptes-view',
  standalone: true,
  imports: [CommonModule, CardModule, DashboardSectionComponent, IndicatorCardComponent, TableVirementsComptesComponent],
  templateUrl: './comptes-view.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ComptesViewComponent {
  protected readonly facade = inject(DashboardFacadeService);

  protected openIndicator(item: { indicator: any; data: unknown }): void {
    this.facade.ouvrirIndicateur(this.facade.dashboardViewLabel('comptes'), item.indicator, item.data);
  }

  protected onVirementBascule(event: { virementId: string; fait: boolean }): void {
    this.facade.basculerVirementCompteFait(event.virementId);
  }
}
