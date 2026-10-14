import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { MenuItem } from 'primeng/api';
import { MenuModule } from 'primeng/menu';
import { ButtonComponent } from '../../button/button.component';

/** Paire libellé / valeur affichée dans le détail déplié d'une carte de liste. */
export interface LigneDetail {
  cle: string;
  libelle: string;
  valeur: string;
}

/**
 * Clés `data` posées sur les `MenuItem` par les écrans et interprétées ici pour la mise
 * en page de la rangée d'actions. Une action sans `data` est une action secondaire.
 */
export const ACTION_MODIFIER = 'modifier';
export const ACTION_SUPPRIMER = 'supprimer';
export const ACTION_CHANGER_VALEUR = 'changer-valeur';

/**
 * Contenu du détail déplié d'une carte de liste : paires libellé / valeur, blocs
 * additionnels projetés par l'écran (`ng-content`), puis la rangée d'actions — qui
 * remplace l'ancien menu roue dentée de chaque ligne.
 *
 * Composant de présentation pur : les lignes arrivent déjà formatées et les actions sont
 * les `MenuItem` construits par l'écran (mêmes conditions d'affichage, mêmes `command`).
 */
@Component({
  selector: 'app-detail-liste',
  standalone: true,
  imports: [ButtonComponent, MenuModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './detail-liste.component.html',
  styleUrl: './detail-liste.component.scss',
  host: {
    '[class.detail--duo]': 'colonneLaterale()',
  },
})
export class DetailListeComponent {
  readonly lignes = input<LigneDetail[]>([]);
  readonly actions = input<MenuItem[]>([]);
  /**
   * `true` quand l'écran projette une colonne latérale (ex. le bloc « Analyse » des
   * postes) : le corps passe alors à deux colonnes à partir de 768px.
   */
  readonly colonneLaterale = input(false);

  /** « Modifier » : action principale, mise en avant à gauche de la rangée. */
  protected readonly actionPrincipale = computed(() =>
    this.actions().find(a => a['data'] === ACTION_MODIFIER) ?? null);

  /** « Supprimer » : action destructive, isolée à droite. */
  protected readonly actionDestructive = computed(() =>
    this.actions().find(a => a['data'] === ACTION_SUPPRIMER) ?? null);

  /** Sous-menu « Changer une valeur » : un seul bouton ouvrant un `p-menu` popup. */
  protected readonly sousMenu = computed(() =>
    this.actions().find(a => a['data'] === ACTION_CHANGER_VALEUR) ?? null);

  /** Toutes les autres actions, dans l'ordre fourni par l'écran. */
  protected readonly actionsSecondaires = computed(() =>
    this.actions().filter(a =>
      a['data'] !== ACTION_MODIFIER && a['data'] !== ACTION_SUPPRIMER && a['data'] !== ACTION_CHANGER_VALEUR));

  protected executer(item: MenuItem | null): void {
    item?.command?.({ item });
  }
}
