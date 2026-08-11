import { CommonModule } from '@angular/common';
import { ChangeDetectionStrategy, Component, Signal, input } from '@angular/core';
import { PostePositionneDto } from '../../../../core/models/api.models';
import { MatriceBudgetaireComponent, MatriceBudgetaireLabels } from '../../../../shared/components/matrice-budgetaire/matrice-budgetaire.component';

/**
 * Payload transmis via `IndicatorDrawerService.open({ data })` — références de signaux pour
 * rester réactif (changement de période, etc.).
 */
export interface PostesAOptimiserDrawerData {
  postes: Signal<PostePositionneDto[]>;
  devise: Signal<string>;
  labels: Signal<MatriceBudgetaireLabels>;
  chargement: Signal<boolean>;
}

/**
 * Contenu du drawer pour l'indicateur "Postes à optimiser" : enveloppe fine autour du
 * composant partagé `<app-matrice-budgetaire>`, sorti de l'onglet "Graphiques" annuel (mais
 * toujours présent dans cet onglet — même source de données, second point d'accès).
 */
@Component({
  selector: 'app-postes-a-optimiser-drawer-content',
  standalone: true,
  imports: [CommonModule, MatriceBudgetaireComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './postes-a-optimiser-drawer-content.component.html',
})
export class PostesAOptimiserDrawerContentComponent {
  readonly data = input<PostesAOptimiserDrawerData>();
}
