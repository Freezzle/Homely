import { CommonModule } from '@angular/common';
import { ChangeDetectionStrategy, Component, Signal, inject, input } from '@angular/core';
import { EventGridComponent } from '../../../../shared/components/event-grid/event-grid.component';
import { TimelineItem } from '../../../../shared/components/timeline/timeline.component';
import { I18nService } from '../../../../core/i18n/i18n.service';

/**
 * Payload transmis via `IndicatorDrawerService.open({ data })` — références de signaux pour
 * rester réactif (changement de mois/année). `layout` fige le rendu selon le contexte
 * d'ouverture : `'grouped'` (année, comportement d'origine) ou `'flat'` (mois — tous les
 * événements partagent le même "when", l'en-tête de section serait redondante).
 */
export interface EvenementsDrawerData {
  items: Signal<TimelineItem[]>;
  devise: Signal<string>;
  layout: 'grouped' | 'flat';
  onSelect: (item: TimelineItem) => void;
}

/**
 * Contenu du drawer pour l'indicateur "Les événements du mois/de l'année" : enveloppe fine
 * autour du composant partagé `<app-event-grid>`, sans le retirer des onglets "Ce qui
 * change"/"Événement" d'origine.
 */
@Component({
  selector: 'app-evenements-drawer-content',
  standalone: true,
  imports: [CommonModule, EventGridComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './evenements-drawer-content.component.html',
})
export class EvenementsDrawerContentComponent {
  private readonly i18n = inject(I18nService);
  protected readonly t = this.i18n.translations();

  readonly data = input<EvenementsDrawerData>();
}
