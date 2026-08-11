import { CommonModule } from '@angular/common';
import { ChangeDetectionStrategy, Component, Signal, input } from '@angular/core';
import { ChartModule } from 'primeng/chart';

/** Textes traduits nécessaires au rendu (le composant partagé ne connaît aucune clé i18n). */
export interface EvolutionGraphiqueLabels {
  fluxMensuel: string;
  fluxMensuelDescription: string;
  cliquezBarre: string;
  tresorerieTitle: string;
  tresoCumuleeDescription: string;
  prevuVsReel: string;
  prevuVsReelDescription: string;
}

/**
 * Payload transmis via `IndicatorDrawerService.open({ data })` — références de signaux pour
 * rester réactif (changement de période, etc.) sans dupliquer la logique de construction des
 * données de graphique.
 */
export interface EvolutionGraphiqueDrawerData {
  mixedChartData: Signal<object>;
  mixedChartOptions: object;
  tresorerieCumuleeData: Signal<object>;
  tresorerieCumuleeOptions: object;
  prevuVsReelData: Signal<object>;
  prevuVsReelOptions: object;
  labels: EvolutionGraphiqueLabels;
}

/**
 * Contenu du drawer pour l'indicateur "Évolution graphique" : reprend les 3 graphiques de
 * l'onglet "Graphiques" (flux mensuel, trésorerie cumulée, prévu vs réel), empilés
 * verticalement au lieu du switch/selectbutton utilisé dans l'onglet d'origine — la matrice
 * budgétaire n'y figure pas (indicateur séparé "Postes à optimiser").
 */
@Component({
  selector: 'app-evolution-graphique-drawer-content',
  standalone: true,
  imports: [CommonModule, ChartModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './evolution-graphique-drawer-content.component.html',
})
export class EvolutionGraphiqueDrawerContentComponent {
  readonly data = input<EvolutionGraphiqueDrawerData>();
}
