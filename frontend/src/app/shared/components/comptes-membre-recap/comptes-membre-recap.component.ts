import { CommonModule } from '@angular/common';
import { Component, computed, inject, input } from '@angular/core';
import { CardModule } from 'primeng/card';
import { SkeletonModule } from 'primeng/skeleton';
import { MontantPipe } from '../../../core/pipes/format.pipes';
import { I18nService } from '../../../core/i18n/i18n.service';
import { CompteRecapMensuelDto } from '../../../core/models/api.models';

/** Vue-modèle prête à l'emploi pour une card de compte — calculée une fois par
 *  `ComptesMembreRecapComponent` (pas de recalcul dans le template). */
interface CompteCardVm {
  compteId: string;
  libelle: string;
  virementsEntrants: number;
  entrees: number;
  sortiesPlanifiees: number;
  sortiesEchues: number;
  virementsSortants: number;
  soldeRestant: number;
}

/**
 * Récapitulatif mensuel de trésorerie par compte (dashboard, vue membre) : une card par
 * compte avec virements entrants simulés, entrées/sorties échues et solde restant.
 * Purement présentationnel — reçoit ses données déjà calculées côté serveur via `@Input`.
 */
@Component({
  selector: 'app-comptes-membre-recap',
  standalone: true,
  imports: [CommonModule, CardModule, SkeletonModule, MontantPipe],
  templateUrl: './comptes-membre-recap.component.html',
  styleUrl: './comptes-membre-recap.component.scss',
})
export class ComptesMembreRecapComponent {
  private readonly i18n = inject(I18nService);
  protected readonly t = this.i18n.translations();

  readonly recaps = input<CompteRecapMensuelDto[]>([]);
  readonly devise = input<string>('CHF');
  readonly chargement = input<boolean>(false);

  protected readonly cartes = computed<CompteCardVm[]>(() =>
    this.recaps().map((r) => ({
      compteId: r.compteId,
      libelle: r.libelleCompte,
      virementsEntrants: r.virementsEntrants,
      entrees: r.entrees,
      sortiesPlanifiees: r.sortiesPlanifiees,
      sortiesEchues: r.sortiesEchues,
      virementsSortants: r.virementsSortants,
      soldeRestant: r.soldeRestant,
    }))
  );
}
