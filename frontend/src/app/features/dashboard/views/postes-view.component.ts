import { CommonModule } from '@angular/common';
import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { SkeletonModule } from 'primeng/skeleton';
import { CarteInfoComponent } from '../../../shared/components/carte-info/carte-info.component';
import { IndicateurDonutComponent } from '../../../shared/components/indicateurs/donut/indicateur-donut.component';
import { CarteIndicateurComponent } from '../shared/components/carte-indicateur/carte-indicateur.component';
import { IndicatorItem } from '../shared/models/indicator.model';
import { DashboardFacadeService } from '../shared/services/dashboard-facade.service';

@Component({
  selector: 'app-postes-view',
  standalone: true,
  imports: [CommonModule, SkeletonModule, CarteInfoComponent, IndicateurDonutComponent, CarteIndicateurComponent],
  templateUrl: './postes-view.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PostesViewComponent {
  protected readonly facade = inject(DashboardFacadeService);

  protected openIndicator(item: IndicatorItem): void {
    this.facade.ouvrirIndicateur(this.facade.dashboardViewLabel('postes'), item.indicator, item.data);
  }
}
