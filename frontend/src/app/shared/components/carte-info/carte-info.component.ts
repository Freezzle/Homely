import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { NgTemplateOutlet } from '@angular/common';
import { TooltipModule } from 'primeng/tooltip';
import { TonCarte, couleurDouce, couleurPleine } from '../indicateurs/tons';

/**
 * Carte d'information standard de l'application (dashboard et autres écrans) :
 * en-tête (titre, icône info avec sous-titre en infobulle, badge, actions projetées
 * `[carte-actions]`) + corps projeté. Purement présentationnelle, non cliquable.
 *
 * Déclare `container: carte / inline-size` pour que les indicateurs enfants adaptent leur
 * mise en page à la largeur de la carte (container queries).
 */
@Component({
  selector: 'app-carte-info',
  standalone: true,
  imports: [TooltipModule, NgTemplateOutlet],
  templateUrl: './carte-info.component.html',
  styleUrl: './carte-info.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CarteInfoComponent {
  readonly titre = input.required<string>();
  /** Si fourni, affiche une icône info dont l'infobulle porte ce texte. */
  readonly sousTitre = input<string>('');
  /** Fond de l'en-tête. Absent = transparent. */
  readonly ton = input<TonCarte | null>(null);
  readonly badgeTexte = input<string>('');
  /** Couleur du texte du badge. Absent = texte atténué. */
  readonly badgeTon = input<TonCarte | null>(null);
  /** Niveau sémantique du titre (h2 → h6). */
  readonly niveauTitre = input<2 | 3 | 4 | 5 | 6>(3);

  protected readonly fondEntete = computed(() => {
    const ton = this.ton();
    return ton ? couleurDouce(ton) : null;
  });

  protected readonly couleurBadge = computed(() => {
    const ton = this.badgeTon();
    return ton ? couleurPleine(ton) : null;
  });
}
