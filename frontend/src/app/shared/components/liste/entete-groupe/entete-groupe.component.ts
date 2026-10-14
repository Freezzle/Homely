import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { MontantPipe } from '../../../../core/pipes/format.pipes';

/**
 * En-tête de section d'une liste : libellé du groupe, compteur, et — quand l'écran sait
 * les calculer — sous-total mensuel et barre de proportion dans le total affiché. Reste
 * épinglé en haut de la zone scrollable (`position: sticky`), borné par le conteneur de
 * son groupe.
 *
 * Partagé par les postes (avec sous-total et barre), l'argent de poche et le prorata
 * (libellé + compteur seulement : aucun montant n'y est sommable hors moteur).
 */
@Component({
  selector: 'app-entete-groupe',
  standalone: true,
  imports: [MontantPipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './entete-groupe.component.html',
  styleUrl: './entete-groupe.component.scss',
})
export class EnteteGroupeComponent {
  readonly libelle = input('');
  readonly nbElements = input(0);
  /** Texte déjà traduit du compteur (« 3 postes », « 2 périodes »…). */
  readonly libelleCompteur = input('');

  /**
   * Somme des montants par mois des éléments récurrents du groupe. `null` quand l'écran
   * n'a pas de total sommable : la ligne de total disparaît alors complètement.
   */
  readonly sousTotal = input<number | null>(null);
  /** Somme des montants des éléments ponctuels du groupe (hors moyenne mensuelle). */
  readonly sousTotalPonctuel = input(0);
  /** Part du groupe dans le total affiché, de 0 à 1. `null` ⇒ pas de barre. */
  readonly part = input<number | null>(null);
  /** Couleur d'accent de la barre de proportion. */
  readonly couleur = input('');
  readonly devise = input<string | undefined>(undefined);
  /** Libellé des montants « par mois », déjà traduit. */
  readonly uniteParMois = input('');
  /** Suffixe des montants ponctuels, déjà traduit (« ponctuel »). */
  readonly unitePonctuel = input('');
  /** Infobulle de la barre, déjà traduite (« 42,5 % du total »). */
  readonly titreBarre = input('');

  protected readonly largeur = computed(() => Math.round((this.part() ?? 0) * 1000) / 10);
}
