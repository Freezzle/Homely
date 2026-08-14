import { Component, input, output, ChangeDetectionStrategy } from '@angular/core';
import { IconColor } from '../../models/icon-color.type';
import { TagComponent } from '../../../../../shared/components/tag/tag.component';

/**
 * Une ligne d'indicateur cliquable : icône · titre/sous-titre · info/sous-info · chevron.
 * Composant strictement présentationnel — aucune donnée métier, aucune injection de
 * service. L'info principale peut être projetée (`[card-info]`) pour les indicateurs
 * ayant besoin d'un affichage riche (mini-barres, badges…) plutôt qu'un simple texte.
 */
@Component({
  selector: 'app-indicator-card',
  standalone: true,
  imports: [TagComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './indicator-card.component.html',
  styleUrl: './indicator-card.component.scss',
})
export class IndicatorCardComponent {
  /** Nom de la classe d'icône (ex: PrimeIcons `pi pi-xxx`). */
  readonly icon = input.required<string>();

  /** Palette de teinte pour la pastille d'icône — fixe, représente le symbole de
   *  l'indicateur (ex. "gray"/"blue" pour une jauge), indépendante de la valeur/zone
   *  courante. Voir `infoColor` pour teinter l'info selon la zone/sévérité. */
  readonly iconColor = input<IconColor>('gray');

  /** Titre principal de l'indicateur. */
  readonly title = input.required<string>();

  /** Sous-titre / contexte court. */
  readonly subtitle = input<string>('');

  /** Info principale (valeur, badge, ratio…) — texte simple, ignoré si `[card-info]` projeté. */
  readonly info = input<string>('');

  /** Teinte du texte de l'info principale (ex. rouge si zone "saturé") — indépendante
   *  de `iconColor`. `null`/absent = couleur d'encre par défaut. */
  readonly infoColor = input<IconColor | null>(null);

  /** Sous-info sous l'info principale. */
  readonly infoSubtitle = input<string>('');

  /** Rangée de tags colorés (ex. un tag par membre) affichée à la place du bloc `info`
   *  texte quand fournie — voir `Indicator.tags`. */
  readonly tags = input<{ label: string; couleur: string }[] | undefined>(undefined);

  /** Émis quand l'utilisateur clique la carte. */
  readonly cardClick = output<void>();
}
