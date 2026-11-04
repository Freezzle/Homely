import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';
import { AvatarModule } from 'primeng/avatar';
import { AvatarGroupModule } from 'primeng/avatargroup';

/** Membre représenté par un mini avatar (initiales sur fond de sa couleur). */
export interface MembreListeGroupee {
  nom: string;
  initiales: string;
  couleur: string;
}

/** Ligne d'un groupe : un libellé (+ avatars facultatifs) et une valeur déjà formatée. */
export interface LigneListeGroupee {
  /** Clé stable remontée par `ligneClick` (ex. `sourceId::destinationId`). */
  cle: string;
  libelle: string;
  membres?: MembreListeGroupee[];
  /** Valeur déjà formatée par l'appelant. */
  valeurAffichee: string;
  /** Désactive le clic pour cette ligne (ex. agrégat « Autres »). */
  nonCliquable?: boolean;
}

/** Groupe de lignes, coiffé d'un en-tête (libellé + sous-libellé + total). */
export interface GroupeListeGroupee {
  cle: string;
  libelle: string;
  membres?: MembreListeGroupee[];
  /** Texte secondaire sous le libellé (ex. « 3 virements »). */
  sousLibelle?: string;
  /** Total du groupe, déjà formaté. */
  totalAffiche: string;
  /** Libellé atténué sous le total (ex. « à envoyer »). */
  totalLibelle?: string;
  lignes: LigneListeGroupee[];
}

/**
 * Liste à en-têtes de groupe : reprend, en version allégée pour une carte de dashboard,
 * la structure du tableau groupé affiché dans le drawer (`app-table-virements-comptes`) —
 * un en-tête par compte source, puis une ligne par destination.
 *
 * <p>Les lignes deviennent cliquables (et focusables au clavier) quand `interactif` vaut
 * vrai ; le parent écoute alors `ligneClick` pour ouvrir le détail.</p>
 */
@Component({
  selector: 'app-indicateur-liste-groupee',
  standalone: true,
  imports: [AvatarModule, AvatarGroupModule],
  templateUrl: './indicateur-liste-groupee.component.html',
  styleUrl: './indicateur-liste-groupee.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class IndicateurListeGroupeeComponent {
  readonly groupes = input.required<readonly GroupeListeGroupee[]>();
  /** Rend les lignes focusables/cliquables et active `ligneClick`. */
  readonly interactif = input<boolean>(false);

  readonly ligneClick = output<string>();

  protected cliquer(ligne: LigneListeGroupee): void {
    if (!this.estCliquable(ligne)) return;
    this.ligneClick.emit(ligne.cle);
  }

  protected estCliquable(ligne: LigneListeGroupee): boolean {
    return this.interactif() && !ligne.nonCliquable;
  }
}
