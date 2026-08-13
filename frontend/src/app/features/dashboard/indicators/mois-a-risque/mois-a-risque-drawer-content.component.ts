import { Component, ChangeDetectionStrategy, Signal, inject, input } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MetricRingComponent, MetricRingSegment } from '../../../../shared/components/metric-ring/metric-ring.component';
import { MontantPipe } from '../../../../core/pipes/format.pipes';
import { I18nService } from '../../../../core/i18n/i18n.service';

/** Un mois dont le solde disponible est passé sous le seuil de risque. */
export interface MoisARisqueItem {
  label: string;
  soldeDisponible: number;
}

/**
 * Payload transmis via `IndicatorDrawerService.open({ data })` — références de signaux pour
 * rester réactif (changement de période) sans dupliquer le calcul des segments de l'anneau ni
 * la liste des mois à risque.
 */
export interface MoisARisqueDrawerData {
  ringSegments: Signal<MetricRingSegment[]>;
  ringCenterValue: Signal<string>;
  ringCenterLabel: string;
  moisARisque: Signal<MoisARisqueItem[]>;
  devise: Signal<string>;
}

/**
 * Contenu du drawer pour l'indicateur "Mois à risque" : anneau plein format (mois positifs
 * vs négatifs) + liste détaillée des mois dont le solde disponible est sous le seuil.
 */
@Component({
  selector: 'app-mois-a-risque-drawer-content',
  standalone: true,
  imports: [CommonModule, MetricRingComponent, MontantPipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './mois-a-risque-drawer-content.component.html',
})
export class MoisARisqueDrawerContentComponent {
  private readonly i18n = inject(I18nService);
  protected readonly t = this.i18n.translations();

  readonly data = input<MoisARisqueDrawerData>();
}
