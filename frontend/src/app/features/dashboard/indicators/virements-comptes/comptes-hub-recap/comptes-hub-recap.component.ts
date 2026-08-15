import { ChangeDetectionStrategy, Component, computed, inject, input, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { OrganizationChartModule } from 'primeng/organizationchart';
import { SkeletonModule } from 'primeng/skeleton';
import { OrgChartNode, OrganizationChartNodeSelectEvent, OrganizationChartNodeUnSelectEvent } from 'primeng/types/organizationchart';

import { CompteRecapMensuelDto, ComptePosteDetailDto } from '../../../../../core/models/api.models';
import { I18nService } from '../../../../../core/i18n/i18n.service';
import { ProjectionService } from '../../../../../core/services/projection.service';
import { creerChargementReactif } from '../../../../../core/utils/reference-data.util';
import { MontantPipe } from '../../../../../core/pipes/format.pipes';
import { CompteFlowCardComponent, CompteFlowCardVariant } from './compte-flow-card/compte-flow-card.component';

interface HubNodeData {
  compte: CompteRecapMensuelDto;
  variant: CompteFlowCardVariant;
}

/** Contexte requis pour charger le détail des postes d'un compte sélectionné. */
export interface ComptesHubRecapCle {
  foyerId: string;
  scenarioId: string;
  annee: number;
  mois: number;
  membreId: string;
}

/**
 * Vue "Hub & Rayons" du récapitulatif mensuel de trésorerie par compte : le compte qui
 * redistribue le plus (`virementsSortants` max) est placé à la racine, les autres comptes
 * apparaissent comme satellites. Reçoit les mêmes données déjà calculées côté serveur
 * (`CompteRecapMensuelDto[]`) que l'ancienne vue en cards empilées — aucun nouvel appel backend
 * pour le graphique lui-même.
 *
 * <p>Sélectionner une carte de compte (`selectionMode="single"`) charge et affiche, sous le
 * graphique global, la liste des postes (+ argent de poche éventuel) qui l'alimentent pour le
 * membre/mois courants — via `ProjectionService.comptePostes`, requête reçue en `@Input cle`.</p>
 *
 * Remarque : le DTO actuel n'expose pas de paires de virement `from → to`, donc les liens de
 * l'orgchart représentent uniquement la relation "hub / satellite", pas un virement précis
 * entre deux comptes.
 */
@Component({
  selector: 'app-comptes-hub-recap',
  standalone: true,
  imports: [CommonModule, OrganizationChartModule, SkeletonModule, CompteFlowCardComponent, MontantPipe],
  templateUrl: './comptes-hub-recap.component.html',
  styleUrl: './comptes-hub-recap.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ComptesHubRecapComponent {
  private readonly i18n = inject(I18nService);
  protected readonly t = this.i18n.translations();
  private readonly projSvc = inject(ProjectionService);

  readonly recaps = input<CompteRecapMensuelDto[]>([]);
  readonly devise = input<string>('CHF');
  readonly chargement = input<boolean>(false);
  readonly cle = input<ComptesHubRecapCle | null>(null);

  /** Compte actuellement sélectionné dans le graphique (`null` = aucune sélection). */
  protected readonly compteSelectionneId = signal<string | null>(null);

  /** Le hub = le compte avec le plus de virements sortants (fallback : le premier compte). */
  private readonly hub = computed<CompteRecapMensuelDto | null>(() => {
    const comptes = this.recaps();
    if (comptes.length === 0) return null;
    return [...comptes].sort((a, b) => b.virementsSortants - a.virementsSortants)[0];
  });

  /** Arbre PrimeNG : racine = hub, enfants = tous les autres comptes en satellites. */
  protected readonly tree = computed<OrgChartNode<HubNodeData>[]>(() => {
    const hub = this.hub();
    if (!hub) return [];

    const children: OrgChartNode<HubNodeData>[] = this.recaps()
      .filter((c) => c.compteId !== hub.compteId)
      .map((compte) => ({
        key: compte.compteId,
        data: { compte, variant: 'satellite' },
      }));

    return [{
      key: hub.compteId,
      data: { compte: hub, variant: 'hub' },
      children,
    }];
  });

  /** Vrai si l'affichage doit montrer l'état vide. */
  protected readonly aucunCompte = computed(() => !this.chargement() && this.recaps().length === 0);

  /** Libellé du compte sélectionné (pour l'en-tête de la liste des postes), `null` sinon. */
  protected readonly libelleCompteSelectionne = computed(() => {
    const id = this.compteSelectionneId();
    if (!id) return null;
    return this.recaps().find((c) => c.compteId === id)?.libelleCompte ?? null;
  });

  /** Clé combinée (contexte + compte sélectionné) pilotant le chargement réactif de la
   *  liste des postes — `null` tant qu'aucun compte n'est sélectionné ou hors contexte. */
  private readonly postesDetailCle = computed<(ComptesHubRecapCle & { compteId: string }) | null>(() => {
    const cle = this.cle();
    const compteId = this.compteSelectionneId();
    return cle && compteId ? { ...cle, compteId } : null;
  });

  private readonly _postesDetail = creerChargementReactif(this.postesDetailCle, ({ foyerId, scenarioId, annee, mois, membreId, compteId }) =>
    this.projSvc.comptePostes(foyerId, scenarioId, annee, mois, membreId, compteId),
  );

  protected readonly postesDetail = computed<ComptePosteDetailDto[]>(() => this._postesDetail.donnees() ?? []);
  protected readonly postesDetailChargement = computed(() => this._postesDetail.chargement());

  protected onNodeSelect(event: OrganizationChartNodeSelectEvent): void {
    const compte = (event.node.data as HubNodeData | undefined)?.compte;
    this.compteSelectionneId.set(compte?.compteId ?? null);
  }

  protected onNodeUnselect(_event: OrganizationChartNodeUnSelectEvent): void {
    this.compteSelectionneId.set(null);
  }
}

