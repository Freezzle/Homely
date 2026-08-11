import { CommonModule } from '@angular/common';
import { ChangeDetectionStrategy, Component, Signal, WritableSignal, input } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { SelectButtonModule } from 'primeng/selectbutton';
import { CarteBilanComponent, LigneDecomposition } from '../../../../shared/components/carte-bilan/carte-bilan.component';

/** Config consommée par `<app-carte-bilan>` (voir `carteMoisConfig`/`carteAnneeConfig`). */
export interface VentilationPostesCarteConfig {
  variante: 'foyer' | 'membre';
  nom: string;
  sousTitre: string;
  couleur: string;
  initiales: string;
  montantPrincipal: number;
  lignes: LigneDecomposition[];
  tauxEffort?: number;
  prorataPct?: number;
}

/**
 * Payload transmis via `IndicatorDrawerService.open({ data })` — porte des **références de
 * signaux** (pas de snapshot) pour que le selectbutton reste interactif/réactif sans dupliquer
 * la chaîne de computeds `carteMoisConfig`/`carteAnneeConfig`/`vueDecomposition` du dashboard.
 */
export interface VentilationPostesDrawerData {
  vueDecomposition: WritableSignal<'CATEGORIE' | 'TYPE_POSTE' | 'COMPTE'>;
  vueDecompositionOptions: { label: string; value: string }[];
  carteConfig: Signal<VentilationPostesCarteConfig>;
  devise: Signal<string>;
}

/**
 * Contenu du drawer pour l'indicateur "Ventilations des postes" : reprend le contenu de
 * l'onglet "Récapitulatifs" (selectbutton de décomposition + `<app-carte-bilan>`), sans le
 * retirer de l'onglet d'origine — même source de données, juste un second point d'accès.
 */
@Component({
  selector: 'app-ventilation-postes-drawer-content',
  standalone: true,
  imports: [CommonModule, FormsModule, SelectButtonModule, CarteBilanComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './ventilation-postes-drawer-content.component.html',
})
export class VentilationPostesDrawerContentComponent {
  readonly data = input<VentilationPostesDrawerData>();
}
