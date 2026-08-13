import { Component, ChangeDetectionStrategy, input } from '@angular/core';
import { BesoinsPlaisirsCardComponent, BesoinsPlaisirsCardData } from '../../../../shared/components/besoins-plaisirs-card/besoins-plaisirs-card.component';

/**
 * Contenu du drawer pour l'indicateur "Plaisirs vs Besoins" : enveloppe fine autour du
 * composant riche `BesoinsPlaisirsCardComponent`, alimentée par le payload
 * `BesoinsPlaisirsCardData` transmis via `IndicatorDrawerService.open({ data })`. Ne
 * contient ni en-tête ni bouton fermer (gérés par `IndicatorDrawerComponent`).
 */
@Component({
  selector: 'app-besoins-plaisirs-drawer-content',
  standalone: true,
  imports: [BesoinsPlaisirsCardComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './besoins-plaisirs-drawer-content.component.html',
})
export class BesoinsPlaisirsDrawerContentComponent {
  /** Convention `IndicatorDrawerService` : reçoit le payload transmis à `open({ data })`. */
  readonly data = input<BesoinsPlaisirsCardData>();
}
