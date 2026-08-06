import { CommonModule } from '@angular/common';
import { Component, computed, input } from '@angular/core';
import { PostePositionneDto } from '../../../core/models/api.models';
import { couleurPourScore } from './matrice-budgetaire.utils';

interface PosteVm {
  poste: PostePositionneDto;
  montantAnnuelLabel: string;
  couleur: string;
  /** Largeur de la barre en % (0-100), directement le score. */
  largeurBarre: number;
}

/** Tous les textes affichés par le composant — fournis par le parent (clés i18n),
 *  ce composant partagé ne doit contenir aucun texte en dur. */
export interface MatriceBudgetaireLabels {
  aucunPoste: string;
  colonneRang: string;
  colonneNom: string;
  colonneMontant: string;
  colonneScore: string;
  /** Préfixes des badges, ex. "Nécessité", "Optimisable". */
  badgeNecessite: string;
  badgeOptimisable: string;
  scoreTooltip: string;
}

/**
 * Classement "Postes à optimiser en priorité" : liste en barres horizontales triée par
 * score décroissant (déjà calculé et trié côté serveur), remplaçant l'ancien scatter
 * 4-quadrants. Rendu en HTML/CSS custom (pas Chart.js) pour rester cohérent avec le
 * reste de l'accessibilité clavier du dashboard.
 *
 * Les postes reçus via `postes` sont déjà entièrement classés côté serveur
 * (`PostePositionneDto` — score 0-100, rang, top 30) : ce composant ne fait plus aucun
 * calcul, uniquement du rendu.
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

  private readonly formatteurMontant = computed(
    () => new Intl.NumberFormat('fr-CH', { style: 'currency', currency: this.devise(), maximumFractionDigits: 0 }),
  );

  protected readonly lignes = computed<PosteVm[]>(() =>
    this.postes().map((poste) => ({
      poste,
      montantAnnuelLabel: this.formatteurMontant().format(poste.montantAnnuel),
      couleur: couleurPourScore(poste.score),
      largeurBarre: Math.max(2, Math.min(100, poste.score)),
    })),
  );

  /** Texte complet du tooltip nécessité (template i18n avec `{{n}}` substitué). */
  protected necessiteTooltip(poste: PostePositionneDto): string {
    return this.labels().badgeNecessite.replace('{{n}}', String(poste.necessite));
  }

  /** Texte complet du tooltip optimisable (template i18n avec `{{n}}` substitué). */
  protected optimisableTooltip(poste: PostePositionneDto): string {
    return this.labels().badgeOptimisable.replace('{{n}}', String(poste.optimisable));
  }

  /** Texte complet du tooltip score (template i18n avec `{{n}}` substitué). */
  protected scoreTooltip(poste: PostePositionneDto): string {
    return this.labels().scoreTooltip.replace('{{n}}', String(Math.round(poste.score)));
  }
}
