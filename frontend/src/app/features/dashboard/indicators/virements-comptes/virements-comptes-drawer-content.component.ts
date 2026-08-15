import { CommonModule } from '@angular/common';
import { ChangeDetectionStrategy, Component, Signal, input } from '@angular/core';
import { CompteRecapMensuelDto } from '../../../../core/models/api.models';
import { ComptesHubRecapComponent } from './comptes-hub-recap/comptes-hub-recap.component';

/**
 * Payload transmis via `IndicatorDrawerService.open({ data })` — références de signaux pour
 * rester réactif (changement de mois).
 */
export interface VirementsComptesDrawerData {
  recaps: Signal<CompteRecapMensuelDto[]>;
  devise: Signal<string>;
  chargement: Signal<boolean>;
  /** Contexte requis pour charger le détail des postes d'un compte sélectionné —
   *  `null` si non applicable (cohérent avec le gating de `_comptesRecapCle`). */
  cle: Signal<{ foyerId: string; scenarioId: string; annee: number; mois: number; membreId: string } | null>;
}

/**
 * Contenu du drawer pour l'indicateur "Virements des comptes" : enveloppe fine autour de
 * `<app-comptes-hub-recap>` (vue "Hub & Rayons" en `p-organization-chart`), sans le retirer
 * de l'onglet "Comptes" d'origine.
 */
@Component({
  selector: 'app-virements-comptes-drawer-content',
  standalone: true,
  imports: [CommonModule, ComptesHubRecapComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './virements-comptes-drawer-content.component.html',
})
export class VirementsComptesDrawerContentComponent {
  readonly data = input<VirementsComptesDrawerData>();
}
