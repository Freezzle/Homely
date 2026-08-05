import { CommonModule } from '@angular/common';
import { Component, computed, input, output, signal } from '@angular/core';
import { PostePositionneDto, QuadrantMatrice } from '../../../core/models/api.models';
import { QUADRANTS, QuadrantName } from './matrice-budgetaire.utils';

interface QuadrantVm {
  id: QuadrantName;
  label: string;
  ariaLabel: string;
  couleurAccent: string;
  // Rectangle du quadrant en coordonnées de la grille (0-100 sur chaque axe), origine en bas-gauche.
  left: number;
  top: number;
}

interface PosteListItem {
  poste: PostePositionneDto;
  montantAnnuelLabel: string;
}

/** Rayon min/max (px) des points, modulés par le poids du montant annualisé (voir `rayonPoint`). */
const RAYON_MIN_PX = 6;
const RAYON_MAX_PX = 16;

/** Tous les textes affichés par le composant — fournis par le parent (clés i18n),
 *  ce composant partagé ne doit contenir aucun texte en dur. */
export interface MatriceBudgetaireLabels {
  quadrants: Record<QuadrantName, string>;
  /** Résumé du rôle stratégique de chaque quadrant, utilisé pour l'aria-label et le panneau. */
  quadrantsResume: Record<QuadrantName, string>;
  /** Libellé principal de l'axe (ex. "Nécessité au quotidien"). */
  axisNecessite: string;
  /** Sens de l'axe côté haut (score élevé) — ex. "Plus nécessaire". */
  axisNecessiteHaut: string;
  /** Sens de l'axe côté bas (score faible) — ex. "Moins nécessaire". */
  axisNecessiteBas: string;
  /** Composition du score, ex. "60% ressenti + 40% montant annuel". */
  axisNecessitePoids: string;
  /** Libellé principal de l'axe (ex. "Priorité d'action"). */
  axisPriorite: string;
  /** Sens de l'axe côté gauche (score faible) — ex. "Faible priorité". */
  axisPrioriteGauche: string;
  /** Sens de l'axe côté droite (score élevé) — ex. "Forte priorité". */
  axisPrioriteDroite: string;
  /** Composition du score, ex. "60% optimisable + 40% montant annuel". */
  axisPrioritePoids: string;
  aucunPoste: string;
  panneauVide: string;
  posteCount: string;
  total: string;
  desactionnerAriaLabel: string;
  /** Préfixes des badges du panneau, ex. "Nécessité", "Optimisable", "Poids montant". */
  badgeNecessite: string;
  badgeOptimisable: string;
  badgePoidsMontant: string;
}

/**
 * Matrice "Nécessité vs Priorité d'action" : scatter à 4 quadrants + panneau latéral
 * listant les postes du quadrant sélectionné. Rendu en HTML/CSS custom (pas Chart.js)
 * pour permettre des quadrants focusables au clavier et une zone cliquable pleine,
 * indépendamment de la position exacte des points.
 *
 * Les postes reçus via `postes` sont déjà entièrement positionnés côté serveur
 * (`PostePositionneDto` — scores 0-100, poids du montant, quadrant) : ce composant ne
 * fait plus aucun calcul, uniquement du rendu.
 */
@Component({
  selector: 'app-matrice-budgetaire',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './matrice-budgetaire.component.html',
  styleUrl: './matrice-budgetaire.component.scss',
})
export class MatriceBudgetaireComponent {
  readonly postes = input.required<PostePositionneDto[]>();
  readonly devise = input<string>('CHF');
  readonly chargement = input<boolean>(false);
  readonly labels = input.required<MatriceBudgetaireLabels>();

  readonly quadrantSelected = output<QuadrantName | null>();
  readonly posteHovered = output<PostePositionneDto | null>();

  protected readonly selection = signal<QuadrantName | null>(null);
  protected readonly posteSurvole = signal<PostePositionneDto | null>(null);

  protected readonly quadrants = computed<QuadrantVm[]>(() => {
    const labels = this.labels();
    return QUADRANTS.map((q) => ({
      id: q.id,
      label: labels.quadrants[q.id],
      ariaLabel: `${labels.quadrants[q.id]} — ${labels.quadrantsResume[q.id]}`,
      couleurAccent: q.couleurAccent,
      // Les 4 rectangles se croisent au centre de l'échelle 0-100 (score 50 sur chaque axe).
      left: q.id === 'rigides' || q.id === 'bruit' ? 0 : 50,
      top: q.id === 'rigides' || q.id === 'negocier' ? 0 : 50,
    }));
  });

  private readonly formatteurMontant = computed(
    () => new Intl.NumberFormat('fr-CH', { style: 'currency', currency: this.devise(), maximumFractionDigits: 0 }),
  );

  protected readonly postesDuQuadrantSelectionne = computed<PosteListItem[]>(() => {
    const quadrant = this.selection();
    if (!quadrant) return [];
    return this.postes()
      .filter((p) => p.quadrant === quadrant)
      .sort((a, b) => b.montantAnnuel - a.montantAnnuel)
      .map((poste) => ({ poste, montantAnnuelLabel: this.formatteurMontant().format(poste.montantAnnuel) }));
  });

  protected readonly totalQuadrantSelectionne = computed(() => {
    const total = this.postesDuQuadrantSelectionne().reduce((sum, item) => sum + item.poste.montantAnnuel, 0);
    return this.formatteurMontant().format(total);
  });

  protected readonly quadrantSelectionneVm = computed(() => this.quadrants().find((q) => q.id === this.selection()) ?? null);

  protected selectionner(quadrant: QuadrantName): void {
    const nouvelle = this.selection() === quadrant ? null : quadrant;
    this.selection.set(nouvelle);
    this.quadrantSelected.emit(nouvelle);
  }

  protected deselectionner(): void {
    this.selection.set(null);
    this.quadrantSelected.emit(null);
  }

  protected survolerPoste(poste: PostePositionneDto | null): void {
    this.posteSurvole.set(poste);
    this.posteHovered.emit(poste);
  }

  protected centrerSur(poste: PostePositionneDto): void {
    this.survolerPoste(poste);
  }

  /** Position CSS (%) d'un poste sur l'axe X (priorité, déjà sur [0, 100]). */
  protected positionX(poste: PostePositionneDto): number {
    return poste.prioriteScore;
  }

  /** Position CSS (%) d'un poste sur l'axe Y (nécessité, déjà sur [0, 100], inversé pour l'affichage top-down). */
  protected positionY(poste: PostePositionneDto): number {
    return 100 - Math.min(100, Math.max(0, poste.necessiteScore));
  }

  /** Rayon (px) du point, modulé par le poids du montant annualisé (0-1) — plus le
   *  montant annuel est important parmi les postes affichés, plus le point est grand. */
  protected rayonPoint(poste: PostePositionneDto): number {
    return RAYON_MIN_PX + poste.poidsMontant * (RAYON_MAX_PX - RAYON_MIN_PX);
  }

  protected formatMontant(montant: number): string {
    return this.formatteurMontant().format(montant);
  }

  protected estEstompe(poste: PostePositionneDto): boolean {
    const quadrant = this.selection();
    return quadrant !== null && poste.quadrant !== (quadrant as QuadrantMatrice);
  }

  /** Pourcentage arrondi (0-100) du poids du montant, pour l'affichage du badge. */
  protected poidsMontantPourcent(poste: PostePositionneDto): number {
    return Math.round(poste.poidsMontant * 100);
  }

  /** Texte complet du tooltip nécessité (template i18n avec `{{n}}` substitué). */
  protected necessiteTooltip(poste: PostePositionneDto): string {
    return this.labels().badgeNecessite.replace('{{n}}', String(poste.necessite));
  }

  /** Texte complet du tooltip optimisable (template i18n avec `{{n}}` substitué). */
  protected optimisableTooltip(poste: PostePositionneDto): string {
    return this.labels().badgeOptimisable.replace('{{n}}', String(poste.optimisable));
  }
}
