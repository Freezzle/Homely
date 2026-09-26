import { Component, ChangeDetectionStrategy, computed, inject, input } from '@angular/core';
import { CommonModule } from '@angular/common';
import { DividerModule } from 'primeng/divider';
import { TauxEffortCardData } from '../../../../shared/components/taux-effort-card/taux-effort-card.component';
import { IndicatorCardComponent } from '../../../../shared/components/indicator-bar/indicator-bar-card.component';
import { TagComponent } from '../../../../shared/components/tag/tag.component';
import { MontantPipe } from '../../../../core/pipes/format.pipes';
import { I18nService } from '../../../../core/i18n/i18n.service';
import { buildTauxEffortDrawerView } from './taux-effort-membre-drawer-content.helper';

/**
 * Contenu du drawer pour l'indicateur "Taux d'effort par membre".
 *
 * Rendu à base de 3 `<app-indicator-card>` empilées (une par jauge : charges,
 * charges + réserves, charges + réserves + argent de poche) alimentées par
 * `buildTauxEffortDrawerView()` — plus de dépendance à `TauxEffortCardComponent`.
 * Conserve autour :
 *  - un en-tête avec le tag membre + un badge de zone (Confortable/Correct/Tendu/Saturé) ;
 *  - un message de conseil sous les cartes (Tendu/Saturé) ;
 *  - un bloc N/A quand les revenus sont nuls (mêmes textes que la carte historique).
 */
@Component({
  selector: 'app-taux-effort-membre-drawer-content',
  standalone: true,
  imports: [CommonModule, DividerModule, IndicatorCardComponent, TagComponent, MontantPipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './taux-effort-membre-drawer-content.component.html',
  styleUrl: './taux-effort-membre-drawer-content.component.scss',
})
export class TauxEffortMembreDrawerContentComponent {
  private readonly i18n = inject(I18nService);
  protected readonly t = this.i18n.translations();

  /** Convention `IndicatorDrawerService` : reçoit le payload transmis à `open({ data })`. */
  readonly data = input<TauxEffortCardData>();

  protected readonly view = computed(() => {
    const d = this.data();
    return d ? buildTauxEffortDrawerView(d, this.t) : null;
  });
}
