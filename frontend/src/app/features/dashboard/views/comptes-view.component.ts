import { CommonModule } from '@angular/common';
import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { CarteIndicateurComponent } from '../shared/components/carte-indicateur/carte-indicateur.component';
import { IndicatorItem } from '../shared/models/indicator.model';
import { DashboardFacadeService } from '../shared/services/dashboard-facade.service';

@Component({
  selector: 'app-comptes-view',
  standalone: true,
  imports: [CommonModule, CarteIndicateurComponent],
  templateUrl: './comptes-view.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ComptesViewComponent {
  protected readonly facade = inject(DashboardFacadeService);

  protected openIndicator(item: IndicatorItem): void {
    this.facade.ouvrirIndicateur(this.facade.dashboardViewLabel('comptes'), item.indicator, item.data);
  }

}
