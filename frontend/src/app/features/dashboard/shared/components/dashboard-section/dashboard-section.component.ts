import { Component, input, ChangeDetectionStrategy } from '@angular/core';
import { SectionCountColor } from '../../models/indicator.model';

/**
 * En-tête de section (titre + trait horizontal + compteur en pill) puis liste de
 * cartes d'indicateurs projetées. Conteneur pur : ne connaît pas le contenu, juste la
 * mise en page.
 */
@Component({
  selector: 'app-dashboard-section',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './dashboard-section.component.html',
  styleUrl: './dashboard-section.component.scss',
})
export class DashboardSectionComponent {
  /** Titre affiché en majuscule dans l'en-tête. */
  readonly title = input.required<string>();

  /** Compteur affiché à droite du titre (nombre d'items par exemple). */
  readonly count = input<number | null>(null);

  /** Teinte du pill compteur. */
  readonly countColor = input<SectionCountColor>('default');
}
