import { CommonModule } from '@angular/common';
import { ChangeDetectionStrategy, Component, Signal, input } from '@angular/core';
import { CompteRecapMensuelDto } from '../../../../core/models/api.models';
import { ComptesMembreRecapComponent } from '../../../../shared/components/comptes-membre-recap/comptes-membre-recap.component';

/**
 * Payload transmis via `IndicatorDrawerService.open({ data })` — références de signaux pour
 * rester réactif (changement de mois).
 */
export interface VirementsComptesDrawerData {
  recaps: Signal<CompteRecapMensuelDto[]>;
  devise: Signal<string>;
  chargement: Signal<boolean>;
}

/**
 * Contenu du drawer pour l'indicateur "Virements des comptes" : enveloppe fine autour du
 * composant partagé `<app-comptes-membre-recap>` (restylé en liste verticale), sans le
 * retirer de l'onglet "Comptes" d'origine.
 */
@Component({
  selector: 'app-virements-comptes-drawer-content',
  standalone: true,
  imports: [CommonModule, ComptesMembreRecapComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './virements-comptes-drawer-content.component.html',
})
export class VirementsComptesDrawerContentComponent {
  readonly data = input<VirementsComptesDrawerData>();
}
