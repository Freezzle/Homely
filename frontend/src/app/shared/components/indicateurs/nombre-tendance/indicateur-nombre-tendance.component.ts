import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { BadgeDeltaComponent } from '../badge-delta/badge-delta.component';

/**
 * Valeur clé (déjà formatée par l'appelant) accompagnée d'un badge de variation.
 */
@Component({
  selector: 'app-indicateur-nombre-tendance',
  standalone: true,
  imports: [BadgeDeltaComponent],
  templateUrl: './indicateur-nombre-tendance.component.html',
  styleUrl: './indicateur-nombre-tendance.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class IndicateurNombreTendanceComponent {
  /** Valeur principale, déjà formatée (montant, nombre…). */
  readonly valeur = input.required<string>();
  /** Unité affichée après la valeur (ex. « CHF », « % »). */
  readonly unite = input<string>('');
  /** Variation en ratio (0.063 → +6,3 %) ; `null` masque le badge (pas de référence). */
  readonly delta = input.required<number | null>();
  readonly inverserDelta = input<boolean>(false);
  /** Force un badge au ton neutre (variation sans connotation favorable/défavorable). */
  readonly deltaNeutre = input<boolean>(false);
  /** Période de référence (ex. « vs 2025 »). */
  readonly libelleComparaison = input<string>('');
  readonly formateurDelta = input<((delta: number) => string) | null>(null);
}
