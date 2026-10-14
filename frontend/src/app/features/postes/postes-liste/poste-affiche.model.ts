import { PosteDto } from '../../../core/models/api.models';
import { PosteEcheancier } from '../../../shared/components/echeancier-annuel/echeancier.model';

/**
 * Poste enrichi de métadonnées d'affichage calculées côté front pour le regroupement
 * en chaîne de révisions (voir `PostesListeComponent.postesVisibles`). Champs purement
 * transitoires, non envoyés à l'API.
 */
export interface PosteAffiche extends PosteDto {
  _estChaine?: boolean;
  _premierDuBloc?: boolean;
  _estActifChaine?: boolean;
  _nbVersions?: number;
  _clefSeparateur?: string;
  _labelSeparateur?: string;
  /** Nombre de maillons de la chaîne masqués chronologiquement avant celui-ci (toutes causes confondues : option « révision active », filtre État, autres filtres). Non renseigné si 0. */
  _nbMasquesAvant?: number;
  /** Nombre de maillons de la chaîne masqués chronologiquement après celui-ci. Non renseigné si 0. */
  _nbMasquesApres?: number;
}

/** Étiquette du pied de carte : un `app-tag` avec son ton et son infobulle éventuelle. */
export interface EtiquettePoste {
  /** Clé de `track` stable dans la boucle du template. */
  cle: string;
  texte: string;
  /** Sévérité PrimeNG (prioritaire sur `couleur`), ex. `warn` pour une estimation. */
  severity?: 'success' | 'info' | 'warn' | 'danger' | 'secondary';
  /** Couleur libre (couleur du membre) quand l'étiquette identifie un membre. */
  couleur?: string;
  /** Classe d'icône PrimeIcons affichée avant le texte. */
  icone?: string;
  tooltip?: string;
}

/** Paire libellé / valeur du détail déplié. */
export interface LigneDetailPoste {
  cle: string;
  libelle: string;
  valeur: string;
}

/**
 * Tout ce qu'il faut à `app-poste-apercu-periodicite` pour dessiner le rythme d'un
 * poste dans le détail déplié : le rythme lui-même et ses deux textes déjà traduits.
 * Un seul objet plutôt que quatre entrées séparées — il est construit d'un bloc par
 * `PostesListeComponent`, ou vaut `null` quand le poste n'a pas de date de début.
 */
export interface ApercuPeriodicitePoste {
  poste: PosteEcheancier;
  entete: string;
  legende: string;
  locale: string;
}
