import { ChangeDetectionStrategy, Component, inject, input, output } from '@angular/core';
import { I18nService } from '../../../../../core/i18n/i18n.service';
import { ButtonComponent } from '../../../../../shared/components/button/button.component';
import { CarteInfoComponent } from '../../../../../shared/components/carte-info/carte-info.component';
import { IndicateurBarreEmpileeComponent } from '../../../../../shared/components/indicateurs/barre-empilee/indicateur-barre-empilee.component';
import { IndicateurEntonnoirComponent } from '../../../../../shared/components/indicateurs/entonnoir/indicateur-entonnoir.component';
import { IndicateurGaufreComponent } from '../../../../../shared/components/indicateurs/gaufre/indicateur-gaufre.component';
import { IndicateurHeatmapComponent } from '../../../../../shared/components/indicateurs/heatmap/indicateur-heatmap.component';
import { IndicateurSparklineComponent } from '../../../../../shared/components/indicateurs/sparkline/indicateur-sparkline.component';
import { IndicateurNombreTendanceComponent } from '../../../../../shared/components/indicateurs/nombre-tendance/indicateur-nombre-tendance.component';
import { IndicateurProgressionComponent } from '../../../../../shared/components/indicateurs/progression/indicateur-progression.component';
import { Indicator } from '../../models/indicator.model';

/**
 * Carte d'un indicateur du dashboard : `app-carte-info` (titre, aide, badge de valeur clé)
 * + le visuel `app-indicateur-*` décrit par `indicator.visuel` + un bouton « Voir le détail »
 * ouvrant le drawer. Strictement présentationnel.
 */
@Component({
  selector: 'app-carte-indicateur',
  standalone: true,
  imports: [
    ButtonComponent,
    CarteInfoComponent,
    IndicateurBarreEmpileeComponent,
    IndicateurEntonnoirComponent,
    IndicateurGaufreComponent,
    IndicateurHeatmapComponent,
    IndicateurNombreTendanceComponent,
    IndicateurProgressionComponent,
    IndicateurSparklineComponent,
  ],
  templateUrl: './carte-indicateur.component.html',
  styleUrl: './carte-indicateur.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CarteIndicateurComponent {
  protected readonly t = inject(I18nService).translations();

  readonly indicator = input.required<Indicator>();

  readonly detailsClick = output<void>();
}
