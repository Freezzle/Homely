import { CommonModule } from '@angular/common';
import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { CarteIndicateurComponent } from '../shared/components/carte-indicateur/carte-indicateur.component';
import { IndicatorItem } from '../shared/models/indicator.model';
import { DashboardFacadeService } from '../shared/services/dashboard-facade.service';

@Component({
  selector: 'app-membres-view',
  standalone: true,
  imports: [CommonModule, CarteIndicateurComponent],
  templateUrl: './membres-view.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class MembresViewComponent {
  protected readonly facade = inject(DashboardFacadeService);

  protected openIndicator(item: IndicatorItem): void {
    this.facade.ouvrirIndicateur(this.facade.dashboardViewLabel('membres'), item.indicator, item.data);
  }
}
