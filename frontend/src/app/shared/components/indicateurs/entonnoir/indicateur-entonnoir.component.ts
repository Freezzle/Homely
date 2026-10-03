import { ChangeDetectionStrategy, Component, computed, input, output } from '@angular/core';
import { TooltipModule } from 'primeng/tooltip';
import { AvatarModule } from 'primeng/avatar';
import { AvatarGroupModule } from 'primeng/avatargroup';
import { OPACITE_SURFACE_TON_PROPRE, TonIndicateur, couleurSurface } from '../tons';

/** Membre représenté par un mini avatar (initiales sur fond de sa couleur). */
export interface MembreSegmentEntonnoir {
  nom: string;
  initiales: string;
  couleur: string;
}

/** Morceau de libellé, éventuellement préfixé par les avatars de membres. */
export interface SegmentEntonnoir {
  texte: string;
  membres?: MembreSegmentEntonnoir[];
}

export interface EtapeEntonnoir {
  libelle: string;
  /** Rendu enrichi du libellé (avatars de membres) ; `libelle` reste utilisé pour l'infobulle. */
  segments?: SegmentEntonnoir[];
  /** Valeur déjà formatée par l'appelant. */
  valeurAffichee: string;
  /** Texte secondaire atténué affiché avant la valeur (ex. part en pourcentage). */
  valeurSecondaire?: string;
  /** Largeur relative de la barre (la première étape vaut 100). */
  largeurPourcent: number;
  /** Ton propre à l'étape ; à défaut, le `ton` du composant avec opacité dégressive. */
  ton?: TonIndicateur;
  infobulle?: string;
}

/** Opacité de la première barre, puis décroissance par étape (ton global uniquement). */
const OPACITE_BASE = 40;
const OPACITE_PAS = 8;

/**
 * Barres horizontales décroissantes représentant les étapes successives d'un parcours.
 * Libellé et valeur restent lisibles en texte (pas d'information portée par la seule couleur).
 */
@Component({
  selector: 'app-indicateur-entonnoir',
  standalone: true,
  imports: [TooltipModule, AvatarModule, AvatarGroupModule],
  templateUrl: './indicateur-entonnoir.component.html',
  styleUrl: './indicateur-entonnoir.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class IndicateurEntonnoirComponent {
  readonly etapes = input.required<EtapeEntonnoir[]>();
  readonly ton = input<TonIndicateur>('info');
  /** Rend les barres focusables/cliquables et active `etapeClick`. */
  readonly interactif = input<boolean>(false);

  readonly etapeClick = output<number>();

  protected readonly lignes = computed(() => {
    const tonGlobal = this.ton();
    return this.etapes().map((etape, index) => {
      const couleur = etape.ton ?? tonGlobal;
      const opacite = etape.ton ? OPACITE_SURFACE_TON_PROPRE : Math.max(8, OPACITE_BASE - index * OPACITE_PAS);
      const details = [etape.valeurAffichee, etape.valeurSecondaire].filter(Boolean).join(' · ');
      return {
        index,
        libelle: etape.libelle,
        segments: etape.segments ?? null,
        valeurAffichee: etape.valeurAffichee,
        valeurSecondaire: etape.valeurSecondaire ?? '',
        largeur: `${Math.min(100, Math.max(8, etape.largeurPourcent))}%`,
        fond: couleurSurface(couleur, opacite),
        infobulle: etape.infobulle ?? `${etape.libelle} · ${details}`,
      };
    });
  });

  protected cliquer(index: number): void {
    if (this.interactif()) this.etapeClick.emit(index);
  }
}
