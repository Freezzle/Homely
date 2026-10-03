import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { CarteInfoComponent } from '../../../shared/components/carte-info/carte-info.component';
import { IndicateurComparaisonComponent } from '../../../shared/components/indicateurs/comparaison/indicateur-comparaison.component';
import { IndicateurBarresLigneComponent } from '../../../shared/components/indicateurs/barres-ligne/indicateur-barres-ligne.component';
import { IndicateurEntonnoirComponent } from '../../../shared/components/indicateurs/entonnoir/indicateur-entonnoir.component';
import { CarteIndicateurComponent } from '../shared/components/carte-indicateur/carte-indicateur.component';
import { IndicatorItem } from '../shared/models/indicator.model';
import { DashboardFacadeService } from '../shared/services/dashboard-facade.service';

@Component({
  selector: 'app-apercu-view',
  standalone: true,
  imports: [
    CarteInfoComponent,
    IndicateurComparaisonComponent,
    IndicateurBarresLigneComponent,
    IndicateurEntonnoirComponent,
    CarteIndicateurComponent,
  ],
  templateUrl: './apercu-view.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ApercuViewComponent {
  protected readonly facade = inject(DashboardFacadeService);

  protected openIndicator(item: IndicatorItem): void {
    this.facade.ouvrirIndicateur(this.facade.dashboardViewLabel('apercu'), item.indicator, item.data);
  }
}
