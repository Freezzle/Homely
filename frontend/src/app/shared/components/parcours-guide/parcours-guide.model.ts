/** Une étape du parcours guidé. La clé identifie l'étape (jamais son index). */
export interface EtapeParcours {
  readonly cle: string;
  readonly titre: string;
}

/** État d'une ligne de la fiche récapitulative. */
export type EtatLigneFiche = 'courante' | 'faite' | 'vide';

/** Une ligne de la fiche : le résumé d'une étape, cliquable pour y revenir. */
export interface LigneFiche {
  readonly cle: string;
  readonly libelle: string;
  readonly valeur: string | null;
  readonly etat: EtatLigneFiche;
}

/** Ton du badge affiché dans l'en-tête du parcours. */
export type TonBadgeParcours = 'revenu' | 'charge' | 'reserve' | 'argent-poche' | 'info';
