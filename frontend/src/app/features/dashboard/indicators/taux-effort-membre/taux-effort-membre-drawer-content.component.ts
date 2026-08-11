import { Component, ChangeDetectionStrategy, input } from '@angular/core';
import { TauxEffortCardComponent, TauxEffortCardData } from '../../../../shared/components/taux-effort-card/taux-effort-card.component';

/**
 * Contenu du drawer pour l'indicateur "Taux d'effort par membre" : enveloppe fine
 * autour du composant riche existant `TauxEffortCardComponent`, alimentée par le
 * payload `TauxEffortCardData` transmis via `IndicatorDrawerService.open({ data })`.
 * Ne contient ni en-tête ni bouton fermer (gérés par `IndicatorDrawerComponent`).
 */
@Component({
  selector: 'app-taux-effort-membre-drawer-content',
  standalone: true,
  imports: [TauxEffortCardComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './taux-effort-membre-drawer-content.component.html',
})
export class TauxEffortMembreDrawerContentComponent {
  /** Convention `IndicatorDrawerService` : reçoit le payload transmis à `open({ data })`. */
  readonly data = input<TauxEffortCardData>();
}
