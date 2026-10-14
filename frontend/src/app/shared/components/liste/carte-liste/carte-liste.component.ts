import { ChangeDetectionStrategy, Component, TemplateRef, input, output } from '@angular/core';
import { NgTemplateOutlet } from '@angular/common';

/**
 * Coquille d'une carte de liste : cadre, tête cliquable, chevron et zone de détail
 * dépliable. Partagée par les listes de postes, d'argent de poche et de prorata
 * (docs/features/refonte.md §3) — elle ne connaît aucun modèle métier.
 *
 * La tête est fournie par l'appelant en `TemplateRef` (et non en `ng-content`) parce
 * qu'elle est rendue dans **deux** variantes exclusives : un `<button>` qui déplie le
 * détail, ou un `<label>` qui coche la case en mode sélection. Deux `<ng-content>` de
 * même sélecteur dans deux branches `@if` ne peuvent pas recevoir le même contenu.
 *
 * Le contenu du template doit porter les classes de zones de `styles/_cartes-liste.css`
 * (`zone-nom`, `zone-montant`, `zone-dates`, `zone-complement`, `zone-pied`) : elles sont
 * globales, car un `TemplateRef` reste dans la portée de styles de son composant
 * déclarant.
 */
@Component({
  selector: 'app-carte-liste',
  standalone: true,
  imports: [NgTemplateOutlet],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './carte-liste.component.html',
  styleUrl: './carte-liste.component.scss',
  host: {
    '[class.carte--deplie]': 'deplie()',
    '[class.carte--surbrillance]': 'enSurbrillance()',
    '[class.carte--lisere]': 'lisere()',
  },
})
export class CarteListeComponent {
  /** Contenu de la tête, rendu à l'identique dans les deux variantes. */
  readonly contenuTete = input.required<TemplateRef<unknown>>();

  readonly deplie = input(false);
  readonly enSurbrillance = input(false);
  /**
   * Liseré d'accent à gauche de la carte : marque son appartenance à une suite
   * d'éléments liés (chaîne de révisions d'un poste, par exemple).
   */
  readonly lisere = input(false);

  /** Mode sélection : la tête coche une case au lieu de déplier le détail. */
  readonly modeSelection = input(false);
  /** `id` de la case à cocher projetée, pour l'attribut `for` du `<label>`. */
  readonly selectionInputId = input('');

  /** `id` de la zone de détail, cible de l'`aria-controls` de la tête. */
  readonly idDetail = input('');
  /** Libellé accessible de la tête (« Déplier … » / « Replier … »). */
  readonly libelleBascule = input('');

  /** Demande d'ouverture / fermeture : le parent arbitre (un seul élément déplié). */
  readonly basculer = output<void>();
}
