import { ChangeDetectionStrategy, Component, computed, inject, input } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MontantPipe } from '../../../../../../core/pipes/format.pipes';
import { I18nService } from '../../../../../../core/i18n/i18n.service';
import { CompteRecapMensuelDto } from '../../../../../../core/models/api.models';

export type CompteFlowCardVariant = 'hub' | 'satellite';

/**
 * Card compacte affichant les flux d'un compte, utilisée comme nœud du
 * `p-organization-chart` de `ComptesHubRecapComponent`. Purement présentationnelle,
 * reçoit les données déjà calculées côté serveur (`CompteRecapMensuelDto`) via `@Input`.
 */
@Component({
  selector: 'app-compte-flow-card',
  standalone: true,
  imports: [CommonModule, MontantPipe],
  templateUrl: './compte-flow-card.component.html',
  styleUrl: './compte-flow-card.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CompteFlowCardComponent {
  private readonly i18n = inject(I18nService);
  protected readonly t = this.i18n.translations();

  readonly compte = input.required<CompteRecapMensuelDto>();
  readonly devise = input<string>('CHF');
  readonly variant = input<CompteFlowCardVariant>('satellite');

  protected readonly isHub = computed(() => this.variant() === 'hub');
  protected readonly isNegatif = computed(() => this.compte().soldeRestant < 0);

  // Affichage conditionnel des lignes (masquées quand à zéro, sauf sorties échues)
  protected readonly showVirementsEntrants = computed(() => this.compte().virementsEntrants > 0);
  protected readonly showEntrees = computed(() => this.compte().entrees > 0);
  protected readonly showVirementsSortants = computed(() => this.compte().virementsSortants > 0);
  protected readonly showReserves = computed(() => this.compte().reservesEchues > 0);

  /** Charges seules (sorties échues moins réserves) — 0 si aucune charge. */
  protected readonly chargesEchues = computed(() => this.compte().sortiesEchues - this.compte().reservesEchues);
}
